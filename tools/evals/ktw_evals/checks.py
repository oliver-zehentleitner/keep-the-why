"""Deterministic per-case checks: the part of an expectation a machine can
settle without a judge — a file was or wasn't written, a setting was or
wasn't touched, a literal secret did or didn't land on disk, the skill was
loaded. Declared per case in evals.json as a `checks` list and run before
the judge; a failed check is a failed case, the judge is only asked about
what's left (unless --judge-always).

Each check is a dict with a `type` and, depending on the type, a `path`
(a glob, relative to the project; a `~/` prefix means the fake $HOME,
so `~/.keep-the-why/*.md` is the personal config) and a `text` or `regex`:

  no_disk_changes                nothing changed in the project or ~/.keep-the-why/
  no_changes_under   path        no file under this prefix was created, modified or deleted
  changes_under      path        at least one file under this prefix was
  file_exists        path        something matching the glob exists after the run
  file_absent        path        nothing matching the glob exists
  file_unchanged     path        the file exists and is identical to before the run
  file_changed       path        the file was created, modified or deleted
  text_present       text|regex  found in a file matching `path`, or in any
                     [, path]    file the agent wrote (project + personal)
  text_absent        text|regex  found nowhere in those files
                     [, path]
  skill_loaded                   a tool call in the transcript loaded the skill

Everything here is on purpose blunt. A check that needs interpretation
belongs in the expected_behavior text for the judge, not in this list.
"""

import fnmatch
import re

from .analysis import skill_load_position
from .common import sh


class _State:
    """What changed, collected once per case from the workdir and fake $HOME."""

    def __init__(self, workdir, home):
        self.workdir = workdir
        self.home = home
        # project: relative paths of every created/modified/deleted file
        self.project_changed = set()
        status = sh(["git", "status", "--porcelain"], cwd=workdir).stdout
        for line in status.splitlines():
            rel = line[3:].strip()
            if " -> " in rel:  # rename: both sides count as changed
                old, new = rel.split(" -> ", 1)
                self.project_changed.update((old, new))
            else:
                self.project_changed.add(rel)
        # personal: compare ~/.keep-the-why/ to the snapshot workdir.py took
        # before the run; paths are recorded in "~/.keep-the-why/<rel>" form
        self.personal_changed = set()
        if home is not None:
            personal = home / ".keep-the-why"
            snapshot = home / ".ktw-eval-seed-snapshot"
            before = _tree(snapshot)
            after = _tree(personal)
            for rel in set(before) | set(after):
                if before.get(rel) != after.get(rel):
                    self.personal_changed.add(f"~/.keep-the-why/{rel}")

    # -- path helpers ----------------------------------------------------

    def _base(self, path):
        """(base directory, pattern relative to it) for a check's path."""
        if path.startswith("~/"):
            return self.home, path[2:]
        return self.workdir, path

    def existing(self, path):
        base, pattern = self._base(path)
        if base is None:
            return []
        return [p for p in base.glob(pattern) if p.is_file()]

    def changed(self):
        return self.project_changed | self.personal_changed

    def changed_under(self, path):
        prefix = path.rstrip("/")
        return {p for p in self.changed() if p == prefix or p.startswith(prefix + "/")}

    def changed_matching(self, path):
        return {p for p in self.changed() if fnmatch.fnmatch(p, path)}

    def written_contents(self):
        """{path: content} of every changed file that still exists."""
        out = {}
        for rel in self.changed():
            base, pattern = self._base(rel)
            if base is None:
                continue
            p = base / pattern
            if p.is_file():
                out[rel] = _read(p)
        return out

    def contents_matching(self, path):
        return {_display(self, p): _read(p) for p in self.existing(path)}


def _tree(root):
    if root is None or not root.is_dir():
        return {}
    return {
        str(p.relative_to(root)): _read(p)
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


def _read(p):
    try:
        return p.read_text()
    except (UnicodeDecodeError, OSError):
        return ""


def _display(state, p):
    if state.home is not None and p.is_relative_to(state.home):
        return "~/" + str(p.relative_to(state.home))
    return str(p.relative_to(state.workdir))


def _matcher(check):
    if "regex" in check:
        rx = re.compile(check["regex"])
        return rx.search, f"/{check['regex']}/"
    text = check["text"]
    return (lambda s: text in s), repr(text)


# -- the checks ----------------------------------------------------------
# Each returns (ok, detail). detail is one short line a reader can act on.


def _no_disk_changes(check, st, transcript):
    changed = sorted(st.changed())
    return not changed, (
        "nothing changed" if not changed else f"changed: {', '.join(changed)}"
    )


def _no_changes_under(check, st, transcript):
    hits = sorted(st.changed_under(check["path"]))
    return not hits, (
        f"nothing under {check['path']} changed"
        if not hits
        else f"changed under {check['path']}: {', '.join(hits)}"
    )


def _changes_under(check, st, transcript):
    hits = sorted(st.changed_under(check["path"]))
    return bool(hits), (
        f"changed under {check['path']}: {', '.join(hits)}"
        if hits
        else f"nothing under {check['path']} was written"
    )


def _file_exists(check, st, transcript):
    hits = st.existing(check["path"])
    return bool(hits), (
        f"exists: {', '.join(_display(st, p) for p in hits)}"
        if hits
        else f"nothing matches {check['path']}"
    )


def _file_absent(check, st, transcript):
    hits = st.existing(check["path"])
    return not hits, (
        f"nothing matches {check['path']}"
        if not hits
        else f"exists: {', '.join(_display(st, p) for p in hits)}"
    )


def _file_unchanged(check, st, transcript):
    if not st.existing(check["path"]):
        return False, f"{check['path']} does not exist after the run"
    hits = sorted(st.changed_matching(check["path"]))
    return not hits, (
        f"{check['path']} unchanged" if not hits else f"changed: {', '.join(hits)}"
    )


def _file_changed(check, st, transcript):
    hits = sorted(st.changed_matching(check["path"]))
    return bool(hits), (
        f"changed: {', '.join(hits)}" if hits else f"{check['path']} untouched"
    )


def _scope(check, st):
    if "path" in check:
        return st.contents_matching(check["path"]), f"files matching {check['path']}"
    return st.written_contents(), "files the agent wrote"


def _text_present(check, st, transcript):
    match, label = _matcher(check)
    files, scope = _scope(check, st)
    hits = sorted(p for p, content in files.items() if match(content))
    return bool(hits), (
        f"{label} found in {', '.join(hits)}"
        if hits
        else f"{label} not found in {scope}" + ("" if files else " (none)")
    )


def _text_absent(check, st, transcript):
    match, label = _matcher(check)
    files, scope = _scope(check, st)
    hits = sorted(p for p, content in files.items() if match(content))
    return not hits, (
        f"{label} absent from {scope}"
        if not hits
        else f"{label} found in {', '.join(hits)}"
    )


def _skill_loaded(check, st, transcript):
    at = skill_load_position(transcript)
    return at is not None, (
        f"tool call #{at} loaded the skill"
        if at is not None
        else "no tool call in the transcript loaded the skill"
    )


CHECKS = {
    "no_disk_changes": _no_disk_changes,
    "no_changes_under": _no_changes_under,
    "changes_under": _changes_under,
    "file_exists": _file_exists,
    "file_absent": _file_absent,
    "file_unchanged": _file_unchanged,
    "file_changed": _file_changed,
    "text_present": _text_present,
    "text_absent": _text_absent,
    "skill_loaded": _skill_loaded,
}


def describe(check):
    """One-line rendering of a check for records and summaries."""
    parts = [check["type"]]
    for key in ("path", "text", "regex"):
        if key in check:
            parts.append(f"{key}={check[key]!r}")
    return " ".join(parts)


def run_checks(checks, workdir, home, transcript):
    """Evaluate every check; returns a list of {check, ok, detail} in order."""
    if not checks:
        return []
    state = _State(workdir, home)
    results = []
    for check in checks:
        fn = CHECKS.get(check.get("type"))
        if fn is None:
            results.append(
                {
                    "check": describe(check),
                    "ok": False,
                    "detail": f"unknown check type {check.get('type')!r}",
                }
            )
            continue
        ok, detail = fn(check, state, transcript)
        results.append({"check": describe(check), "ok": bool(ok), "detail": detail})
    return results
