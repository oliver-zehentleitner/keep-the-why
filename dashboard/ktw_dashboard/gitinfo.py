"""Everything the dashboard learns from Git — all optional, all subprocess.

No library dependency: `git` on PATH or nothing. Every function returns
`None` (or an empty structure) when the project is not a repository, when
`git` is missing, or when a call fails, and the state marks Git as
unavailable instead of failing the dashboard.
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone

UNCOMMITTED = "working tree"
_UNCOMMITTED_AUTHORS = {"Not Committed Yet", "External file (--contents)"}
_CRED_RE = re.compile(r"//[^/@]+@")


def _run(args, cwd, timeout=20):
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def _date(ts: str) -> str:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except (ValueError, OverflowError, OSError):
        return ""


@dataclass
class Repo:
    root: str  # repository top level (absolute)
    head: str
    branch: str
    remote: str  # host/path, credentials and scheme stripped; "" when none

    def rel(self, path: str) -> str:
        return os.path.relpath(path, self.root)


def open_repo(project_root: str) -> Repo | None:
    top = _run(["rev-parse", "--show-toplevel"], project_root)
    if not top:
        return None
    top = top.strip()
    head = (_run(["rev-parse", "--short", "HEAD"], top) or "").strip()
    branch = (_run(["rev-parse", "--abbrev-ref", "HEAD"], top) or "").strip()
    remote = (_run(["remote", "get-url", "origin"], top) or "").strip()
    remote = _CRED_RE.sub("//", remote)
    remote = re.sub(r"^[a-z+]+://", "", remote)
    remote = re.sub(r"^git@([^:]+):", r"\1/", remote)
    remote = re.sub(r"\.git$", "", remote)
    return Repo(root=top, head=head, branch=branch, remote=remote)


def fingerprint(project_root: str, context_dir: str, repo: Repo | None) -> str:
    """Cheap change detector for the live server: HEAD plus mtimes of what
    the dashboard reads. Different string means rebuild the state."""
    parts = []
    if repo:
        parts.append(_run(["rev-parse", "HEAD"], repo.root) or "")
        for name in ("index", "HEAD"):
            try:
                parts.append(
                    str(os.stat(os.path.join(repo.root, ".git", name)).st_mtime_ns)
                )
            except OSError:
                parts.append("-")
    for name in (".keep-the-why", "AGENTS.md"):
        try:
            parts.append(str(os.stat(os.path.join(project_root, name)).st_mtime_ns))
        except OSError:
            parts.append("-")
    ctx = os.path.join(project_root, context_dir)
    try:
        names = sorted(os.listdir(ctx))
    except OSError:
        names = []
    for name in names:
        try:
            st = os.stat(os.path.join(ctx, name))
            parts.append(f"{name}:{st.st_mtime_ns}:{st.st_size}")
        except OSError:
            continue
    return "|".join(parts)


@dataclass
class BlameLine:
    sha: str
    author: str
    time: str  # unix seconds as string


def blame(repo: Repo, path: str) -> list[BlameLine] | None:
    """Per-line author/time/sha for a file, working-tree state included:
    uncommitted lines come back as the `working tree` author."""
    out = _run(["blame", "--porcelain", "--", path], repo.root)
    if out is None:
        return None
    lines: list[BlameLine] = []
    commits: dict[str, dict] = {}
    current = None
    for raw in out.splitlines():
        m = re.match(r"^([0-9a-f]{40}) \d+ \d+(?: \d+)?$", raw)
        if m:
            current = commits.setdefault(m.group(1), {"author": "", "time": ""})
            current["_sha"] = m.group(1)
            continue
        if current is None:
            continue
        if raw.startswith("author "):
            current["author"] = raw[7:]
        elif raw.startswith("author-time "):
            current["time"] = raw[12:]
        elif raw.startswith("\t"):
            author = current.get("author", "")
            sha = current["_sha"]
            if sha.startswith("0" * 40) or author in _UNCOMMITTED_AUTHORS:
                author = UNCOMMITTED
                sha = ""
            lines.append(
                BlameLine(sha=sha[:7], author=author, time=current.get("time", ""))
            )
    return lines


def first_commit_with(repo: Repo, path: str, needle: str):
    """The commit that introduced `needle` into `path` (pickaxe, oldest
    first): the closest thing Git has to 'when was this entry created'."""
    out = _run(
        ["log", "--reverse", "--format=%h|%an|%at", "-S", needle, "--", path],
        repo.root,
    )
    if not out:
        return None
    first = out.strip().splitlines()[0]
    sha, author, ts = (first.split("|", 2) + ["", ""])[:3]
    return {"author": author, "date": _date(ts), "commit": sha}


_STATUS_ADD_RE = re.compile(r"^\+\*\*Status:\*\*\s*(\S+)")


def status_history(repo: Repo, path: str, line: int):
    """Every value the Status line at `line` has had, oldest first, with who
    set it and when — `git log -L` follows the line through history."""
    out = _run(
        ["log", "--format=@@commit %h|%an|%at", "-L", f"{line},{line}:{path}"],
        repo.root,
    )
    if not out:
        return []
    events = []
    commit = None
    for raw in out.splitlines():
        if raw.startswith("@@commit "):
            sha, author, ts = (raw[9:].split("|", 2) + ["", ""])[:3]
            commit = {"author": author, "date": _date(ts), "commit": sha}
            continue
        m = _STATUS_ADD_RE.match(raw)
        if m and commit is not None:
            events.append({"status": m.group(1), **commit})
            commit = None  # one status value per commit
    events.reverse()
    # collapse repeats (a commit that touched the line without changing the value)
    collapsed = []
    for ev in events:
        if collapsed and collapsed[-1]["status"] == ev["status"]:
            continue
        collapsed.append(ev)
    return collapsed


def blob_hash(repo: Repo, path: str) -> str:
    out = _run(["hash-object", "--", path], repo.root)
    return (out or "").strip()


def line_date(bl: BlameLine) -> str:
    return _date(bl.time) if bl.time else ""
