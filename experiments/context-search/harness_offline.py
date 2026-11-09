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
import re
import statistics
import sys
import time
from pathlib import Path

try:
    from ktw_lint.entries import parse_topic_text
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lint"))
    from ktw_lint.entries import parse_topic_text
from ktw_lint.checks import (
    _split_value,
)  # a field value's head, as the linter splits it

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


# The fields an entry may carry more than once, by the linter: Type (several lines since context-schema 0.9.0) and
# See. Id, Status, Evidence and Superseded by are single (E112, "more than one … line"). A rule on a repeatable field
# matches by membership, never on the first line alone.
REPEATABLE = {"Type", "See"}


def values(e: dict, field: str) -> list[str]:
    """Every value of a field, its head only (`undefined — reason` is `undefined`), as the linter reads it."""
    return [_split_value(v)[0] for v in e["fields"].get(field, [])]


def matches(e: dict, field: str, want: str) -> bool:
    got = values(e, field)
    return want in got if field in REPEATABLE else got[:1] == [want]


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
            and ("type" not in rule or matches(entries[i], "Type", rule["type"]))
        ]
    out = [
        k
        for k, e in entries.items()
        if all(matches(e, f.capitalize(), v) for f, v in rule.items())
    ]
    return sorted(out)


FILTER_RULE_KEYS = {"type", "status", "evidence"}


def raw_count(rule: dict, data: dict) -> int:
    """The entries a one-field filter rule matches, counted as `**Field:** value` lines in the topic files' text."""
    ((field, want),) = rule.items()
    line = re.compile(
        r"^\*\*"
        + field.capitalize()
        + r":\*\*\s*"
        + re.escape(want)
        + r"(?:\s*[—–-]\s.*)?\s*$",
        re.M,
    )
    return sum(len(line.findall(text)) for text in data["texts"].values())


def expected_in(q: dict, data: dict) -> list[str]:
    """The answer in this dataset. A filter question ("every incident") is answered by every entry the filter
    matches, the copies' included — a copy is a full entry of the family, and nothing in it says it is one. Every
    other question is answered by the original entries it names, which every dataset holds.
    """
    rule = q.get("rule") or {}
    if rule and set(rule) <= FILTER_RULE_KEYS:
        return derive(rule, data["entries"])
    return q["expected"]


STOP_Q = set(
    """a an and are as at be but by can does did do for from has have how if in into is it its no not of on or so
    than that the their then there these this to was what when where which while who why will with would should
    could after before about any ever every one ones own maity""".split()
)


def content_words(text: str) -> set[str]:
    import re

    return {
        w[:-1] if w.endswith("s") and len(w) > 4 else w
        for w in re.findall(r"[a-z0-9]+", text.lower())
        if len(w) > 2 and w not in STOP_Q
    }


LEAK_LIMIT = 0.4  # the share of an expected title's content words a question may repeat


def leak(q: dict, data: dict) -> float:
    """How much of the expected entry's title the question repeats: the share of the title's content words that
    appear in the question (stop words out, a trailing plural s folded). Graph and filter questions name their
    starting point or their filter on purpose and are not held to the limit."""
    qw = content_words(q["question"])
    shares = []
    for i in q["expected"]:
        if i in data["entries"]:
            tw = content_words(data["entries"][i]["title"])
            if tw:
                shares.append(len(qw & tw) / len(tw))
    return round(max(shares), 2) if shares else 0.0


def baseline(q: dict, data: dict) -> dict:
    """Today's way in a family: the start member's index and, by the skill's family rule, the other members'
    indexes, then the topic files that hold the answer — a lower bound, the right topics first time.
    """
    found = [data["entries"][i] for i in expected_in(q, data) if i in data["entries"]]
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
            # every set: a graph rule must give the question's Ids again; a filter rule, on the original set,
            # the Ids questions.json names (on a copied set it is the answer itself, see expected_in)
            if "rule" in q and (
                not set(q["rule"]) <= FILTER_RULE_KEYS or ds.name == "x1"
            ):
                again = derive(q["rule"], data["entries"])
                if sorted(again) != sorted(q["expected"]):
                    problems.append(
                        f"{ds.name} {q['id']}: the rule gives {again}, questions.json says {q['expected']}"
                    )
            # a filter's answer, counted a second way and outside the parser: its field lines in the raw text.
            # Each rule field occurs at most once per entry with a given value (E109 for Type, E112 for the single
            # fields), so the lines are as many as the entries.
            if q.get("rule") and set(q["rule"]) <= FILTER_RULE_KEYS:
                raw = raw_count(q["rule"], data)
                if raw != len(expected_in(q, data)):
                    problems.append(
                        f"{ds.name} {q['id']}: {len(expected_in(q, data))} entries match, the raw text has {raw}"
                    )
            share = leak(q, data)
            held = q["kind"] not in ("supersedes", "see", "thought-chain", "filter")
            if held and share > LEAK_LIMIT and ds.name == "x1":
                problems.append(
                    f"{q['id']}: the question repeats {share:.0%} of its answer's title (limit {LEAK_LIMIT:.0%})"
                )
            rows.append(
                {
                    "q": q["id"],
                    "kind": q["kind"],
                    "expected": len(expected_in(q, data)),
                    "leak": share if held else None,
                    "baseline": baseline(q, data),
                }
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
    x1 = report["datasets"].get("x1")
    if x1:
        lines += [
            "",
            f"Answer leak: the share of the expected title's content words the question repeats (limit {LEAK_LIMIT:.0%}; graph and filter questions not held)",
            "",
            "| question | kind | leak |",
            "|---|---|---|",
        ] + [
            f"| {r['q']} | {r['kind']} | {'—' if r['leak'] is None else f'{r["leak"]:.0%}'} |"
            for r in x1["rows"]
        ]
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
