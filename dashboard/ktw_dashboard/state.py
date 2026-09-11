"""Builds the dashboard state: one JSON-serializable dict describing the
project as it is on disk and in Git right now.

The linter is the parser — `.keep-the-why` and every entry go through
`ktw_lint`, so the dashboard shows exactly what the linter accepts. This
module adds three things on top: entry bodies (the linter only keeps the
header fields), cross-references between topics, and Git attribution.

The state is a cache with an expiry of "the next change", not a store: it
lives in the server's memory (or in an exported page) and is rebuilt from
Markdown and Git whenever the project's fingerprint changes.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone

from ktw_lint import __version__ as LINT_VERSION
from ktw_lint.checks import Linter
from ktw_lint.cli import _load_config
from ktw_lint.entries import parse_topic_text
from ktw_lint.findings import ERROR

from . import __version__, gitinfo

GUARD_FILES = {"index.md", "README.md", "AGENTS.md", "CLAUDE.md"}
_H1_RE = re.compile(r"^#\s+(.*?)\s*$")
_INDEX_LINE_RE = re.compile(r"^\s*-\s*\[[^\]]+\]\(([^)]+)\)\s*(?:—|-|–)?\s*(.*)$")
_FIELD_RE = re.compile(
    r"^\*\*(Type|Status|Evidence|Source|Verification|Revisit when):\*\*\s*(.*?)\s*$"
)
_LABEL_RE = re.compile(
    r"^\*\*(Reason|Rejected alternative|Consequence|Considered|Why this needs an answer):\*\*\s*(.*)$"
)
_REF_RE = re.compile(r"`?([A-Za-z0-9][A-Za-z0-9._-]*\.md)`?")
_SLUG_RE = re.compile(r"[^a-z0-9]+")
_FENCE_RE = re.compile(r"^\s*(```|~~~)")


def slugify(title: str) -> str:
    return _SLUG_RE.sub("-", title.lower()).strip("-")


def _topic_title(text: str, fallback: str) -> str:
    for raw in text.splitlines():
        m = _H1_RE.match(raw)
        if m:
            return m.group(1)
    return fallback


def _index_lines(text: str) -> dict[str, str]:
    """file -> one-line description, from index.md."""
    rows = {}
    in_fence = False
    for raw in text.splitlines():
        if _FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _INDEX_LINE_RE.match(raw)
        if m:
            rows[m.group(1)] = m.group(2).strip()
    return rows


def _body(lines: list[str], start: int, end: int) -> dict:
    """Body of an entry: the lines after its header fields up to the next
    entry. Labelled paragraphs are split out; `text` keeps the whole body."""
    body_lines = []
    seen_body = False
    for raw in lines[start:end]:
        if not seen_body:
            if _FIELD_RE.match(raw) or not raw.strip():
                continue
            seen_body = True
        body_lines.append(raw)
    text = "\n".join(body_lines).strip()
    labelled: dict[str, list[str]] = {}
    current = None
    buf: list[str] = []

    def flush():
        if current is not None:
            labelled.setdefault(current, []).append("\n".join(buf).strip())

    for raw in body_lines:
        m = _LABEL_RE.match(raw)
        if m:
            flush()
            current = m.group(1)
            buf = [m.group(2)]
        elif current is not None:
            if not raw.strip():
                flush()
                current = None
                buf = []
            else:
                buf.append(raw)
    flush()

    def one(label):
        vals = labelled.get(label)
        return vals[0] if vals else None

    return {
        "text": text,
        "reason": one("Reason"),
        "rejected": labelled.get("Rejected alternative", []),
        "consequence": one("Consequence"),
        "considered": one("Considered"),
        "why_open": one("Why this needs an answer"),
    }


def _config_dict(block) -> dict:
    if block is None:
        return {}
    return {key: vals[0][1] for key, vals in block.fields.items() if vals}


class StateBuilder:
    """Holds the per-file Git cache between rebuilds. One instance per
    server run; `build()` is what the CLI, the server and the export call."""

    def __init__(self, root: str, anonymize: bool = False):
        self.root = os.path.abspath(root)
        self.anonymize = anonymize
        self._git_cache: dict[tuple, dict] = {}

    # -- public -----------------------------------------------------------

    def build(self) -> dict:
        linter = Linter(self.root)
        parsed = _load_config(self.root, linter)
        findings = linter.run(parsed)
        findings.sort(key=lambda f: (f.path, f.line, f.code))
        context_dir = linter.context_dir
        repo = gitinfo.open_repo(self.root)
        errors = sum(1 for f in findings if f.severity == ERROR)

        topics, entries = self._read_context(context_dir, repo)
        self._attach_findings(entries, findings, context_dir)
        names = self._anonymizer(entries)
        authors = self._authors(entries, names)

        state = {
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "dashboard": __version__,
            "linter": LINT_VERSION,
            "project": {
                "id": _config_dict(parsed.config if parsed else None).get("id", ""),
                "name": os.path.basename(self.root),
                "context": context_dir.rstrip("/") + "/",
                "schema": ".".join(str(p) for p in linter.schema),
                "config": _config_dict(parsed.config if parsed else None),
                "personal_defaults": (
                    _config_dict(parsed.personal_defaults) if parsed else {}
                ),
                "config_file": parsed.path if parsed else None,
                "git": self._repo_dict(repo),
            },
            "topics": topics,
            "entries": entries,
            "authors": authors,
            "findings": {
                "errors": errors,
                "warnings": len(findings) - errors,
                "items": [
                    {
                        "severity": f.severity,
                        "code": f.code,
                        "path": f.path,
                        "line": f.line,
                        "message": f.message,
                    }
                    for f in findings
                ],
            },
        }
        return state

    def fingerprint(self) -> str:
        linter = Linter(self.root)
        parsed = _load_config(self.root, linter)
        if parsed and parsed.config:
            ctx = parsed.config.first("context")
            from ktw_lint.config import context_dir_from_value

            context_dir = context_dir_from_value(ctx[1]) if ctx else "context"
        else:
            context_dir = "context"
        return gitinfo.fingerprint(self.root, context_dir, gitinfo.open_repo(self.root))

    # -- internals ----------------------------------------------------------

    def _repo_dict(self, repo):
        if repo is None:
            return {"available": False}
        return {
            "available": True,
            "head": repo.head,
            "head_full": repo.head_full,
            "branch": repo.branch,
            "remote": repo.remote,
            "project_subdir": (
                os.path.relpath(self.root, repo.root) if self.root != repo.root else ""
            ),
        }

    def _read_context(self, context_dir: str, repo):
        ctx_abs = os.path.join(self.root, context_dir)
        try:
            names = sorted(
                n
                for n in os.listdir(ctx_abs)
                if n.endswith(".md") and n not in GUARD_FILES
            )
        except OSError:
            return [], []
        index_lines = {}
        index_path = os.path.join(ctx_abs, "index.md")
        if os.path.isfile(index_path):
            with open(index_path, encoding="utf-8", errors="replace") as fh:
                index_lines = _index_lines(fh.read())

        topics = []
        entries = []
        known = set(names)
        for name in names:
            rel = os.path.join(context_dir, name).replace(os.sep, "/")
            with open(
                os.path.join(ctx_abs, name), encoding="utf-8", errors="replace"
            ) as fh:
                text = fh.read()
            lines = text.splitlines()
            parsed_entries = parse_topic_text(text)
            git_file = (
                self._git_for_file(repo, rel, text, parsed_entries) if repo else None
            )
            topic = {
                "file": name,
                "title": _topic_title(text, name[:-3]),
                "index_line": index_lines.get(name, ""),
                "entries": len(parsed_entries),
                "refs_out": [],
                "refs_in": [],
                "status": {},
                "evidence": {},
            }
            for i, e in enumerate(parsed_entries):
                end = (
                    parsed_entries[i + 1].line - 1
                    if i + 1 < len(parsed_entries)
                    else len(lines)
                )
                # stop the body at a level-1 heading (ends the entry per spec)
                for j in range(e.line, end):
                    if lines[j].startswith("# "):
                        end = j
                        break
                body = _body(lines, e.line, end)
                refs = sorted(
                    {
                        r
                        for r in _REF_RE.findall(body["text"])
                        if r in known and r != name
                    }
                )
                fields = {f.name: [x.value for x in e.get(f.name)] for f in e.fields}
                status = (fields.get("Status") or [""])[0]
                evidence = (fields.get("Evidence") or [""])[0]
                entry = {
                    "id": f"{name}#{slugify(e.title)}",
                    "file": name,
                    "line": e.line,
                    "end_line": end,
                    "title": e.title,
                    "type": fields.get("Type", []),
                    "status": status,
                    "evidence": evidence,
                    "source": (fields.get("Source") or [None])[0],
                    "verification": (fields.get("Verification") or [None])[0],
                    "revisit_when": (fields.get("Revisit when") or [None])[0],
                    "body": body,
                    "refs": refs,
                    "git": self._git_for_entry(git_file, e, end) if git_file else None,
                    "findings": [],
                }
                entries.append(entry)
                topic["status"][status] = topic["status"].get(status, 0) + 1
                topic["evidence"][evidence] = topic["evidence"].get(evidence, 0) + 1
                for r in refs:
                    if r not in topic["refs_out"]:
                        topic["refs_out"].append(r)
            topics.append(topic)
        by_file = {t["file"]: t for t in topics}
        for t in topics:
            for r in t["refs_out"]:
                if t["file"] not in by_file[r]["refs_in"]:
                    by_file[r]["refs_in"].append(t["file"])
        return topics, entries

    def _git_for_file(self, repo, rel_to_project: str, text: str, parsed_entries):
        rel_to_repo = os.path.relpath(
            os.path.join(self.root, rel_to_project), repo.root
        ).replace(os.sep, "/")
        key = (
            rel_to_repo,
            hashlib.sha1(text.encode("utf-8", "replace")).hexdigest(),
            repo.head,
        )
        cached = self._git_cache.get(key)
        if cached is not None:
            return cached
        lines = gitinfo.blame(repo, rel_to_repo)
        if lines is None:
            return None
        created = {}
        history = {}
        for e in parsed_entries:
            created[e.line] = gitinfo.first_commit_with(
                repo, rel_to_repo, f"## {e.title}"
            )
            status_lines = e.get("Status")
            if status_lines and not (
                0 <= status_lines[0].line - 1 < len(lines)
                and lines[status_lines[0].line - 1].author == gitinfo.UNCOMMITTED
            ):
                history[e.line] = gitinfo.status_history(
                    repo, rel_to_repo, status_lines[0].line
                )
            else:
                history[e.line] = []
        data = {"blame": lines, "created": created, "history": history}
        self._git_cache[key] = data
        return data

    def _git_for_entry(self, git_file: dict, e, end: int) -> dict:
        blame = git_file["blame"]
        span = blame[e.line - 1 : end] if e.line - 1 < len(blame) else []
        last = None
        for bl in span:
            if bl.author == gitinfo.UNCOMMITTED:
                last = {"author": gitinfo.UNCOMMITTED, "date": "", "commit": ""}
                break
            if last is None or (bl.time and bl.time > last["_t"]):
                last = {
                    "author": bl.author,
                    "date": gitinfo.line_date(bl),
                    "commit": bl.sha,
                    "_t": bl.time,
                }
        if last:
            last.pop("_t", None)
        created = git_file["created"].get(e.line)
        heading = blame[e.line - 1] if e.line - 1 < len(blame) else None
        if heading and heading.author == gitinfo.UNCOMMITTED:
            created = {"author": gitinfo.UNCOMMITTED, "date": "", "commit": ""}
        history = list(git_file["history"].get(e.line, []))
        return {"created": created, "last_touched": last, "status_history": history}

    def _attach_findings(self, entries, findings, context_dir):
        by_file: dict[str, list] = {}
        for e in entries:
            by_file.setdefault(e["file"], []).append(e)
        prefix = context_dir.rstrip("/") + "/"
        for f in findings:
            if not f.path.startswith(prefix):
                continue
            name = f.path[len(prefix) :]
            for e in by_file.get(name, []):
                if e["line"] <= f.line < e["end_line"] + 1:
                    e["findings"].append(
                        {
                            "severity": f.severity,
                            "code": f.code,
                            "line": f.line,
                            "message": f.message,
                        }
                    )
                    break

    def _anonymizer(self, entries):
        if not self.anonymize:
            return {}
        names: dict[str, str] = {}
        order = []
        for e in entries:
            g = e.get("git") or {}
            for part in (
                g.get("created"),
                g.get("last_touched"),
                *(g.get("status_history") or []),
            ):
                if (
                    part
                    and part.get("author")
                    and part["author"] != gitinfo.UNCOMMITTED
                ):
                    order.append(part["author"])
        for a in order:
            if a not in names:
                names[a] = f"author-{len(names) + 1}"
        for e in entries:
            g = e.get("git") or {}
            for part in (
                g.get("created"),
                g.get("last_touched"),
                *(g.get("status_history") or []),
            ):
                if part and part.get("author") in names:
                    part["author"] = names[part["author"]]
        return names

    def _authors(self, entries, _names):
        stats: dict[str, dict] = {}

        def bucket(name):
            return stats.setdefault(
                name,
                {
                    "name": name,
                    "created": 0,
                    "touched": 0,
                    "superseded": 0,
                    "first": "",
                    "last": "",
                    "evidence": {},
                },
            )

        def bump_dates(b, date):
            if not date:
                return
            if not b["first"] or date < b["first"]:
                b["first"] = date
            if not b["last"] or date > b["last"]:
                b["last"] = date

        for e in entries:
            g = e.get("git")
            if not g:
                continue
            c = g.get("created")
            if c and c.get("author"):
                b = bucket(c["author"])
                b["created"] += 1
                b["evidence"][e["evidence"]] = b["evidence"].get(e["evidence"], 0) + 1
                bump_dates(b, c.get("date"))
            t = g.get("last_touched")
            if t and t.get("author"):
                b = bucket(t["author"])
                b["touched"] += 1
                bump_dates(b, t.get("date"))
            for ev in g.get("status_history") or []:
                if ev.get("status") == "superseded" and ev.get("author"):
                    b = bucket(ev["author"])
                    b["superseded"] += 1
                    bump_dates(b, ev.get("date"))
        return sorted(stats.values(), key=lambda b: (-b["created"], b["name"]))
