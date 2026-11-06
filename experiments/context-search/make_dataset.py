"""Build a context-search dataset from a project's context/: the original plus N copies.

Every copy gets new entry Ids (uuid5 of the old Id and the copy number, so a build is reproducible), new topic
file names and anchors, and its See / Superseded by references and inline locators rewritten into the same copy,
so the graph stays valid and nothing points across copies. Ids and files the source does not own (another
project's references) are left as they are.

Two modes:

- vocab (the primary dataset): each copy also renames the domain vocabulary, the most frequent words of the topic
  and entry titles, through a deterministic map of made-up words. A copy reads like the original but does not
  answer a question about it, so the one right answer stays the original entry: the realistic case of many
  similar entries and one correct one.
- identical (an offline control only): copies keep the original text, so every copy answers like the original.
  It separates what size costs from what telling entries apart costs.

    python make_dataset.py SRC_PROJECT OUT_DIR --copies 4 --mode vocab

SRC_PROJECT is the root of a family (its `.keep-the-why` names the children). OUT_DIR gets the same layout: every
member's `.keep-the-why` as it is, its `context/` with its own topics and their copies and a regenerated index.md,
and OUT_DIR/ids.json (every original Id with its Ids in the copies, and the member it lives in). One Id map serves
the whole family per copy, so a reference from one member into another stays inside the copy. --copies 0 copies
the source as it is (the ×1 set). Every member must pass `ktw-lint --strict`.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import shutil
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
try:
    from ktw_lint import checks as lint_checks
    from ktw_lint.entries import KNOWN_FIELDS, anchor, parse_topic_text
except ImportError:  # run from the repository without the linter installed
    sys.path.insert(0, str(REPO / "lint"))
    from ktw_lint import checks as lint_checks
    from ktw_lint.entries import KNOWN_FIELDS, anchor, parse_topic_text

NAMESPACE = uuid.UUID("6f1c2a5e-6b1e-4f0e-9a4d-2c7b5e1d3a90")
SKIP = {"index.md", "README.md", "AGENTS.md", "CLAUDE.md"}
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"
)
LOCATOR_RE = re.compile(r"\b([a-z0-9][a-z0-9._-]*\.md)#([A-Za-z0-9_-]+)")
URL_RE = re.compile(r"https?://[^\s)>\]`]+")
FILE_RE = re.compile(r"\b([a-z0-9][a-z0-9._-]*\.md)\b")
WORD_RE = re.compile(r"[A-Za-z][a-z]+")
STOP = set(
    """about after again against also always another anything because been before being between both cannot
    could does doing done down during each either else every first from have here into itself just keeps last
    least less like made make many more most much must never next none only other over same shall should since
    some still such than that their them then there these they this those though through under until upon very
    what when where whether which while whom whose will with within without would your yours once ones gets""".split()
)


def format_words() -> set[str]:
    """The words the entry format itself uses, taken from where the format is defined, not listed here: the
    linter's field names and fixed values, and the body labels the dashboard's state parser reads (Reason,
    Considered, Why this needs an answer, ...). They stay in a copy, or it would not lint or parse alike.
    """
    words = set()
    for name in KNOWN_FIELDS:
        words.update(WORD_RE.findall(name.lower()))
    for values in (
        lint_checks.TYPE_VALUES,
        lint_checks.STATUS_VALUES,
        lint_checks.EVIDENCE_VALUES,
        lint_checks.VERIFICATION_VALUES,
    ):
        for v in values:
            words.update(WORD_RE.findall(v.lower()))
    state = (REPO / "dashboard" / "ktw_dashboard" / "state.py").read_text(
        encoding="utf-8"
    )
    labels = re.search(r"_LABEL_RE = re\.compile\(\s*r\"\^\\\*\\\*\(([^)]*)\)", state)
    for label in (labels.group(1).split("|") if labels else []):
        words.update(WORD_RE.findall(label.lower()))
    words |= {"undefined", "none"}
    return words | {
        w + "s" for w in words
    }  # a plural ("alternatives") is the same word


FORMAT = format_words()
CONSONANTS, VOWELS = "bdfgklmnprstvz", "aeiou"


def pseudo(term: str, copy: int) -> str:
    """A made-up word for `term` in copy `copy`: pronounceable, deterministic, about as long as the term."""
    h = hashlib.sha256(f"{term}|{copy}".encode()).digest()
    syllables = max(2, (len(term) + 2) // 3)
    return "".join(
        CONSONANTS[h[2 * i] % len(CONSONANTS)] + VOWELS[h[2 * i + 1] % len(VOWELS)]
        for i in range(syllables)
    )


def vocabulary(topics: dict[str, str], size: int) -> list[str]:
    """The domain words: the most frequent words of the topic and entry titles, stop words left out."""
    counts = collections.Counter()
    for text in topics.values():
        for line in text.splitlines():
            if line.startswith("# ") or line.startswith("## "):
                counts.update(
                    w.lower()
                    for w in WORD_RE.findall(line)
                    if len(w) >= 4 and w.lower() not in STOP | FORMAT
                )
    return [w for w, _ in counts.most_common(size)]


def word_map(terms: list[str], copy: int) -> dict[str, str]:
    m = {t: pseudo(t, copy) for t in terms}
    for (
        t
    ) in terms:  # a plural follows its singular, so "card" and "cards" stay one word
        if t.endswith("s") and t[:-1] in m:
            m[t] = m[t[:-1]] + "s"
    return m


def apply_words(text: str, m: dict[str, str]) -> str:
    def one(match):
        w = match.group(0)
        new = m.get(w.lower())
        if new is None:
            return w
        return (
            new.upper()
            if w.isupper() and len(w) > 1
            else new.capitalize() if w[0].isupper() else new
        )

    return WORD_RE.sub(one, text)


def rewrite(
    text: str,
    words: dict[str, str] | None,
    ids: dict[str, str],
    files: dict[str, str],
    anchors: dict,
) -> str:
    """Rename the vocabulary outside Ids, locators and file names; then map those into the copy."""
    held: list[str] = []

    def hold(s: str) -> str:
        held.append(s)
        return f"\x00{len(held) - 1}\x00"

    def locator(m):
        f, a = m.group(1), m.group(2)
        if f in files:
            return hold(f"{files[f]}#{anchors.get((f, a), a)}")
        return hold(m.group(0))

    # a URL (a canonical, an external reference) is a name, never vocabulary
    text = URL_RE.sub(lambda m: hold(m.group(0)), text)
    text = LOCATOR_RE.sub(locator, text)
    text = UUID_RE.sub(lambda m: hold(ids.get(m.group(0), m.group(0))), text)
    text = FILE_RE.sub(lambda m: hold(files.get(m.group(1), m.group(1))), text)
    if words:
        text = apply_words(text, words)
    return re.sub(r"\x00(\d+)\x00", lambda m: held[int(m.group(1))], text)


def index_lines(text: str) -> dict[str, str]:
    out = {}
    for line in text.splitlines():
        m = re.match(r"- \[([^\]]+\.md)\]\(([^)]+)\)(.*)", line)
        if m:
            out[m.group(1)] = m.group(3)
    return out


def family(root: Path) -> list[tuple[str, Path]]:
    """The project at `root` and the members its `keep-the-why:children` block names: (location, directory)."""
    out = [(".", root)]
    text = (root / ".keep-the-why").read_text(encoding="utf-8")
    block = re.search(
        r"<!-- keep-the-why:children -->(.*?)<!-- /keep-the-why:children -->",
        text,
        re.S,
    )
    for m in re.finditer(r"^- [^:]+: (\S+)", block.group(1) if block else "", re.M):
        if (
            not m.group(1).startswith("http")
            and (root / m.group(1) / ".keep-the-why").exists()
        ):
            out.append((m.group(1), root / m.group(1)))
    return out


def topics_of(member: Path) -> dict[str, str]:
    ctx = member / "context"
    return {
        p.name: p.read_text(encoding="utf-8")
        for p in sorted(ctx.glob("*.md"))
        if p.name not in SKIP
    }


def write_index(src_index: Path, dst: Path, lines: list[tuple[str, str]]) -> None:
    """The member's index: its own heading and introduction, then every topic, originals and copies, A–Z."""
    text = (
        src_index.read_text(encoding="utf-8")
        if src_index.exists()
        else "# Context index\n"
    )
    head = text.split("\n## 0", 1)[0].rstrip("\n")
    heads = [str(d) for d in range(10)] + [
        chr(c) for c in range(ord("A"), ord("Z") + 1)
    ]
    body = [head, ""]
    for h in heads:
        body.append(f"## {h}")
        body += [f"- [{f}]({f}){d}" for f, d in sorted(lines) if f[0].upper() == h]
        body.append("")
    dst.write_text("\n".join(body), encoding="utf-8")


SEE_LINE = re.compile(
    r"(https?://\S+)\s+[—–-]\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
)


def check_canonicals(out: Path, family_ids: set[str]) -> int:
    """Every reference by canonical to an entry of the family must name a member's canonical, in every copy: a
    reference the vocabulary map bent would still lint (as a reference to another repository), but it would point
    outside the family. Returns the number checked; raises on the first that does not resolve.
    """
    canonicals = set()
    for cfg in out.rglob(".keep-the-why"):
        m = re.search(r"^- canonical: (\S+)", cfg.read_text(encoding="utf-8"), re.M)
        if m:
            canonicals.add(m.group(1).rstrip("/"))
    checked = 0
    for p in out.rglob("context/*.md"):
        for url, uid in SEE_LINE.findall(p.read_text(encoding="utf-8")):
            if uid in family_ids:
                checked += 1
                if url.rstrip("/") not in canonicals:
                    raise SystemExit(
                        f"{p}: a reference to {uid} names {url}, not a member's canonical {sorted(canonicals)}"
                    )
    return checked


def build(src: Path, out: Path, copies: int, mode: str, vocab_size: int) -> dict:
    """The family at `src` (its root's `.keep-the-why`), every member with its copies beside its own topics."""
    members = family(src)
    topics = {loc: topics_of(d) for loc, d in members}
    index = {
        loc: (
            index_lines((d / "context" / "index.md").read_text(encoding="utf-8"))
            if (d / "context" / "index.md").exists()
            else {}
        )
        for loc, d in members
    }
    every = {f"{loc}/{f}": text for loc, ts in topics.items() for f, text in ts.items()}
    terms = vocabulary(every, vocab_size) if mode == "vocab" else []
    if out.exists():
        shutil.rmtree(out)
    ids_out: dict[str, list[str]] = collections.defaultdict(list)
    member_of: dict[str, str] = {}
    lines: dict[str, list[tuple[str, str]]] = {loc: [] for loc, _ in members}
    for loc, d in members:
        (out / loc / "context").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(d / ".keep-the-why", out / loc / ".keep-the-why")
        for name in ("README.md", "AGENTS.md", "CLAUDE.md"):
            if (d / "context" / name).exists():
                shutil.copyfile(d / "context" / name, out / loc / "context" / name)
    for k in range(copies + 1):
        words = word_map(terms, k) if (mode == "vocab" and k) else None
        # one Id map for the whole family, so a reference from one member to another stays inside the copy
        ids: dict[str, str] = {}
        files: dict[str, dict[str, str]] = {}
        anchors: dict[str, dict] = {}
        for loc, ts in topics.items():
            files[loc] = {
                f: (
                    f
                    if k == 0
                    else f"{(apply_words(f[:-3], words) if words else f[:-3])}-k{k}.md".lower()
                )
                for f in ts
            }
            anchors[loc] = {}
            for f, text in ts.items():
                for e in parse_topic_text(text):
                    eid = next(
                        (fl.value.strip() for fl in e.fields if fl.name == "Id"), None
                    )
                    if eid:
                        ids[eid] = (
                            eid if k == 0 else str(uuid.uuid5(NAMESPACE, f"{eid}|{k}"))
                        )
                        ids_out[eid].append(ids[eid])
                        member_of[eid] = loc
                    new_title = apply_words(e.title, words) if words else e.title
                    anchors[loc][(f, anchor(e.title))] = anchor(new_title)
        for loc, ts in topics.items():
            for f, text in ts.items():
                (out / loc / "context" / files[loc][f]).write_text(
                    rewrite(text, words, ids, files[loc], anchors[loc]) if k else text,
                    encoding="utf-8",
                )
                desc = index[loc].get(f, "")
                lines[loc].append(
                    (
                        files[loc][f],
                        (
                            rewrite(desc, words, ids, files[loc], anchors[loc])
                            if k
                            else desc
                        ),
                    )
                )
    for loc, d in members:
        write_index(
            d / "context" / "index.md", out / loc / "context" / "index.md", lines[loc]
        )
    # a repository, as the family is one: the members' `parent: ..` is checked against the git toplevel, and the
    # search tool's cache is keyed on the tree of context/
    import subprocess

    subprocess.run(["git", "init", "-q", str(out)], check=True)
    subprocess.run(["git", "-C", str(out), "add", "-A"], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(out),
            "-c",
            "user.name=dataset",
            "-c",
            "user.email=dataset@example.invalid",
            "commit",
            "-q",
            "-m",
            "dataset",
        ],
        check=True,
    )
    (out / "ids.json").write_text(
        json.dumps(
            {
                "mode": mode,
                "copies": copies,
                "vocabulary": terms,
                "member": member_of,
                "ids": ids_out,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    canonical_refs = check_canonicals(out, {i for lst in ids_out.values() for i in lst})
    per = {
        loc: {
            "topics": len(ts) * (copies + 1),
            "entries": sum(1 for i in member_of if member_of[i] == loc) * (copies + 1),
        }
        for loc, ts in topics.items()
    }
    return {
        "members": per,
        "entries": sum(len(v) for v in ids_out.values()),
        "vocabulary": len(terms),
        "canonical_references": canonical_refs,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "src",
        type=Path,
        help="the source project: the root of its family (the directory of its .keep-the-why)",
    )
    ap.add_argument("out", type=Path, help="the dataset directory to write (replaced)")
    ap.add_argument(
        "--copies",
        type=int,
        default=0,
        help="copies beside the original: 0, 4 or 9 for ×1, ×5, ×10",
    )
    ap.add_argument("--mode", choices=("vocab", "identical"), default="vocab")
    ap.add_argument(
        "--vocabulary",
        type=int,
        default=150,
        help="how many title words a vocab copy renames",
    )
    a = ap.parse_args(argv)
    print(json.dumps(build(a.src, a.out, a.copies, a.mode, a.vocabulary)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
