"""Offline measurement of context-search variants: no model, deterministic, every dataset.

For each dataset (×1, ×5, ×10, and the text-identical control) and each question it checks that the expected
ids exist (recomputing the ones a rule derives from the graph) and measures what a variant hands the session:

- baseline: today's way, `context/index.md`, then the topic file that holds the answer — a lower bound, as if the
  agent picked the right topic first time; a question whose answers span topics reads every one of them.

Later variants (an entry-level index, a query CLI, BM25, embeddings) add their own rows here: recall@k / MRR of
their ranking, the tokens of what they print, and their cache's build time and size.

Tokens are counted with tiktoken's cl100k_base when it is installed (a proxy: Claude's tokenizer differs, the
ratio between variants is what counts), else as characters / 4; the summary says which.

    python harness_offline.py DATA_DIR [--out results/DATE]
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

try:
    from ktw_lint.entries import parse_topic_text
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lint"))
    from ktw_lint.entries import parse_topic_text

HERE = Path(__file__).resolve().parent
SKIP = {"index.md", "README.md", "AGENTS.md", "CLAUDE.md"}

try:
    import tiktoken

    _ENC = tiktoken.get_encoding("cl100k_base")
    TOKENIZER = "tiktoken cl100k_base"

    def tokens(text: str) -> int:
        return len(_ENC.encode(text, disallowed_special=()))

except ImportError:  # pragma: no cover - the fallback only changes the absolute numbers
    TOKENIZER = "characters / 4"

    def tokens(text: str) -> int:
        return (len(text) + 3) // 4


def load(dataset: Path) -> dict:
    """The dataset's family: every member (a directory with a `.keep-the-why` and a `context/`), its index and its
    topics; and every entry: id -> title, member, file ("member/topic.md"), fields."""
    entries, texts, indexes = {}, {}, {}
    for cfg in sorted(dataset.rglob(".keep-the-why")):
        ctx = cfg.parent / "context"
        if ".git" in cfg.parts or not ctx.is_dir():
            continue
        member = cfg.parent.relative_to(dataset).as_posix()
        member = "." if member in ("", ".") else member
        indexes[member] = (ctx / "index.md").read_text(encoding="utf-8")
        for p in sorted(ctx.glob("*.md")):
            if p.name in SKIP:
                continue
            key = f"{member}/{p.name}"
            texts[key] = p.read_text(encoding="utf-8")
            for e in parse_topic_text(texts[key]):
                f: dict[str, list[str]] = {}
                for fl in e.fields:
                    f.setdefault(fl.name, []).append(fl.value.strip())
                if "Id" in f:
                    entries[f["Id"][0]] = {
                        "title": e.title,
                        "member": member,
                        "file": key,
                        "fields": f,
                    }
    return {"entries": entries, "texts": texts, "indexes": indexes}


def ids_in(value: str) -> list[str]:
    import re

    return re.findall(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value
    )


def derive(rule: dict, entries: dict) -> list[str]:
    """Recompute a graph or filter question's expected ids from the dataset."""
    if "superseded_by_of" in rule:
        return ids_in(
            entries[rule["superseded_by_of"]]["fields"].get("Superseded by", [""])[0]
        )
    if "supersede_chain_from" in rule:
        chain, cur = [], rule["supersede_chain_from"]
        while cur and cur in entries and cur not in chain:
            chain.append(cur)
            nxt = ids_in(entries[cur]["fields"].get("Superseded by", [""])[0])
            cur = nxt[0] if nxt else None
        return chain
    if "see_of" in rule:
        see = [
            i
            for v in entries[rule["see_of"]]["fields"].get("See", [])
            for i in ids_in(v)
        ]
        return [
            i
            for i in see
            if i in entries
            and entries[i]["fields"].get("Type", [""])[0]
            == rule.get("type", entries[i]["fields"].get("Type", [""])[0])
        ]
    out = [
        k
        for k, e in entries.items()
        if all(e["fields"].get(f.capitalize(), [""])[0] == v for f, v in rule.items())
    ]
    return sorted(out)


def baseline(q: dict, data: dict) -> dict:
    """Today's way in a family: the start member's index and, by the skill's family rule, the other members'
    indexes, then the topic files that hold the answer — a lower bound, the right topics first time.
    """
    found = [data["entries"][i] for i in q["expected"] if i in data["entries"]]
    files = sorted({e["file"] for e in found})
    index = sum(tokens(t) for t in data["indexes"].values())
    return {
        "tokens": index + sum(tokens(data["texts"][f]) for f in files),
        "index_tokens": index,
        "files": len(files) + len(data["indexes"]),
        "start": q.get("start", "."),
        "answer_members": sorted({e["member"] for e in found}),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "data",
        type=Path,
        help="a directory of datasets made by make_dataset.py (x1, x5, x10, ...)",
    )
    ap.add_argument("--questions", type=Path, default=HERE / "questions.json")
    ap.add_argument("--out", type=Path, help="write summary.json and summary.md here")
    a = ap.parse_args(argv)
    questions = json.loads(a.questions.read_text(encoding="utf-8"))["questions"]
    report = {"tokenizer": TOKENIZER, "datasets": {}}
    problems = []
    for ds in sorted(p for p in a.data.iterdir() if (p / ".keep-the-why").is_file()):
        t0 = time.perf_counter()
        data = load(ds)
        load_s = time.perf_counter() - t0
        rows = []
        for q in questions:
            missing = [i for i in q["expected"] if i not in data["entries"]]
            if missing:
                problems.append(
                    f"{ds.name} {q['id']}: expected ids not in the dataset: {missing}"
                )
            if "rule" in q:
                again = derive(q["rule"], data["entries"])
                if sorted(again) != sorted(q["expected"]) and ds.name in ("x1",):
                    problems.append(
                        f"{ds.name} {q['id']}: the rule gives {again}, questions.json says {q['expected']}"
                    )
            rows.append(
                {"q": q["id"], "kind": q["kind"], "baseline": baseline(q, data)}
            )
        bt = [r["baseline"]["tokens"] for r in rows]
        members = {
            m: {
                "entries": sum(1 for e in data["entries"].values() if e["member"] == m),
                "topics": sum(1 for k in data["texts"] if k.startswith(m + "/")),
                "index_tokens": tokens(data["indexes"][m]),
            }
            for m in sorted(data["indexes"])
        }
        report["datasets"][ds.name] = {
            "entries": len(data["entries"]),
            "topics": len(data["texts"]),
            "bytes": sum(len(t.encode()) for t in data["texts"].values()),
            "members": members,
            "index_tokens": sum(m["index_tokens"] for m in members.values()),
            "parse_seconds": round(load_s, 3),
            "baseline": {
                "median_tokens": statistics.median(bt),
                "max_tokens": max(bt),
                "min_tokens": min(bt),
            },
            "rows": rows,
        }
    report["problems"] = problems
    first = next(iter(report["datasets"].values()), {"members": {}})
    names = sorted(first["members"])
    lines = [
        f"Tokenizer: {TOKENIZER}",
        "",
        "| dataset | entries | topics | KB | index tokens (all members) | baseline median | baseline max |",
        "|---|---|---|---|---|---|---|",
    ]
    for name, d in report["datasets"].items():
        lines.append(
            f"| {name} | {d['entries']} | {d['topics']} | {d['bytes'] // 1024} | {d['index_tokens']} | {d['baseline']['median_tokens']} | {d['baseline']['max_tokens']} |"
        )
    lines += [
        "",
        "Per member: entries / topics / index tokens",
        "",
        "| dataset | " + " | ".join(names) + " |",
        "|---|" + "---|" * len(names),
    ]
    for name, d in report["datasets"].items():
        cells = [
            f"{d['members'][m]['entries']} / {d['members'][m]['topics']} / {d['members'][m]['index_tokens']}"
            for m in names
        ]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    lines += ["", f"Problems: {len(problems)}"] + [f"- {p}" for p in problems]
    print("\n".join(lines))
    if a.out:
        a.out.mkdir(parents=True, exist_ok=True)
        (a.out / "summary.json").write_text(
            json.dumps(report, indent=1), encoding="utf-8"
        )
        (a.out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
