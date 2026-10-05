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
temporary. The lines stay in A-Z order — a pull request adding one out of
order fails the check, so additions never collide in one place. Standard
library only. ``--check`` validates without writing (pull requests);
``--publish`` writes for the docs build: the previous index comes from
``--previous URL`` (the published one), and a line that cannot be listed is
left out with a warning instead of failing the site's deploy.

Backlinks: every export loaded — the listed ones and the family children they
name — is read for its cross-project ``See`` and ``Superseded by`` lines, and
each cited repository gets ``backlinks/<host>/<owner>/<repo>.json`` beside the
index: who in the registry cites it, entry by entry, sorted, so two builds
differ only where the citations did. A citation counts only from an export the
repository's own ``.keep-the-why`` points at; whether the cited Id exists is
checked where the cited repository was loaded in the same build.
"""

import json
import re
import shutil
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "registry" / "projects.txt"
TARGET = ROOT / "docs" / "registry" / "index.json"
BACKLINKS = TARGET.parent / "backlinks"
TIMEOUT = 30
MAX_BYTES = 20 * 1024 * 1024
MAX_CITATIONS = 500  # per citing export: more is cut, with a warning — one export must not fill the site
MAX_CHILDREN = 200  # family members loaded beyond the listed lines, in all


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
    return load(canonical)[0]


def load(canonical):
    """`check`, with the export's state beside the index record: the state is what the backlinks are read from."""
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
    }, state


GRACE_DAYS = 30  # a listed export that stops answering stays, marked, this long before it is dropped


_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")
_SUPERSEDED = re.compile(
    r"^(https://\S+?)\s+—\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\s+—\s+as of\s+(\S+))?"
)


def backlink_path(canonical):
    """`<host>/<owner>/<repo>.json` for a repository URL, lowercase, or None. The URL comes from a foreign
    export, so it becomes a path only as exactly three plain segments: no `..`, nothing that leaves backlinks/.
    """
    m = re.match(r"^https://([^/]+)/([^/]+)/([^/]+)$", normalize(canonical or ""))
    if not m:
        return None
    parts = [x.lower() for x in m.groups()]
    if any(not _SEGMENT.match(x) or x in (".", "..") for x in parts):
        return None
    return "/".join(parts) + ".json"


def citations(state, source):
    """The cross-project citations in one export: its entries' `See` lines with a repository and their
    `Superseded by` lines naming one. A citation of the export's own repository is not one.
    """
    own = normalize(source).lower()
    out = []
    for e in state.get("entries") or []:
        if not isinstance(e, dict) or not e.get("uuid"):
            continue
        refs = []
        for x in e.get("see") or []:
            if isinstance(x, dict) and x.get("remote") and x.get("uuid"):
                refs.append(("see", x["remote"], x["uuid"], x.get("date") or ""))
        sup = e.get("superseded_by")
        m = _SUPERSEDED.match(sup.strip()) if isinstance(sup, str) else None
        if m:
            refs.append(("superseded_by", m.group(1), m.group(2), m.group(3) or ""))
        for kind, remote, to, as_of in refs:
            target = normalize(remote)
            if target.lower() == own or not backlink_path(target):
                continue
            out.append(
                {
                    "target": target,
                    "from": source,
                    "entry": e["uuid"],
                    "title": e.get("title") or "",
                    "kind": kind,
                    "to": to,
                    "as_of": as_of,
                }
            )
    return out


def backlinks(states, checked):
    """{path: file} for every repository cited from `states` ({canonical: state}), {canonical lower: counts},
    and warnings. Sorted throughout — files, citations, keys — so a rebuild changes only what changed.
    """
    known = {
        c.lower(): {
            e.get("uuid") for e in (s.get("entries") or []) if isinstance(e, dict)
        }
        for c, s in states.items()
    }
    # a loaded repository is named as it names itself, any other as the first citing export spelled it
    spelled = {c.lower(): c for c in states}
    by_target, warnings = {}, []
    for source in sorted(states, key=str.lower):
        found = citations(states[source], source)
        if len(found) > MAX_CITATIONS:
            warnings.append(
                f"{source} — {len(found)} cross-project citations, only the first {MAX_CITATIONS} counted"
            )
            found = found[:MAX_CITATIONS]
        for c in found:
            target = c.pop("target")
            key = target.lower()
            spelled.setdefault(key, target)
            ids = known.get(key)
            # loaded in this build: does the cited entry exist there? Otherwise no claim either way
            if ids is not None:
                c["resolved"] = c["to"] in ids
            by_target.setdefault(key, []).append(c)
    files, counts = {}, {}
    for key, cites in by_target.items():
        cites.sort(key=lambda c: (c["from"].lower(), c["entry"], c["to"], c["kind"]))
        files[backlink_path(spelled[key])] = {
            "canonical": spelled[key],
            "checked": checked,
            "cited_by": cites,
        }
        counts[key] = {
            "repositories": len({c["from"].lower() for c in cites}),
            "citations": len(cites),
        }
    return dict(sorted(files.items())), counts, warnings


def family(states):
    """Load the family members the loaded exports name in their `children` blocks, into `states`, so their
    citations count too and theirs can be resolved. A member is checked as a listed line is — its own
    `.keep-the-why` names the export, the export names it — but not listed: the family is listed by its root.
    One that cannot be loaded is a warning, not a failure. Returns the warnings.
    """
    queue = sorted(states, key=str.lower)
    seen = {c.lower() for c in states}
    warnings, loaded = [], 0
    while queue:
        for child in (states[queue.pop(0)].get("project") or {}).get("children") or []:
            loc = (
                normalize(((child or {}).get("location") or "").strip("`"))
                if isinstance(child, dict)
                else ""
            )
            if not loc.startswith("https://") or loc.lower() in seen:
                continue
            seen.add(loc.lower())
            if loaded >= MAX_CHILDREN:
                warnings.append(
                    f"{loc} — more than {MAX_CHILDREN} family members, not loaded"
                )
                continue
            try:
                record, state = load(loc)
            except (
                urllib.error.URLError,
                ValueError,
                json.JSONDecodeError,
                OSError,
            ) as err:
                warnings.append(
                    f"{loc} — {err}; its citations are not counted in this build"
                )
                continue
            states[record["canonical"]] = state
            queue.append(record["canonical"])
            loaded += 1
            print(f"ok    {loc} (family)")
    return warnings


def previous(url=None):
    """The index as last published: what a failing line is allowed to keep. The index is a build
    artifact, not a committed file, so the docs build reads the published one (``--previous URL``).
    """
    try:
        text = fetch(url) if url else TARGET.read_text(encoding="utf-8")
        data = json.loads(text)
    except (OSError, ValueError, urllib.error.URLError):
        return {}
    return {p["canonical"].lower(): p for p in data.get("projects", [])}


def out_of_order(urls):
    """The first pair of lines that breaks A-Z order (case-insensitive), or None."""
    for a, b in zip(urls, urls[1:]):
        if b.lower() < a.lower():
            return a, b
    return None


def main(argv):
    lines = [l.strip() for l in SOURCE.read_text(encoding="utf-8").splitlines()]
    urls = [normalize(l) for l in lines if l and not l.startswith("#")]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    publish = "--publish" in argv
    prev_url = argv[argv.index("--previous") + 1] if "--previous" in argv else None
    order = out_of_order(urls)
    if order and not publish:
        print(
            f"::error title=registry, not in A-Z order::{order[1]} belongs before {order[0]} — "
            "registry/projects.txt is kept sorted A-Z (case-insensitive)"
        )
        return 1
    before = previous(prev_url)
    projects, failed, stale = [], [], []
    states = {}  # canonical: state — every export loaded, the backlinks' source
    for url in urls:
        try:
            record, state = load(url)
            projects.append(record)
            states[url] = state
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
    family_warnings = family(states)
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
    for w in family_warnings:
        print(f"::warning title=registry, family member not loaded::{w}")
    checked = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    files, counts, cut = backlinks(states, checked)
    for w in cut:
        print(f"::warning title=registry, citations cut::{w}")
    for p in projects:
        key = p["canonical"].lower()
        p["cited_by"] = counts.get(key, {"repositories": 0, "citations": 0})
        p.pop("backlinks", None)
        if key in counts:
            p["backlinks"] = "backlinks/" + backlink_path(p["canonical"])
    if failed and publish:
        # the site's deploy goes on: the line is left out, the warning says why
        for url, err in failed:
            print(f"::warning title=registry, left out::{url} — {err}")
        failed = []
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
        "checked": checked,
        "projects": sorted(projects, key=lambda p: p["canonical"]),
    }
    if "--check" in argv:
        print(
            f"\n{len(projects)} projects would be written to {TARGET.relative_to(ROOT)}, "
            f"{len(files)} backlink files from {len(states)} exports"
        )
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    # the directory is the build's own: what is not cited any more goes with it
    shutil.rmtree(BACKLINKS, ignore_errors=True)
    for path, data in files.items():
        out = BACKLINKS / path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(f"\n{len(projects)} projects written to {TARGET.relative_to(ROOT)}")
    print(
        f"{len(files)} backlink files from {len(states)} exports written to {BACKLINKS.relative_to(ROOT)}/"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
