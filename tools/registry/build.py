#!/usr/bin/env python3
"""Build docs/registry/index.json from registry/states.txt.

Every line that is a URL must be a published Keep the Why dashboard export:
the state.json loads, names its repository (``project.canonical``), and that
repository's ``.keep-the-why`` at HEAD names this very URL in its
``dashboard-state`` line — so nobody can list another project's export, and
a listing goes stale visibly when the export moves. One failure fails the
build; the index is written only when every line passes. Standard library
only; ``--check`` validates without writing.
"""

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "registry" / "states.txt"
TARGET = ROOT / "docs" / "registry" / "index.json"
TIMEOUT = 30
MAX_BYTES = 20 * 1024 * 1024


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keep-the-why-registry"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        data = res.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"larger than {MAX_BYTES // 1024 // 1024} MB")
    return data.decode("utf-8", "replace")


def raw_url(canonical):
    m = re.match(r"^https://github\.com/([^/]+)/([^/]+?)/?$", canonical)
    if m:
        return f"https://raw.githubusercontent.com/{m.group(1)}/{m.group(2)}/HEAD/.keep-the-why"
    # other hosts: the dashboard's rule — <canonical>/raw/HEAD/.keep-the-why (GitLab, Gitea, Forgejo, Codeberg)
    return canonical.rstrip("/") + "/raw/HEAD/.keep-the-why"


def config_line(text, key):
    m = re.search(rf"^-\s*{re.escape(key)}\s*:\s*(.+?)\s*$", text, re.M)
    return m.group(1).strip("`") if m else ""


def check(url):
    state = json.loads(fetch(url))
    project = state.get("project") or {}
    canonical = (project.get("canonical") or "").rstrip("/")
    if not canonical.startswith("https://"):
        raise ValueError("the state names no https canonical")
    config = fetch(raw_url(canonical))
    declared = config_line(config, "dashboard-state").rstrip("/")
    if declared != url.rstrip("/"):
        raise ValueError(
            f"{canonical}'s .keep-the-why names {declared or 'no dashboard-state'}, not this URL"
        )
    return {
        "canonical": canonical,
        "state": url,
        "id": project.get("id") or config_line(config, "id"),
        "name": project.get("name") or "",
        "schema": project.get("schema") or config_line(config, "context-schema"),
        "dashboard": state.get("dashboard") or "",
        "linter": state.get("linter") or "",
        "entries": len(state.get("entries") or []),
        "topics": len(state.get("topics") or []),
        "parent": (project.get("parent") or "").strip("`"),
        "children": len(project.get("children") or []),
        "generated": state.get("generated") or "",
    }


def main(argv):
    lines = [l.strip() for l in SOURCE.read_text(encoding="utf-8").splitlines()]
    urls = [l for l in lines if l and not l.startswith("#")]
    projects, failed = [], []
    for url in urls:
        try:
            projects.append(check(url))
            print(f"ok    {url}")
        except (
            urllib.error.URLError,
            ValueError,
            json.JSONDecodeError,
            OSError,
        ) as err:
            failed.append((url, str(err)))
            print(f"FAIL  {url} — {err}")
    seen = {}
    for p in projects:
        if p["canonical"] in seen:
            failed.append((p["state"], f"{p['canonical']} is listed twice"))
        seen[p["canonical"]] = p
    if failed:
        print(
            f"\n{len(failed)} of {len(urls)} failed; the index is not written.",
            file=sys.stderr,
        )
        return 1
    index = {
        "registry": "https://keepthewhy.com/registry/",
        "source": "https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/states.txt",
        "checked": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "projects": sorted(projects, key=lambda p: p["canonical"]),
    }
    if "--check" in argv:
        print(
            f"\n{len(projects)} projects would be written to {TARGET.relative_to(ROOT)}"
        )
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"\n{len(projects)} projects written to {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
