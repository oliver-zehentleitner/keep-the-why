"""Offline measurement of the search candidates (ktw_proto.py) on every dataset: no model in the loop, deterministic.

For each dataset it builds the prototype's cache (time and size) and, for each question, measures:

- ranked search with the question as the query — BM25, static embeddings (model2vec), and both fused by
  reciprocal rank (RRF): recall@1/@5/@10 (the share of the expected entries in the top k), MRR (1 / the rank of
  the first expected entry), and the tokens of `find -n 10` plus `show` of the first expected hit (of the first hit
  on a miss) — a lower bound, since the harness knows which hit is right; the agent runs measure what is read;
- the entry-level index: the tokens of `index` for the whole family, one line per entry;
- the exact commands for graph and filter questions: `find --type/--status` (every match), `graph ID` (the
  starting entry's edges), with the tokens they print and whether the answer is in them.

In the identical control a copy of an expected entry counts as found: its text is the original's.

    python harness_candidates.py DATA_DIR [--out results/DATE] [--no-embed]
"""

from __future__ import annotations

import argparse
import io
import json
import os
import statistics
import sys
import time
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import harness_offline as H  # noqa: E402
import ktw_proto as P  # noqa: E402

KS = (1, 5, 10)


def run_cli(args: list[str]) -> str:
    buf = io.StringIO()
    with redirect_stdout(buf):
        P.main(args)
    return buf.getvalue()


def ranks(order: list[str], groups: list[set[str]]) -> dict:
    """Recall over answer groups: a group is one expected entry, with its copies in the identical control, and it
    counts as found at its best-ranked member."""
    pos = {i: n for n, i in enumerate(order, 1)}
    found = sorted(min((pos[i] for i in g if i in pos), default=10**9) for g in groups)
    found = [r for r in found if r < 10**9]
    out = {
        f"recall@{k}": sum(1 for r in found if r <= k) / max(len(groups), 1) for k in KS
    }
    out["mrr"] = 1 / found[0] if found else 0.0
    out["first"] = found[0] if found else None
    return out


def rrf(*orders: list[str], k: int = 60) -> list[str]:
    score: dict[str, float] = {}
    for order in orders:
        for n, i in enumerate(order, 1):
            score[i] = score.get(i, 0.0) + 1 / (k + n)
    return sorted(score, key=lambda i: -score[i])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("data", type=Path)
    ap.add_argument("--questions", type=Path, default=HERE / "questions.json")
    ap.add_argument("--out", type=Path)
    ap.add_argument(
        "--no-embed", action="store_true", help="leave out the embedding candidates"
    )
    a = ap.parse_args(argv)
    questions = json.loads(a.questions.read_text(encoding="utf-8"))["questions"]
    os.environ.setdefault("KTW_CACHE", "/var/tmp/ktw-context-search-cache")
    report = {"tokenizer": H.TOKENIZER, "datasets": {}}
    for ds in sorted(p for p in a.data.iterdir() if (p / ".keep-the-why").is_file()):
        ids_map = json.loads((ds / "ids.json").read_text(encoding="utf-8"))
        identical = ids_map["mode"] == "identical"
        t0 = time.perf_counter()
        c, info = P.load(ds, rebuild=True)
        build_s = time.perf_counter() - t0
        cache_bytes = Path(info["path"]).stat().st_size
        data = H.load(ds)
        E = c["entries"]
        index_tokens = H.tokens(run_cli([str(ds), "index"]))
        embed = None
        if not a.no_embed:
            import numpy as np
            from model2vec import StaticModel

            t1 = time.perf_counter()
            model = StaticModel.from_pretrained(P.EMBED_MODEL)
            ids = sorted(E)
            vecs = model.encode(
                [E[i]["title"] + "\n" + E[i]["text"][:2000] for i in ids]
            )
            vecs = vecs / (np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-9)
            embed = {
                "model": model,
                "ids": ids,
                "vecs": vecs,
                "seconds": time.perf_counter() - t1,
                "bytes": vecs.astype("float32").nbytes,
            }
        rows = []
        for q in questions:
            filt = bool(q.get("rule")) and set(q["rule"]) <= H.FILTER_RULE_KEYS
            # one group per expected entry; in the identical control its copies answer as well as it does
            groups = [
                {i}
                | (set(ids_map["ids"].get(i, [])) if identical and not filt else set())
                for i in H.expected_in(q, data)
            ]
            wanted = set().union(*groups) if groups else set()
            row = {"q": q["id"], "kind": q["kind"]}
            orders = {"bm25": [i for i, _ in P.bm25(c, q["question"])]}
            if embed:
                qv = embed["model"].encode([q["question"]])[0]
                qv = qv / (np.linalg.norm(qv) + 1e-9)
                sims = embed["vecs"] @ qv
                orders["embed"] = [embed["ids"][k] for k in np.argsort(-sims)]
                orders["hybrid"] = rrf(orders["bm25"], orders["embed"])
            for name, order in orders.items():
                r = ranks(order, groups)
                top = order[:10]
                lines = "\n".join(P.line(i, E[i]) for i in top)
                shown = next((i for i in top if i in wanted), None)
                # a miss reads something too: the first hit, as the agent would before it searches again
                read = shown or (top[0] if top else None)
                r["tokens"] = H.tokens(lines) + (
                    H.tokens(E[read]["text"]) if read else 0
                )
                r["hit"] = shown is not None
                row[name] = r
            rule = q.get("rule") or {}
            if rule and set(rule) <= H.FILTER_RULE_KEYS:
                args = [str(ds), "find", "-n", "100000"] + [
                    x for k, v in rule.items() for x in (f"--{k}", v)
                ]
                out = run_cli(args)
                row["exact"] = {
                    "tokens": H.tokens(out),
                    "recall": sum(1 for g in groups if any(i in out for i in g))
                    / max(len(groups), 1),
                }
            elif rule:
                start = (
                    rule.get("superseded_by_of")
                    or rule.get("supersede_chain_from")
                    or rule.get("see_of")
                )
                out = run_cli([str(ds), "graph", start, "--depth", "3"])
                row["exact"] = {
                    "tokens": H.tokens(out),
                    "recall": sum(1 for g in groups if any(i in out for i in g))
                    / max(len(groups), 1),
                }
            rows.append(row)
        summ = {}
        GRAPH_KINDS = ("filter", "supersedes", "see", "thought-chain")
        for name in ("bm25", "embed", "hybrid"):
            rs = [r[name] for r in rows if name in r and r["kind"] not in GRAPH_KINDS]
            if rs:
                summ[name] = {
                    **{
                        f"recall@{k}": round(
                            statistics.mean(x[f"recall@{k}"] for x in rs), 3
                        )
                        for k in KS
                    },
                    "mrr": round(statistics.mean(x["mrr"] for x in rs), 3),
                    "median_tokens": statistics.median(x["tokens"] for x in rs),
                    "median_tokens_hits": statistics.median(
                        [x["tokens"] for x in rs if x["hit"]] or [0]
                    ),
                }
        ex = [r["exact"] for r in rows if "exact" in r]
        report["datasets"][ds.name] = {
            "entries": len(E),
            "cache": {"build_seconds": round(build_s, 2), "bytes": cache_bytes},
            "embed": (
                {"seconds": round(embed["seconds"], 2), "bytes": embed["bytes"]}
                if embed
                else None
            ),
            "index_tokens": index_tokens,
            "ranked": summ,
            "exact": {
                "questions": len(ex),
                "recall": (
                    round(statistics.mean(x["recall"] for x in ex), 3) if ex else None
                ),
                "median_tokens": (
                    statistics.median(x["tokens"] for x in ex) if ex else None
                ),
            },
            "rows": rows,
        }
    lines = [
        f"Tokenizer: {H.TOKENIZER}",
        "",
        "Ranked search on the text questions (graph and filter questions are measured under their commands below), with the question as the query: recall@1 / @5 / @10, MRR, median tokens read (find -n 10 plus show of the first expected hit, or of the first hit on a miss) over all text questions / over hits only. The tokens are an oracle lower bound: the harness knows which hit is right and reads only that one; an agent's real reading sequence is measured in the agent runs",
        "",
    ]
    names = [
        n
        for n in ("bm25", "embed", "hybrid")
        if any(n in d["ranked"] for d in report["datasets"].values())
    ]
    lines += ["| dataset | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
    for name, d in report["datasets"].items():
        cells = [
            f"{d['ranked'][n]['recall@1']:.2f} / {d['ranked'][n]['recall@5']:.2f} / {d['ranked'][n]['recall@10']:.2f}, {d['ranked'][n]['mrr']:.2f}, {d['ranked'][n]['median_tokens']} / {d['ranked'][n]['median_tokens_hits']}"
            for n in names
        ]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    lines += [
        "",
        "Graph and filter questions under their commands (graph ID --depth 3, find --type/--status): the share of the answer the output holds, median tokens. q28's answer is a chain of three entries, so a ranked search's recall@1 there is at most 1/3; it is counted here, not above.",
        "",
        "| dataset | recall | median tokens |",
        "|---|---|---|",
    ] + [
        f"| {name} | {d['exact']['recall']} | {d['exact']['median_tokens']} |"
        for name, d in report["datasets"].items()
    ]
    lines += [
        "",
        "| dataset | entries | cache build s | cache MB | embed s | vectors MB | entry index tokens | exact commands: recall, median tokens |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for name, d in report["datasets"].items():
        e = d["embed"] or {}
        lines.append(
            f"| {name} | {d['entries']} | {d['cache']['build_seconds']} | {d['cache']['bytes'] / 1e6:.1f} | {e.get('seconds', '—')} | {e.get('bytes', 0) / 1e6:.1f} | {d['index_tokens']} | {d['exact']['recall']}, {d['exact']['median_tokens']} |"
        )
    print("\n".join(lines))
    if a.out:
        a.out.mkdir(parents=True, exist_ok=True)
        (a.out / "summary.json").write_text(
            json.dumps(report, indent=1), encoding="utf-8"
        )
        (a.out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
