"""A prototype of `ktw`'s search commands, to measure: an entry-level index, filters and graph queries, ranked full
text (BM25), and optionally local embeddings — all over one cache of a family's entries.

    python ktw_proto.py PROJECT index [--member M]
    python ktw_proto.py PROJECT find [TEXT] [--type T] [--status S] [--member M] [-n 10] [--rank bm25|embed]
    python ktw_proto.py PROJECT show ID...
    python ktw_proto.py PROJECT graph ID [--depth N]
    python ktw_proto.py PROJECT cache [--rebuild]

PROJECT is any member of a family; the family is found from there (its root's children) as harness_offline.load
reads it, with the linter's parser. Output is one line per entry, `id · type/status · title · member/file:L1-L2`,
the shortest form that still lets an agent open the right lines; `--json` gives everything. The cache lives under
~/.cache/keep-the-why/ (or $KTW_CACHE), keyed on content: `git rev-parse HEAD:` of the family plus the bytes of every
modified or untracked file under its context directories, so any change to an entry rebuilds it, a second change to
an already modified file included.

This is an experiment, not the shipped tool: what wins here is built properly in `ktw`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import harness_offline  # noqa: E402  (the family loader, on the linter's parser)
from ktw_lint.entries import KNOWN_FIELDS  # noqa: E402

WORD = re.compile(r"[a-z0-9]+")
STOP = set(
    """a an and are as at be but by for from has have if in into is it its no not of on or so than that the their
    then there these this to was were when which while who why will with""".split()
)
K1, B = 1.2, 0.75
# an entry's metadata lines: the fields the linter knows, never the body labels the prose carries
META = re.compile(r"^\*\*(" + "|".join(re.escape(f) for f in KNOWN_FIELDS) + r"):\*\*")


def words(text: str) -> list[str]:
    return [w for w in WORD.findall(text.lower()) if w not in STOP and len(w) > 1]


def family_root(start: Path) -> Path:
    """The family's root: walk up while a parent directory's .keep-the-why names this one as a child."""
    p = start.resolve()
    while (p.parent / ".keep-the-why").is_file() and p.parent != p:
        p = p.parent
    return p


CONTEXT = [
    "context/**",
    "**/context/**",
]  # the members' context directories, as git pathspecs (glob)


def cache_key(root: Path) -> str:
    """What the cache was built from, by content: the committed tree, and every modified or untracked file under a
    member's context/ by its bytes (a deleted one by its absence). A second change to a file that was already
    dirty changes the key; `git status` alone would not, its line for the file stays the same.
    """
    h = hashlib.sha256()
    try:
        git = ["git", "-C", str(root)]
        h.update(
            subprocess.run(
                git + ["rev-parse", "HEAD:"], capture_output=True, text=True, check=True
            ).stdout.encode()
        )
        dirty = subprocess.run(
            git
            + ["status", "--porcelain", "-z", "--untracked-files=all", "--"]
            + [f":(glob){g}" for g in CONTEXT],
            capture_output=True,
            check=True,
        ).stdout.split(b"\0")
        paths = sorted({d[3:].decode() for d in dirty if len(d) > 3})
    except (
        OSError,
        subprocess.CalledProcessError,
    ):  # no git: every context file by content
        paths = sorted(
            str(p.relative_to(root))
            for g in CONTEXT
            for p in root.glob(g)
            if p.is_file()
        )
    for rel in paths:
        f = root / rel
        h.update(rel.encode() + b"\0")
        h.update(hashlib.sha256(f.read_bytes()).digest() if f.is_file() else b"deleted")
    return h.hexdigest()[:16]


def cache_dir(root: Path) -> Path:
    base = Path(os.environ.get("KTW_CACHE", Path.home() / ".cache" / "keep-the-why"))
    return base / hashlib.sha256(str(root).encode()).hexdigest()[:16]


def build(root: Path) -> dict:
    """Every entry of the family with its member, file, line range, fields and a gist; and the BM25 postings."""
    t0 = time.perf_counter()
    data = harness_offline.load(root)
    entries = {}
    for eid, e in data["entries"].items():
        lines = data["texts"][e["file"]].splitlines()
        start = next(
            i
            for i, l in enumerate(lines, 1)
            if l.startswith("## ") and l[3:].strip() == e["title"].strip()
        )
        end = next(
            (
                i
                for i in range(start, len(lines))
                if lines[i].startswith("## ") or lines[i].startswith("# ")
            ),
            len(lines),
        )
        # the prose: everything under the heading but the metadata lines (Id, Type, Status, Source, See, …); a
        # body label's line (Reason, Rejected alternative, Consequence, …) is prose and stays
        body = "\n".join(l for l in lines[start:end] if not META.match(l))
        f = e["fields"]
        gist = next((p.strip() for p in body.split("\n\n") if p.strip()), "")[:160]
        entries[eid] = {
            "title": e["title"],
            "member": e["member"],
            "file": e["file"],
            "lines": [start, end],
            # Type may be given more than once (several lines, context-schema 0.9.0): all of them, by membership
            "type": harness_offline.values(e, "Type"),
            "status": f.get("Status", [""])[0],
            "evidence": f.get("Evidence", [""])[0],
            "see": [i for v in f.get("See", []) for i in harness_offline.ids_in(v)],
            "superseded_by": [
                i for v in f.get("Superseded by", []) for i in harness_offline.ids_in(v)
            ],
            "gist": gist,
            "body": body,
            "text": "\n".join(lines[start - 1 : end]),
        }
    postings: dict[str, dict[str, int]] = defaultdict(dict)
    lengths = {}
    for eid, e in entries.items():
        # the title counts twice (the heading line is not in `body`), the prose once, the metadata not at all
        tf = Counter(words(e["title"] + " " + e["title"] + " " + e["body"]))
        lengths[eid] = sum(tf.values())
        for w, n in tf.items():
            postings[w][eid] = n
    return {
        "entries": entries,
        "postings": postings,
        "lengths": lengths,
        "build_seconds": time.perf_counter() - t0,
    }


def load(start: Path, rebuild: bool = False) -> tuple[dict, dict]:
    root = family_root(start)
    d = cache_dir(root)
    key = cache_key(root)
    path = d / f"{key}.json"
    info = {"root": str(root), "path": str(path), "hit": False}
    if path.is_file() and not rebuild:
        info["hit"] = True
        return json.loads(path.read_text(encoding="utf-8")), info
    c = build(root)
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("*.json"):
        old.unlink()
    path.write_text(json.dumps(c), encoding="utf-8")
    info["bytes"] = path.stat().st_size
    return c, info


def bm25(c: dict, query: str) -> list[tuple[str, float]]:
    n = len(c["entries"])
    avg = sum(c["lengths"].values()) / max(n, 1)
    scores: dict[str, float] = defaultdict(float)
    for w in set(words(query)):
        post = c["postings"].get(w)
        if not post:
            continue
        idf = math.log(1 + (n - len(post) + 0.5) / (len(post) + 0.5))
        for eid, tf in post.items():
            dl = c["lengths"][eid]
            scores[eid] += idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * dl / avg))
    return sorted(scores.items(), key=lambda kv: -kv[1])


EMBED_MODEL = os.environ.get("KTW_EMBED_MODEL", "minishlab/potion-base-8M")


def embed_rank(c: dict, info: dict, query: str) -> list[tuple[str, float]]:
    """Cosine similarity of the query to every entry (title + text), with a static model2vec model; the vectors are
    kept beside the cache, keyed like it."""
    import numpy as np
    from model2vec import StaticModel

    vec_path = Path(info["path"]).with_suffix(".npy")
    ids = sorted(c["entries"])
    model = StaticModel.from_pretrained(EMBED_MODEL)
    if vec_path.is_file():
        vecs = np.load(vec_path)
    else:
        t0 = time.perf_counter()
        vecs = model.encode(
            [
                c["entries"][i]["title"] + "\n" + c["entries"][i]["text"][:2000]
                for i in ids
            ]
        )
        vecs = vecs / (np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-9)
        np.save(vec_path, vecs)
        info["embed_seconds"] = time.perf_counter() - t0
    q = model.encode([query])[0]
    q = q / (np.linalg.norm(q) + 1e-9)
    sims = vecs @ q
    order = np.argsort(-sims)
    return [(ids[k], float(sims[k])) for k in order]


def matches(e: dict, a) -> bool:
    return (
        (not a.type or a.type in e["type"])
        and (not a.status or e["status"] == a.status)
        and (not a.member or e["member"] == a.member)
    )


def line(eid: str, e: dict) -> str:
    return f"{eid} · {'+'.join(e['type'])}/{e['status']} · {e['title']} · {e['file']}:{e['lines'][0]}-{e['lines'][1]}"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("project", type=Path)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("index", "find"):
        s = sub.add_parser(name)
        s.add_argument("text", nargs="?", default="")
        s.add_argument("--type")
        s.add_argument("--status")
        s.add_argument("--member")
        s.add_argument("-n", type=int, default=10)
        s.add_argument("--rank", choices=("bm25", "embed"), default="bm25")
    s = sub.add_parser("show")
    s.add_argument("ids", nargs="+")
    s = sub.add_parser("graph")
    s.add_argument("id")
    s.add_argument("--depth", type=int, default=2)
    s = sub.add_parser("cache")
    s.add_argument("--rebuild", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    c, info = load(a.project, rebuild=getattr(a, "rebuild", False))
    E = c["entries"]
    if a.cmd == "cache":
        print(
            json.dumps(
                {
                    **info,
                    "entries": len(E),
                    "build_seconds": round(c["build_seconds"], 3),
                }
            )
        )
        return 0
    if a.cmd == "index":
        out = [(i, e) for i, e in E.items() if matches(e, a)]
        print(
            "\n".join(
                f"{i} · {'+'.join(e['type'])}/{e['status']} · {e['title']} · {e['file']}"
                for i, e in out
            )
        )
        return 0
    if a.cmd == "find":
        if not a.text:
            ranked = [(i, 0.0) for i in E]
        else:
            ranked = (
                embed_rank(c, info, a.text) if a.rank == "embed" else bm25(c, a.text)
            )
        hits = [(i, s) for i, s in ranked if matches(E[i], a)][: a.n]
        if a.json:
            print(
                json.dumps(
                    [
                        {
                            "id": i,
                            "score": round(s, 3),
                            **{k: v for k, v in E[i].items() if k != "text"},
                        }
                        for i, s in hits
                    ]
                )
            )
        else:
            print("\n".join(line(i, E[i]) for i, _ in hits))
        return 0
    if a.cmd == "show":
        print(
            "\n\n".join(
                E[i]["text"] if i in E else f"{i}: no such entry" for i in a.ids
            )
        )
        return 0
    if a.cmd == "graph":
        back: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for i, e in E.items():
            for t in e["see"]:
                back[t].append(("cited by", i))
            for t in e["superseded_by"]:
                back[t].append(("supersedes", i))
        seen, frontier, out = {a.id}, [a.id], []
        for depth in range(a.depth):
            nxt = []
            for i in frontier:
                e = E.get(i)
                edges = (
                    (
                        [("see", t) for t in e["see"]]
                        + [("superseded by", t) for t in e["superseded_by"]]
                    )
                    if e
                    else []
                )
                for rel, t in edges + back.get(i, []):
                    out.append(
                        f"{'  ' * depth}{i[:8]} {rel} → "
                        + (line(t, E[t]) if t in E else t)
                    )
                    if t not in seen:
                        seen.add(t)
                        nxt.append(t)
            frontier = nxt
        print("\n".join(out))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
