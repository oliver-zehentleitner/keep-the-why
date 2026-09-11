"""Which projects the dashboard can show, and where they are.

The skill keeps one personal file per project in ``~/.keep-the-why/<id>.md``;
the ``<id>`` is the project's identity, deliberately not its path, and one id
can live at several paths (clones, worktrees). So the dashboard keeps its own
history next to those files: ``~/.keep-the-why/dashboard-history.json``, one
entry per *path* with the id, ordered by last opened. Opening a project moves
it to the top; the page offers the most recent ten.

That history is the only thing the dashboard ever writes: ids and paths, in
the user's home, outside every repository, safe to delete. No project content.

Paths also come from two other places so the list fills itself: the
directory the dashboard was started in, and a shallow scan of that
directory's parent plus any ``--scan`` roots.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import asdict, dataclass

_ID_RE = re.compile(r"^-\s*id:\s*(\S+)\s*$", re.M)
_SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".tox",
    "site-packages",
    ".cache",
}
HISTORY_LIMIT = 10


def personal_dir() -> str:
    return os.path.join(os.path.expanduser("~"), ".keep-the-why")


def history_path() -> str:
    return os.path.join(personal_dir(), "dashboard-history.json")


def personal_ids() -> list[str]:
    """Ids with a personal file — the projects this developer has worked in."""
    try:
        names = os.listdir(personal_dir())
    except OSError:
        return []
    return sorted(n[:-3] for n in names if n.endswith(".md"))


def read_project_id(path: str) -> str | None:
    """The `id` of the project at `path`, or None if it is not one."""
    cfg = os.path.join(path, ".keep-the-why")
    if not os.path.isfile(cfg):
        return None
    try:
        with open(cfg, encoding="utf-8", errors="replace") as fh:
            m = _ID_RE.search(fh.read())
    except OSError:
        return None
    return m.group(1) if m else None


def scan(roots, depth: int = 2) -> dict[str, str]:
    """path -> id for every project under `roots`, at most `depth` levels down."""
    found: dict[str, str] = {}
    for root in roots:
        root = os.path.abspath(os.path.expanduser(root))
        if not os.path.isdir(root):
            continue
        stack = [(root, 0)]
        while stack:
            d, lvl = stack.pop()
            pid = read_project_id(d)
            if pid:
                found[d] = pid
            if lvl >= depth:
                continue
            try:
                with os.scandir(d) as it:
                    for e in it:
                        if (
                            e.is_dir(follow_symlinks=False)
                            and not e.name.startswith(".")
                            and e.name not in _SKIP_DIRS
                        ):
                            stack.append((e.path, lvl + 1))
            except OSError:
                continue
    return found


def load_history() -> list[dict]:
    """[{id, path, last_opened}], most recently opened first."""
    try:
        with open(history_path(), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    rows = [
        r
        for r in data.get("projects", [])
        if isinstance(r, dict)
        and isinstance(r.get("id"), str)
        and isinstance(r.get("path"), str)
    ]
    rows.sort(key=lambda r: r.get("last_opened", ""), reverse=True)
    return rows


def save_history(rows: list[dict]) -> None:
    try:
        os.makedirs(personal_dir(), exist_ok=True)
        with open(history_path(), "w", encoding="utf-8") as fh:
            json.dump({"dashboard-history": 1, "projects": rows}, fh, indent=1)
    except OSError:
        pass  # a read-only home must not stop the dashboard


def record_open(pid: str, path: str) -> None:
    """Move (or add) `path` to the top of the history."""
    path = os.path.abspath(path)
    rows = [r for r in load_history() if r["path"] != path]
    rows.insert(
        0, {"id": pid, "path": path, "last_opened": time.strftime("%Y-%m-%dT%H:%M:%S")}
    )
    save_history(rows)


@dataclass
class Project:
    key: str  # the path — one id can live at several
    id: str
    path: str | None  # None: known from ~/.keep-the-why, location not found
    name: str
    source: str  # "cwd" | "history" | "scan" | "unresolved"
    last_opened: str = ""

    def to_dict(self):
        return asdict(self)


def resolve(
    cwd: str, scan_roots=(), use_history: bool = True
) -> tuple[list[Project], str | None]:
    """All projects to offer, and the key to select first.

    Order: the project at `cwd` (if any), then the history (most recent
    first, at most HISTORY_LIMIT, stale paths dropped), then projects the scan
    found that are not in the history yet, then ids from ~/.keep-the-why with
    no known location at all. The selected key is the cwd project, else the
    most recently opened one.
    """
    cwd = os.path.abspath(cwd)
    cwd_id = read_project_id(cwd)
    history = load_history() if use_history else []
    scanned = scan([os.path.dirname(cwd), *scan_roots])
    projects: list[Project] = []
    seen_paths: set[str] = set()

    def add(pid, path, source, last=""):
        key = path or f"unresolved:{pid}"
        if key in seen_paths:
            return
        seen_paths.add(key)
        projects.append(
            Project(
                key=key,
                id=pid,
                path=path,
                name=os.path.basename(path) if path else pid,
                source=source,
                last_opened=last,
            )
        )

    if cwd_id:
        add(cwd_id, cwd, "cwd")
    kept = []
    for r in history:
        live_id = read_project_id(r["path"])
        if live_id is None:
            continue  # moved or gone — dropped from the list, not from the file until next open
        r = {**r, "id": live_id}
        kept.append(r)
        if len([p for p in projects if p.source in ("cwd", "history")]) < HISTORY_LIMIT:
            add(live_id, r["path"], "history", r.get("last_opened", ""))
    for path, pid in sorted(scanned.items()):
        add(pid, path, "scan")
    known_ids = {p.id for p in projects}
    for pid in personal_ids():
        if pid not in known_ids:
            add(pid, None, "unresolved")

    selected = next((p.key for p in projects if p.path), None)
    return projects, selected
