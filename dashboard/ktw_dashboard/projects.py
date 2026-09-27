"""Which projects the dashboard can show, and where they are.

The skill keeps one personal file per project in ``~/.keep-the-why/<id>.md``;
the ``<id>`` is the project's identity, deliberately not its path, and one id
can live at several paths (clones, worktrees). Where a project has been seen
is recorded in ``~/.keep-the-why/projects.json`` — the mapping the skill and
the dashboard share since skill 0.18.0: one row per project (id, canonical,
root), each with the paths it was seen at and when. Opening a project here
updates its ``last_seen``; the page offers the ten most recent.

Before 0.2.0 the dashboard kept its own ``dashboard-history.json`` with the
same information; it is folded into ``projects.json`` on first use and then
removed. That mapping is the only thing the dashboard ever writes: ids,
URLs and paths, in the user's home, outside every repository, safe to
delete. No project content.

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
_CANONICAL_RE = re.compile(r"^-\s*canonical:\s*(\S+)\s*$", re.M)
_ROOT_RE = re.compile(r"^-\s*root:\s*`?([^`\s]+)`?\s*$", re.M)
PROJECTS_JSON_VERSION = 1
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


def projects_path() -> str:
    return os.path.join(personal_dir(), "projects.json")


def legacy_history_path() -> str:
    return os.path.join(personal_dir(), "dashboard-history.json")


history_path = projects_path  # the name before 0.2.0; the file is projects.json now


def personal_ids() -> list[str]:
    """Ids with a personal file — the projects this developer has worked in."""
    try:
        names = os.listdir(personal_dir())
    except OSError:
        return []
    return sorted(n[:-3] for n in names if n.endswith(".md"))


def read_project_config(path: str) -> dict | None:
    """id, canonical and root of the project at `path`, or None if it is not one."""
    cfg = os.path.join(path, ".keep-the-why")
    if not os.path.isfile(cfg):
        return None
    try:
        with open(cfg, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return None
    m = _ID_RE.search(text)
    if not m:
        return None
    canonical = _CANONICAL_RE.search(text)
    root = _ROOT_RE.search(text)
    return {
        "id": m.group(1),
        "canonical": canonical.group(1) if canonical else "",
        "root": root.group(1) if root else "",
    }


def read_project_id(path: str) -> str | None:
    """The `id` of the project at `path`, or None if it is not one."""
    cfg = read_project_config(path)
    return cfg["id"] if cfg else None


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


def _valid_rows(data) -> list[dict]:
    rows = []
    for r in data.get("projects", []) if isinstance(data, dict) else []:
        if not isinstance(r, dict) or not isinstance(r.get("id"), str):
            continue
        paths = [
            p
            for p in r.get("paths", [])
            if isinstance(p, dict) and isinstance(p.get("path"), str)
        ]
        rows.append(
            {
                "id": r["id"],
                "canonical": r.get("canonical") or "",
                "root": r.get("root") or "",
                "paths": paths,
                **({"cache": r["cache"]} if isinstance(r.get("cache"), str) else {}),
            }
        )
    return rows


def _migrate_legacy_history() -> list[dict]:
    """dashboard-history.json (dashboard < 0.2.0) -> projects.json rows. The
    old file is removed once its content is written to the new one."""
    try:
        with open(legacy_history_path(), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    rows: dict[str, dict] = {}
    for r in data.get("projects", []) if isinstance(data, dict) else []:
        if (
            not isinstance(r, dict)
            or not isinstance(r.get("id"), str)
            or not isinstance(r.get("path"), str)
        ):
            continue
        row = rows.setdefault(
            r["id"], {"id": r["id"], "canonical": "", "root": "", "paths": []}
        )
        row["paths"].append(
            {"path": r["path"], "last_seen": r.get("last_opened", "") or ""}
        )
    result = list(rows.values())
    if result and save_projects(result):
        try:
            os.remove(legacy_history_path())
        except OSError:
            pass
    return result


def load_projects() -> list[dict]:
    """The rows of ~/.keep-the-why/projects.json: [{id, canonical, root,
    paths: [{path, last_seen}], cache?}]. Folds the pre-0.2.0 history file
    in the first time there is no projects.json yet."""
    try:
        with open(projects_path(), encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return _migrate_legacy_history()
    except (OSError, ValueError):
        return []
    return _valid_rows(data)


def save_projects(rows: list[dict]) -> bool:
    try:
        os.makedirs(personal_dir(), exist_ok=True)
        with open(projects_path(), "w", encoding="utf-8") as fh:
            json.dump(
                {"projects-json": PROJECTS_JSON_VERSION, "projects": rows},
                fh,
                indent=1,
            )
        return True
    except OSError:
        return False  # a read-only home must not stop the dashboard


def load_history() -> list[dict]:
    """[{id, path, last_opened}], most recently seen first — every path of
    every project in projects.json, flattened for the project menu."""
    flat = []
    for r in load_projects():
        for p in r["paths"]:
            flat.append(
                {
                    "id": r["id"],
                    "path": p["path"],
                    "last_opened": p.get("last_seen", ""),
                }
            )
    flat.sort(key=lambda r: r.get("last_opened", ""), reverse=True)
    return flat


def record_open(pid: str, path: str) -> None:
    """Record that project `pid` was seen at `path` now: the row is created or
    updated, the path's `last_seen` set, canonical and root refreshed from the
    project's own config."""
    path = os.path.abspath(path)
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    cfg = read_project_config(path) or {}
    rows = load_projects()
    row = next((r for r in rows if r["id"] == pid), None)
    if row is None:
        row = {"id": pid, "canonical": "", "root": "", "paths": []}
        rows.append(row)
    if cfg.get("canonical"):
        row["canonical"] = cfg["canonical"]
    if cfg.get("root"):
        row["root"] = cfg["root"]
    row["paths"] = [p for p in row["paths"] if p.get("path") != path]
    row["paths"].insert(0, {"path": path, "last_seen": now})
    # most recently seen first, rows and paths alike — the order breaks ties
    # between timestamps of the same second
    rows.remove(row)
    rows.insert(0, row)
    save_projects(rows)


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
