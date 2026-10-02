#!/usr/bin/env python3
"""Build docs/registry/index.json from registry/projects.txt.

Every line is a repository's canonical URL. The build reads that repository's
``.keep-the-why`` at HEAD, follows its ``dashboard-state`` line to the
published export, and checks that the export names this repository
(``project.canonical``) — the state's URL is read, never listed, so an export
that moves is followed on the next build. A family is listed by its root
(the topmost project); its members come with it through the parent/children
relation. A line that never
loaded fails the build (a new line in a pull request, a typo); a listed
repository whose export stops answering stays as last seen, marked ``error``
and ``failed_since``, for GRACE_DAYS before it is dropped — much of that is
temporary. Standard library only; ``--check`` validates without writing.
"""

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "registry" / "projects.txt"
TARGET = ROOT / "docs" / "registry" / "index.json"
TIMEOUT = 30
MAX_BYTES = 20 * 1024 * 1024


def fetch(url, want_headers=False):
    # an Origin header, as a browser sends one: a host that answers cross-origin requests says so in the reply
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "keep-the-why-registry",
            "Origin": "https://keepthewhy.com",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        data = res.read(MAX_BYTES + 1)
        headers = res.headers
    if len(data) > MAX_BYTES:
        raise ValueError(f"larger than {MAX_BYTES // 1024 // 1024} MB")
    text = data.decode("utf-8", "replace")
    return (text, headers) if want_headers else text


def cors_open(headers):
    """Whether a browser on another site may read this reply: the dashboard fetches `.keep-the-why` and
    `state.json` from the page, so both hosts must send Access-Control-Allow-Origin. The registry, a script,
    is not bound by it — it can see the header, the browser only sees a refusal."""
    allow = (headers.get("Access-Control-Allow-Origin") or "").strip()
    return allow == "*" or allow == "https://keepthewhy.com"


def raw_url(canonical):
    m = re.match(r"^https://github\.com/([^/]+)/([^/]+?)/?$", canonical)
    if m:
        return f"https://raw.githubusercontent.com/{m.group(1)}/{m.group(2)}/HEAD/.keep-the-why"
    # other hosts: the dashboard's rule — <canonical>/raw/HEAD/.keep-the-why (GitLab, Gitea, Forgejo, Codeberg)
    return canonical.rstrip("/") + "/raw/HEAD/.keep-the-why"


def config_line(text, key):
    m = re.search(rf"^-\s*{re.escape(key)}\s*:\s*(.+?)\s*$", text, re.M)
    return m.group(1).strip("`") if m else ""


def normalize(canonical):
    """`https://host/owner/repo`, no trailing slash, no `.git` — the form `canonical` takes in `.keep-the-why`."""
    c = canonical.strip().rstrip("/")
    return c[:-4] if c.endswith(".git") else c


def check(canonical):
    """A listed repository: its `.keep-the-why` at HEAD names a published export, and the export names this
    repository. The state's URL is read, never listed — a moved export is followed on the next build.
    """
    if not canonical.startswith("https://"):
        raise ValueError("not an https repository URL")
    config, config_headers = fetch(raw_url(canonical), want_headers=True)
    url = config_line(config, "dashboard-state")
    if not url:
        raise ValueError(
            "its .keep-the-why at HEAD has no dashboard-state line — no published export"
        )
    if not url.startswith("https://"):
        raise ValueError(f"its dashboard-state is not an https URL: {url}")
    state_text, state_headers = fetch(url, want_headers=True)
    state = json.loads(state_text)
    project = state.get("project") or {}
    named = normalize(project.get("canonical") or "")
    if named.lower() != canonical.lower():
        raise ValueError(
            f"the export at {url} names {named or 'no canonical'}, not this repository"
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
        # readable from a browser on another site — the globe and other dashboards need both
        "cors": cors_open(config_headers) and cors_open(state_headers),
    }


GRACE_DAYS = 30  # a listed export that stops answering stays, marked, this long before it is dropped


def previous():
    """The index as last written: what a failing line is allowed to keep."""
    try:
        data = json.loads(TARGET.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {p["canonical"].lower(): p for p in data.get("projects", [])}


def main(argv):
    lines = [l.strip() for l in SOURCE.read_text(encoding="utf-8").splitlines()]
    urls = [normalize(l) for l in lines if l and not l.startswith("#")]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    before = previous()
    projects, failed, stale = [], [], []
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
            old = before.get(url.lower())
            if old is None:
                # never loaded, so it cannot be listed: a new line in a pull request, or a typo
                failed.append((url, str(err)))
                print(f"FAIL  {url} — {err}")
                continue
            # a known export that stopped answering — much of that is temporary: it stays as
            # last seen, marked, and is dropped only after GRACE_DAYS of failing in a row
            since = old.get("failed_since") or today
            days = (
                datetime.strptime(today, "%Y-%m-%d")
                - datetime.strptime(since, "%Y-%m-%d")
            ).days
            if days > GRACE_DAYS:
                failed.append((url, f"not answering since {since}: {err}"))
                print(f"DROP  {url} — not answering since {since}: {err}")
                continue
            kept = dict(old, error=str(err), failed_since=since)
            projects.append(kept)
            stale.append((url, since, str(err)))
            print(f"STALE {url} — since {since}: {err}")
    seen = set()
    for p in projects:
        if p["canonical"].lower() in seen:
            failed.append((p["canonical"], "listed twice"))
        seen.add(p["canonical"].lower())
    for p in projects:
        if p.get("cors") is False:
            print(
                f"::warning title=registry, no CORS header::{p['canonical']} — {p['state']} or its .keep-the-why "
                "is served without Access-Control-Allow-Origin; browsers on other sites cannot load it"
            )
    for url, since, err in stale:
        print(f"::warning title=registry, not answering since {since}::{url} — {err}")
    if failed:
        for url, err in failed:
            print(f"::error title=registry::{url} — {err}")
        print(
            f"\n{len(failed)} of {len(urls)} cannot be listed; the index is not written.",
            file=sys.stderr,
        )
        return 1
    index = {
        "registry": "https://keepthewhy.com/registry/",
        "source": "https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/projects.txt",
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
