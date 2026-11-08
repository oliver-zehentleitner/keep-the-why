"""BM25F with field weights tuned on held-out questions, and a two-step search, offline on every dataset.

The fields of an entry:

- title: its heading;
- prose: everything under the heading but the metadata lines (as ktw_proto.py's BM25 reads it);
- topic: its member, its topic file's heading, and that topic's line in the member's index (the description the
  index gives every topic file).

BM25F (Robertson, Zaragoza, Taylor 2004): a term's frequency is summed over the fields, each field's weighted and
normalised by its own length, before the one saturation with k1. The parameters (k1, the title's and the topic's
weight against prose 1, and b per field) are chosen on a grid by MRR on one half of the text questions and measured
on the other half, then the halves swap: every reported number is on questions the parameters were not chosen on.
The halves are fixed (alternating by question id); the grid's best on all questions is reported beside them, as the
ceiling tuning could reach, never as a result.

The two-step search: the first step is a ranked search; the topics of its best three hits are the second step's
scope, and the second step ranks the entries of those topics alone with the same query, its IDF counted inside the
scope. It stands for an agent that searches broadly, sees where the hits are, and searches again within those
topics. The tokens: both steps' hit lists (10 lines each) plus `show` of the first expected hit in the second step's
top ten, or of its first hit on a miss; a lower bound like harness_candidates.py's, since the harness knows which
hit is right.

    python harness_bm25f.py DATA_DIR [--out results/DATE] [--sets x1,x10]
"""

from __future__ import annotations

import argparse
import itertools
import json
import math
import os
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import harness_candidates as C  # noqa: E402
import harness_offline as H  # noqa: E402
import ktw_proto as P  # noqa: E402

FIELDS = ("title", "prose", "topic")
GRAPH_KINDS = (
    "filter",
    "supersedes",
    "see",
    "thought-chain",
)  # as harness_candidates.py leaves them out
GRID = {
    "k1": (0.9, 1.2, 1.6, 2.0),
    "w_title": (1, 2, 3, 5, 8),
    "w_topic": (0, 0.5, 1, 2, 4),
    "b_title": (0.3, 0.75),
    "b_prose": (0.5, 0.75, 0.9),
    "b_topic": (0.3, 0.75),
}
# ktw_proto.py's BM25 is one bag (the title twice, the prose once, one length); the `bm25` row ranks with it as it
# is. Its second step needs a scope, so it uses these parameters in BM25F form there: the same k1 and b, the title
# weighted 2, no topic field.
BASELINE = {
    "k1": P.K1,
    "w_title": 2,
    "w_topic": 0,
    "b_title": P.B,
    "b_prose": P.B,
    "b_topic": P.B,
}
INDEX_LINE = re.compile(r"^- \[([^\]]+\.md)\]\([^)]+\)\s*[—–-]\s*(.*)$")


def topic_texts(data: dict) -> dict[str, str]:
    """member/file -> the member, the topic file's heading and its line in the member's index."""
    out = {}
    for key, text in data["texts"].items():
        member, name = key.rsplit("/", 1)
        h1 = next((l[2:] for l in text.splitlines() if l.startswith("# ")), "")
        desc = next(
            (
                m.group(2)
                for l in data["indexes"].get(member, "").splitlines()
                if (m := INDEX_LINE.match(l.strip())) and m.group(1) == name
            ),
            "",
        )
        out[key] = f"{member} {h1} {desc}"
    return out


class Index:
    """Per field, per term: the entries it occurs in and how often; per field, every entry's length."""

    def __init__(self, cache: dict, data: dict):
        E = cache["entries"]
        self.ids = sorted(E)
        self.pos = {i: n for n, i in enumerate(self.ids)}
        self.file = np.array([E[i]["file"] for i in self.ids])
        topics = topic_texts(data)
        bags = {
            "title": [Counter(P.words(E[i]["title"])) for i in self.ids],
            "prose": [Counter(P.words(E[i]["body"])) for i in self.ids],
            "topic": [Counter(P.words(topics.get(E[i]["file"], ""))) for i in self.ids],
        }
        self.len = {
            f: np.array([sum(b.values()) for b in bags[f]], float) for f in FIELDS
        }
        self.post: dict[str, dict[str, tuple[np.ndarray, np.ndarray]]] = {
            f: {} for f in FIELDS
        }
        for f in FIELDS:
            acc: dict[str, tuple[list, list]] = {}
            for n, b in enumerate(bags[f]):
                for w, c in b.items():
                    a = acc.setdefault(w, ([], []))
                    a[0].append(n)
                    a[1].append(c)
            self.post[f] = {
                w: (np.array(r, int), np.array(c, float)) for w, (r, c) in acc.items()
            }

    def score(self, query: str, p: dict, scope: np.ndarray | None = None) -> list[str]:
        """The entries by BM25F score, best first; with a scope (a boolean mask), only those, IDF inside it."""
        n_all = len(self.ids)
        mask = scope if scope is not None else np.ones(n_all, bool)
        n = int(mask.sum())
        avg = {f: max(self.len[f][mask].mean(), 1e-9) if n else 1.0 for f in FIELDS}
        w = {"title": p["w_title"], "prose": 1.0, "topic": p["w_topic"]}
        b = {"title": p["b_title"], "prose": p["b_prose"], "topic": p["b_topic"]}
        total = np.zeros(n_all)
        for term in set(P.words(query)):
            tf = np.zeros(n_all)
            for f in FIELDS:
                if not w[f] or term not in self.post[f]:
                    continue
                rows, cnt = self.post[f][term]
                norm = 1 - b[f] + b[f] * self.len[f][rows] / avg[f]
                np.add.at(tf, rows, w[f] * cnt / norm)
            tf[~mask] = 0
            df = int((tf > 0).sum())
            if not df:
                continue
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            total += idf * tf * (p["k1"] + 1) / (tf + p["k1"])
        order = np.argsort(-total, kind="stable")
        return [self.ids[k] for k in order if total[k] > 0]


def configs():
    keys = list(GRID)
    for vals in itertools.product(*(GRID[k] for k in keys)):
        yield dict(zip(keys, vals))


def two_step(ix: Index, query: str, p: dict, first: list[str]) -> list[str]:
    topics = {ix.file[ix.pos[i]] for i in first[:3]}
    scope = np.isin(ix.file, list(topics))
    return ix.score(query, p, scope)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("data", type=Path)
    ap.add_argument("--questions", type=Path, default=HERE / "questions.json")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--sets", default="x1,x5,x10,x10-identical")
    a = ap.parse_args(argv)
    os.environ.setdefault("KTW_CACHE", "/var/tmp/ktw-context-search-cache")
    questions = [
        q
        for q in json.loads(a.questions.read_text(encoding="utf-8"))["questions"]
        if q["kind"] not in GRAPH_KINDS
    ]
    halves = [questions[0::2], questions[1::2]]
    report = {
        "grid": GRID,
        "halves": [[q["id"] for q in h] for h in halves],
        "sets": {},
    }
    for name in a.sets.split(","):
        ds = a.data / name
        cache, _ = P.load(ds)
        data = H.load(ds)
        ids_map = json.loads((ds / "ids.json").read_text(encoding="utf-8"))
        identical = ids_map["mode"] == "identical"
        ix = Index(cache, data)
        E = cache["entries"]

        def groups(q):
            return [
                {i} | (set(ids_map["ids"].get(i, [])) if identical else set())
                for i in H.expected_in(q, data)
            ]

        def mrr(p, qs):
            return statistics.mean(
                C.ranks(ix.score(q["question"], p), groups(q))["mrr"] for q in qs
            )

        # tune on one half, measure on the other, and swap
        held = {}
        chosen = []
        for k in (0, 1):
            tune, test = halves[k], halves[1 - k]
            best = max(configs(), key=lambda p: mrr(p, tune))
            chosen.append(best)
            for q in test:
                held[q["id"]] = best
        ceiling = max(configs(), key=lambda p: mrr(p, questions))

        def measure(params_of, step2: bool, plain: bool = False):
            rows = []
            for q in questions:
                p = params_of(q)
                g = groups(q)
                order = (
                    [i for i, _ in P.bm25(cache, q["question"])]
                    if plain
                    else ix.score(q["question"], p)
                )
                lines = "\n".join(P.line(i, E[i]) for i in order[:10])
                if step2:
                    order2 = two_step(ix, q["question"], p, order)
                    lines += "\n" + "\n".join(P.line(i, E[i]) for i in order2[:10])
                    order = order2
                r = C.ranks(order, g)
                wanted = set().union(*g)
                shown = next((i for i in order[:10] if i in wanted), None)
                read = shown or (order[0] if order else None)
                r["tokens"] = H.tokens(lines) + (
                    H.tokens(E[read]["text"]) if read else 0
                )
                r["hit"] = shown is not None
                rows.append(r)
            return {
                **{
                    f"recall@{k}": round(
                        statistics.mean(x[f"recall@{k}"] for x in rows), 3
                    )
                    for k in C.KS
                },
                "mrr": round(statistics.mean(x["mrr"] for x in rows), 3),
                "median_tokens": statistics.median(x["tokens"] for x in rows),
            }

        report["sets"][name] = {
            "chosen": chosen,
            "ceiling": ceiling,
            "bm25": measure(lambda q: BASELINE, False, plain=True),
            "bm25f": measure(lambda q: held[q["id"]], False),
            "bm25f_ceiling": measure(lambda q: ceiling, False),
            "bm25_2step": measure(lambda q: BASELINE, True, plain=True),
            "bm25f_2step": measure(lambda q: held[q["id"]], True),
        }
        print(name, json.dumps(report["sets"][name]), flush=True)
    rows = ("bm25", "bm25f", "bm25_2step", "bm25f_2step", "bm25f_ceiling")
    lines = [
        f"Tokenizer: {H.TOKENIZER}",
        "",
        "Text questions only, the question as the query: recall@1 / @5 / @10, MRR, median tokens (a lower bound: "
        "the hit lists read plus `show` of the first expected hit). bm25f is measured on the half of the questions "
        "its parameters were not chosen on; bm25f ceiling is the grid's best on all questions, for scale only.",
        "",
        "| dataset | " + " | ".join(rows) + " |",
        "|---|" + "---|" * len(rows),
    ]
    for name, d in report["sets"].items():
        cells = [
            f"{d[r]['recall@1']:.2f} / {d[r]['recall@5']:.2f} / {d[r]['recall@10']:.2f}, {d[r]['mrr']:.2f}, {d[r]['median_tokens']}"
            for r in rows
        ]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    lines += [
        "",
        "Parameters chosen per half (tuned on half 1 → used on half 2, and back), and the ceiling's:",
        "",
    ]
    for name, d in report["sets"].items():
        lines.append(
            f"- {name}: {d['chosen'][0]}; {d['chosen'][1]}; ceiling {d['ceiling']}"
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
