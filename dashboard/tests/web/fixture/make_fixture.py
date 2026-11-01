"""The fixture behind the DOM snapshots (snapshot.mjs): a small invented
project, built as a Git history with fixed dates and authors, read by the
dashboard's own StateBuilder and frozen into state.json beside this file.

The snapshots must not move when this repository's own context/ grows, when
the dashboard's version changes or when the day changes; so the page is
rendered from this frozen state, never from a fresh export. The state is
rebuilt only on purpose, when the state format itself changes:

    python dashboard/tests/web/fixture/make_fixture.py            # rewrite state.json
    python dashboard/tests/web/fixture/make_fixture.py --page OUT # render OUT from state.json

The second form is what CI runs: the page's current code over the frozen state.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "state.json")

# Fixed values, so the frozen state does not carry this machine or this day.
VERSIONS = {"dashboard": "0.0.0-fixture", "linter": "0.0.0.0-fixture"}
GENERATED = "2026-06-15T12:00:00Z"

CONFIG = """<!-- keep-the-why:config -->
- id: acme---widget
- canonical: https://github.com/acme/widget
- dashboard-state: https://acme.example/keep-the-why-dashboard/state.json
- context: `context/`
- init: complete
- context-schema: 0.20.3
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
"""

SKELETON = [str(d) for d in range(10)] + [chr(c) for c in range(ord("A"), ord("Z") + 1)]


def index(lines):
    """The index skeleton with one line per topic under its letter."""
    out = ["# Context index", "", "Why this project is built the way it is.", ""]
    for h in SKELETON:
        out += [f"## {h}", ""]
        for name, desc in sorted(lines.items()):
            if name[0].upper() == h:
                out += [f"- [{name}]({name}) — {desc}", ""]
    return "\n".join(out)


def entry(
    title,
    uid,
    types,
    status,
    evidence,
    body,
    source=None,
    verification=None,
    revisit=None,
    see=(),
    superseded_by=None,
):
    lines = [f"## {title}", "", f"**Id:** {uid}"]
    lines += [f"**Type:** {t}" for t in types]
    lines += [f"**Status:** {status}", f"**Evidence:** {evidence}"]
    if source:
        lines.append(f"**Source:** {source}")
    if verification:
        lines.append(f"**Verification:** {verification}")
    if revisit:
        lines.append(f"**Revisit when:** {revisit}")
    lines += [f"**See:** {s}" for s in see]
    if superseded_by:
        lines.append(f"**Superseded by:** {superseded_by}")
    return "\n".join(lines) + "\n\n" + body.strip() + "\n"


def topic(title, *entries):
    return f"# {title}\n\n" + "\n".join(entries)


# The entries, by role. Ids are fixed: they are addresses the snapshots name.
A, B, C, D, E, F, G, H, I, J, K = (
    "3c80c624-2274-497a-a1f0-d8ff65b0e0c3",
    "4bc883fc-f8ef-4d90-b90d-0a669f375a70",
    "682e7ab6-125c-459f-9c67-a3c6b217d8ef",
    "190b1989-a347-471b-8463-4f83b3cfff92",
    "cc7ef11a-f83d-4d95-b45c-d43639003f41",
    "65568f64-aa13-4915-878d-d5cfe3479e64",
    "f5383416-90c8-4c5c-affc-01c3c67d0518",
    "756f14cb-61c6-4ff2-8dea-29f28c030ca5",
    "c1c37ec2-933b-4ca3-8c16-0a61f908f4bd",
    "f5ac4f25-a9f1-490a-a4ca-62d5f0db4a06",
    "c63efee2-97dd-452a-885f-c793001131b7",
)


# An entry whose text is hostile on purpose: tags, an event handler, a script, a javascript:
# link. The snapshots show it as text — the page builds no markup from what an entry says.
X = "050ea108-42f3-4f0f-9ea9-dd2156f206d7"
HOSTILE_BODY = """
Someone pasted <script>alert("body")</script> and <img src=x onerror=alert(3)> into a body.

**Reason:** a log line that reads `<b>bold</b>` must reach the reader as written, and
[a link](javascript:alert(4)) or [another](data:text/html,x) must not become one.

- <i onclick="alert(5)">list item</i>
"""


def see(file, title, uid, day):
    anchor = title.lower().replace(" ", "-")
    return f"{file}#{anchor} — {uid} — as of {day}"


A_TITLE = "Sync waits for the snapshot before replaying the buffer"
H_TITLE = "Sync replays the buffer against a versioned snapshot"
C_TITLE = "Writes retry three times on a busy lock"
E_TITLE = "The API is versioned in the path"
G_TITLE = "Pagination uses opaque cursors"

A_BODY = """
The sync step waits for a full snapshot before it applies any buffered event,
even though this adds latency on a cold start.

**Reason:** applying buffered events before the snapshot landed caused
duplicate-then-overwritten state. The ordering is not visible in the code.

**Rejected alternative:** replay in parallel and reconcile — the reconciliation
was hard to get right, and the ordering made it unnecessary.

- cold start: about two seconds slower
- warm start: unchanged
  and no extra memory either

```
snapshot = fetch_snapshot()
replay(buffer, after=snapshot.version)
```

See `storage.md` and [the protocol notes](https://example.org/sync-protocol).
"""

H_BODY = """
Snapshots carry a version, and the buffer is replayed from that version on,
without waiting for the snapshot to finish loading.

**Reason:** the version makes the ordering explicit, so waiting is no longer
needed; cold starts lose the two seconds again.

**Consequence:** a snapshot without a version is refused, never guessed.

1. fetch the snapshot header
2. replay the buffer from its version
3. load the rest of the snapshot

Follows [sync.md](sync.md#sync-waits-for-the-snapshot-before-replaying-the-buffer).
"""


def commits():
    """(date, author name, author mail, files) — files as they stand after the commit."""
    sync_v1 = topic(
        "Sync",
        entry(
            A_TITLE,
            A,
            ["decision"],
            "active",
            "confirmed",
            A_BODY,
            source="maintainer interview, 2026-03-01",
            revisit="the snapshot format changes",
        ),
        entry(
            "Events arrive at most once per second",
            B,
            ["constraint"],
            "active",
            "inferred",
            "The upstream feed batches events and sends at most one batch per second; "
            "nothing in this project can make it faster.\n\n**Reason:** read from the feed's "
            "rate header, not confirmed by its owner.",
            source="commit history",
        ),
    )
    storage_v1 = topic(
        "Storage",
        entry(
            C_TITLE,
            C,
            ["workaround"],
            "open",
            "unknown",
            "Writes retry three times when the lock is busy, with no backoff.\n\n"
            "**Why this needs an answer:** nobody knows where the three came from, or "
            "whether a backoff was ever tried.",
            source="code reading",
        ),
        entry(
            "The 2026-03 lock storm",
            D,
            ["incident"],
            "active",
            "confirmed",
            "A burst of retries held the lock for minutes and stalled the sync.\n\n"
            "**Consequence:** the sync now waits for the snapshot (see the sync topic).",
            source="post-mortem, 2026-03-18",
            see=[see("sync.md", A_TITLE, A, "2026-03-20")],
        ),
    )
    api_v1 = topic(
        "API",
        entry(
            E_TITLE,
            E,
            ["decision"],
            "pending-confirmation",
            "inferred",
            "Every route starts with `/v1/`.\n\n**Considered:** a version header — "
            "invisible in logs and links.",
            see=[see("storage.md", C_TITLE, C, "2026-04-15")],
        ),
        entry(
            "Responses are capped at one megabyte",
            F,
            ["constraint"],
            "needs-review",
            "confirmed",
            "A response larger than one megabyte is cut and marked as cut.",
            source="maintainer interview, 2026-04-14",
            revisit="the cap is raised by the gateway",
        ),
        entry(
            G_TITLE,
            G,
            ["decision"],
            "active",
            "confirmed",
            "Cursors are opaque strings; offsets are not offered.\n\n"
            "**Rejected alternative:** page numbers — they skip and repeat rows "
            "while the table changes underneath.",
            source="design review, 2026-04-15",
            see=[see("api.md", E_TITLE, E, "2026-04-15")],
        ),
    )
    sync_v2 = topic(
        "Sync",
        entry(
            A_TITLE,
            A,
            ["decision"],
            "superseded",
            "confirmed",
            A_BODY,
            source="maintainer interview, 2026-03-01",
            revisit="the snapshot format changes",
            superseded_by=H,
        ),
        entry(
            "Events arrive at most once per second",
            B,
            ["constraint"],
            "active",
            "inferred",
            "The upstream feed batches events and sends at most one batch per second; "
            "nothing in this project can make it faster.\n\n**Reason:** read from the feed's "
            "rate header, not confirmed by its owner.",
            source="commit history",
        ),
        entry(
            H_TITLE,
            H,
            ["decision"],
            "active",
            "confirmed",
            H_BODY,
            source="maintainer conversation, 2026-05-09",
            see=[see("sync.md", A_TITLE, A, "2026-05-10")],
        ),
        entry(
            "Clock skew between replicas is tolerated up to a second",
            K,
            ["constraint", "decision"],
            "active",
            "inferred",
            "Replicas may disagree by up to a second; the versioned replay absorbs it.",
            see=[see("sync.md", H_TITLE, H, "2026-05-10")],
        ),
    )
    storage_v2 = (
        storage_v1
        + "\n"
        + entry(
            "Temporary files live beside the database",
            I,
            ["undefined — no category fits a file location"],
            "active",
            "unknown",
            "Temporary files are written next to the database file, not to the system's temp directory.",
        )
        + "\n"
        + entry(
            "Pasted <b>markup</b> stays text",
            X,
            ["constraint"],
            "active",
            "inferred",
            HOSTILE_BODY,
            source="<img src=x onerror=alert(1)> [report](javascript:alert(2))",
        )
    )
    api_v2 = topic(
        "API",
        entry(
            E_TITLE,
            E,
            ["decision"],
            "pending-confirmation",
            "inferred",
            "Every route starts with `/v1/`.\n\n**Considered:** a version header — "
            "invisible in logs and links.",
            see=[see("storage.md", C_TITLE, C, "2026-04-15")],
        ),
        entry(
            "Responses are capped at one megabyte",
            F,
            ["constraint"],
            "active",
            "confirmed",
            "A response larger than one megabyte is cut and marked as cut.",
            source="maintainer interview, 2026-04-14",
            verification="contradicted — the gateway's limit is two megabytes since its 2026-05 update",
            revisit="the cap is raised by the gateway",
        ),
        entry(
            G_TITLE,
            G,
            ["decision"],
            "active",
            "confirmed",
            "Cursors are opaque strings; offsets are not offered.\n\n"
            "**Rejected alternative:** page numbers — they skip and repeat rows "
            "while the table changes underneath.",
            source="design review, 2026-04-15",
            see=[see("api.md", E_TITLE, E, "2026-04-15")],
        ),
        entry(
            "Errors carry a stable code beside the message",
            J,
            ["decision"],
            "active",
            "confirmed",
            "Each error has a code that never changes and a message that may.\n\n"
            "**Reason:** clients matched on messages and broke on every rewording.",
            source="[issue 12](https://github.com/acme/widget/issues/12)",
            see=[see("api.md", G_TITLE, G, "2026-06-01")],
        ),
    )
    descs = {
        "sync.md": "how the sync orders snapshot and buffer",
        "storage.md": "locks, retries and where files live",
        "api.md": "versioning, limits, pagination and errors",
    }
    base = {".keep-the-why": CONFIG}
    yield (
        "2026-03-02T10:00:00+00:00",
        "Alice Example",
        "alice@example.org",
        {
            **base,
            "context/index.md": index({"sync.md": descs["sync.md"]}),
            "context/sync.md": sync_v1,
        },
    )
    yield (
        "2026-03-20T14:30:00+00:00",
        "Bob Example",
        "bob@example.org",
        {
            "context/index.md": index({k: descs[k] for k in ("sync.md", "storage.md")}),
            "context/storage.md": storage_v1,
        },
    )
    yield (
        "2026-04-15T09:15:00+00:00",
        "Alice Example",
        "alice@example.org",
        {"context/index.md": index(descs), "context/api.md": api_v1},
    )
    yield (
        "2026-05-10T16:45:00+00:00",
        "Carol Example",
        "carol@example.org",
        {"context/sync.md": sync_v2, "context/storage.md": storage_v2},
    )
    yield (
        "2026-06-01T08:00:00+00:00",
        "Bob Example",
        "bob@example.org",
        {"context/api.md": api_v2},
    )


def build_state():
    from ktw_dashboard.state import StateBuilder

    with tempfile.TemporaryDirectory() as tmp:
        repo = os.path.join(tmp, "widget")
        os.makedirs(os.path.join(repo, "context"))

        def git(*args, env=None):
            subprocess.run(
                ["git", *args],
                cwd=repo,
                check=True,
                capture_output=True,
                env={**os.environ, **(env or {})},
            )

        git("init", "-q", "-b", "main")
        git("remote", "add", "origin", "https://github.com/acme/widget.git")
        for date, name, mail, files in commits():
            for path, text in files.items():
                with open(os.path.join(repo, path), "w", encoding="utf-8") as fh:
                    fh.write(text)
            git("add", "-A")
            env = {
                "GIT_AUTHOR_NAME": name,
                "GIT_AUTHOR_EMAIL": mail,
                "GIT_AUTHOR_DATE": date,
                "GIT_COMMITTER_NAME": name,
                "GIT_COMMITTER_EMAIL": mail,
                "GIT_COMMITTER_DATE": date,
            }
            git(
                "-c",
                "commit.gpgsign=false",
                "commit",
                "-q",
                "-m",
                f"context: {date[:10]}",
                env=env,
            )
        state = StateBuilder(repo).build()
    state["exported"] = True
    state.update(VERSIONS)
    state["generated"] = GENERATED
    # the machine's path to the temporary clone is not part of the project
    _scrub(state, repo, "/fixture/widget")
    return state


def _scrub(node, old, new):
    """Replace a machine path wherever a string carries it."""
    if isinstance(node, dict):
        for k, v in node.items():
            node[k] = _scrub(v, old, new)
    elif isinstance(node, list):
        return [_scrub(v, old, new) for v in node]
    elif isinstance(node, str):
        return node.replace(old, new)
    return node


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--page", metavar="OUT", help="render the page from the frozen state to OUT"
    )
    args = ap.parse_args()
    if args.page:
        from ktw_dashboard.export import render_page

        with open(STATE, encoding="utf-8") as fh:
            state = json.load(fh)
        with open(args.page, "w", encoding="utf-8") as fh:
            fh.write(render_page(state))
        print(f"rendered {args.page} from {os.path.relpath(STATE)}")
        return 0
    state = build_state()
    with open(STATE, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")
    print(
        f"wrote {os.path.relpath(STATE)}: {len(state['entries'])} entries, "
        f"{len(state['topics'])} topics, {len(state['authors'])} authors, "
        f"{len(state.get('findings') or [])} findings"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
