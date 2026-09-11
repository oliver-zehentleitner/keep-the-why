"""State builder against a throwaway project with a real Git history."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest

from ktw_dashboard.export import render_page
from ktw_dashboard.state import StateBuilder, slugify

CONFIG = """<!-- keep-the-why:config -->
- id: acme---widget
- context: `context/`
- init: complete
- context-schema: 0.16.1
- capture-confirmation: automatic
- source-reference: never
<!-- /keep-the-why:config -->
"""

INDEX_HEADS = "\n\n".join(
    f"## {h}" for h in [*"0123456789", *"ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
)

SYNC_V1 = """# Sync

## Snapshot before buffer

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14

The sync step waits for a full snapshot before applying buffered events.

**Reason:** replaying first caused duplicate state; see `incidents.md`.

**Rejected alternative:** parallel replay with reconciliation.
"""

SYNC_V2 = SYNC_V1.replace("**Status:** active", "**Status:** superseded") + """
## Streaming snapshot

**Type:** decision
**Status:** active
**Evidence:** inferred

Replaces the entry above.
"""

INCIDENTS = """# Incidents

## 2025-11 duplicate state

**Type:** incident
**Status:** open
**Evidence:** unknown

Duplicate-then-overwritten state during a replay.

**Why this needs an answer:** the root cause was never confirmed.
"""


def git(cwd, *args, env=None):
    e = {
        **os.environ,
        "GIT_AUTHOR_DATE": "2026-05-01T10:00:00",
        "GIT_COMMITTER_DATE": "2026-05-01T10:00:00",
    }
    if env:
        e.update(env)
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, env=e)


class StateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="ktw-dash-test-")
        self.root = self.tmp.name
        ctx = os.path.join(self.root, "context")
        os.makedirs(ctx)
        with open(os.path.join(self.root, ".keep-the-why"), "w") as fh:
            fh.write(CONFIG)
        with open(os.path.join(ctx, "index.md"), "w") as fh:
            fh.write(
                "# Context index\n\n"
                + INDEX_HEADS.replace(
                    "## I", "## I\n\n- [incidents.md](incidents.md) — what went wrong"
                ).replace("## S", "## S\n\n- [sync.md](sync.md) — the sync protocol")
                + "\n"
            )
        with open(os.path.join(ctx, "sync.md"), "w") as fh:
            fh.write(SYNC_V1)
        with open(os.path.join(ctx, "incidents.md"), "w") as fh:
            fh.write(INCIDENTS)
        git(self.root, "init", "-q", "-b", "main")
        git(self.root, "config", "user.email", "alice@example.com")
        git(self.root, "config", "user.name", "Alice")
        git(self.root, "add", ".")
        git(self.root, "commit", "-q", "-m", "seed")
        with open(os.path.join(ctx, "sync.md"), "w") as fh:
            fh.write(SYNC_V2)
        git(self.root, "config", "user.name", "Bob")
        git(self.root, "config", "user.email", "bob@example.com")
        git(self.root, "add", ".")
        git(
            self.root,
            "commit",
            "-q",
            "-m",
            "supersede",
            env={
                "GIT_AUTHOR_DATE": "2026-06-02T10:00:00",
                "GIT_COMMITTER_DATE": "2026-06-02T10:00:00",
            },
        )

    def tearDown(self):
        self.tmp.cleanup()

    def test_entries_bodies_refs_and_git(self):
        s = StateBuilder(self.root).build()
        self.assertEqual(s["project"]["id"], "acme---widget")
        self.assertEqual(s["project"]["schema"], "0.16.1")
        self.assertTrue(s["project"]["git"]["available"])
        self.assertEqual([t["file"] for t in s["topics"]], ["incidents.md", "sync.md"])
        by_id = {e["id"]: e for e in s["entries"]}
        snap = by_id["sync.md#snapshot-before-buffer"]
        self.assertEqual(snap["status"], "superseded")
        self.assertEqual(snap["type"], ["decision"])
        self.assertIn("duplicate state", snap["body"]["reason"])
        self.assertEqual(
            snap["body"]["rejected"], ["parallel replay with reconciliation."]
        )
        self.assertEqual(snap["refs"], ["incidents.md"])
        self.assertEqual(snap["git"]["created"]["author"], "Alice")
        self.assertEqual(snap["git"]["created"]["date"], "2026-05-01")
        self.assertEqual(snap["git"]["last_touched"]["author"], "Bob")
        self.assertEqual(
            [h["status"] for h in snap["git"]["status_history"]],
            ["active", "superseded"],
        )
        self.assertEqual(snap["git"]["status_history"][1]["author"], "Bob")
        stream = by_id["sync.md#streaming-snapshot"]
        self.assertEqual(stream["git"]["created"]["author"], "Bob")
        inc = by_id["incidents.md#2025-11-duplicate-state"]
        self.assertEqual(inc["status"], "open")
        self.assertIn("never confirmed", inc["body"]["why_open"])
        topics = {t["file"]: t for t in s["topics"]}
        self.assertEqual(topics["sync.md"]["refs_out"], ["incidents.md"])
        self.assertEqual(topics["incidents.md"]["refs_in"], ["sync.md"])
        self.assertEqual(topics["sync.md"]["index_line"], "the sync protocol")
        authors = {a["name"]: a for a in s["authors"]}
        self.assertEqual(authors["Alice"]["created"], 2)
        self.assertEqual(authors["Bob"]["created"], 1)
        self.assertEqual(authors["Bob"]["superseded"], 1)
        self.assertEqual(s["findings"]["errors"], 0)

    def test_working_tree_changes_are_attributed_to_the_working_tree(self):
        with open(os.path.join(self.root, "context", "incidents.md"), "a") as fh:
            fh.write(
                "\n## Fresh\n\n**Type:** incident\n**Status:** active\n**Evidence:** confirmed\n\nJust written.\n"
            )
        s = StateBuilder(self.root).build()
        fresh = next(e for e in s["entries"] if e["id"] == "incidents.md#fresh")
        self.assertEqual(fresh["git"]["created"]["author"], "working tree")
        self.assertEqual(fresh["git"]["last_touched"]["author"], "working tree")
        self.assertEqual(fresh["git"]["status_history"], [])

    def test_anonymize_and_no_emails(self):
        s = StateBuilder(self.root, anonymize=True).build()
        names = {a["name"] for a in s["authors"]}
        self.assertEqual(names, {"author-1", "author-2"})
        self.assertNotIn("@example.com", json.dumps(s))

    def test_fingerprint_changes_on_edit(self):
        b = StateBuilder(self.root)
        fp1 = b.fingerprint()
        with open(os.path.join(self.root, "context", "sync.md"), "a") as fh:
            fh.write("\n")
        self.assertNotEqual(fp1, b.fingerprint())

    def test_without_git(self):
        subprocess.run(["rm", "-rf", os.path.join(self.root, ".git")], check=True)
        s = StateBuilder(self.root).build()
        self.assertFalse(s["project"]["git"]["available"])
        self.assertIsNone(s["entries"][0]["git"])
        self.assertEqual(s["authors"], [])

    def test_export_is_self_contained_and_escapes_script_tags(self):
        with open(os.path.join(self.root, "context", "incidents.md"), "a") as fh:
            fh.write("\nA body that mentions </script> literally.\n")
        html = render_page(StateBuilder(self.root).build())
        self.assertIn("window.__KTW_STATE__", html)
        self.assertNotIn('src="/static', html)
        self.assertNotIn('href="/static', html)
        payload = html.split("window.__KTW_STATE__ = ", 1)[1].split(";</script>", 1)[0]
        self.assertNotIn("</script>", payload)
        self.assertIn("<\\/script>", payload)

    def test_slugify(self):
        self.assertEqual(
            slugify("`WSUpgradeRequest` / `WSUpgradeResponse` keep a shape"),
            "wsupgraderequest-wsupgraderesponse-keep-a-shape",
        )


if __name__ == "__main__":
    unittest.main()


class ProjectsTest(unittest.TestCase):
    """Project discovery and the dashboard history, with HOME in a temp directory."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="ktw-dash-projects-")
        self.home = os.path.join(self.tmp.name, "home")
        self.work = os.path.join(self.tmp.name, "work")
        os.makedirs(os.path.join(self.home, ".keep-the-why"))
        for pid in ("acme---alpha", "acme---beta", "acme---gone"):
            with open(os.path.join(self.home, ".keep-the-why", f"{pid}.md"), "w") as fh:
                fh.write(
                    "<!-- keep-the-why:personal -->\n- capture-mode: proactive\n<!-- /keep-the-why:personal -->\n"
                )
        with open(os.path.join(self.home, ".keep-the-why", "config"), "w") as fh:
            fh.write(
                "<!-- keep-the-why:global -->\n- personal-defaults-policy: always-ask\n<!-- /keep-the-why:global -->\n"
            )
        for pid, sub in (
            ("acme---alpha", "alpha"),
            ("acme---beta", "group/beta"),
            ("acme---orphan", "orphan"),
        ):
            self._project(pid, os.path.join(self.work, sub))
        self._old_home = os.environ.get("HOME")
        os.environ["HOME"] = self.home

    def _project(self, pid, path):
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, ".keep-the-why"), "w") as fh:
            fh.write(CONFIG.replace("acme---widget", pid))
        return path

    def tearDown(self):
        if self._old_home is not None:
            os.environ["HOME"] = self._old_home
        self.tmp.cleanup()

    def test_resolve_from_inside_a_project(self):
        from ktw_dashboard.projects import resolve

        projects, selected = resolve(os.path.join(self.work, "alpha"))
        self.assertEqual(selected, os.path.join(self.work, "alpha"))
        self.assertEqual(projects[0].source, "cwd")
        by_id = {p.id: p for p in projects}
        self.assertEqual(
            by_id["acme---beta"].source, "scan"
        )  # two levels below the parent
        self.assertEqual(
            by_id["acme---orphan"].source, "scan"
        )  # no personal file, still showable
        self.assertIsNone(by_id["acme---gone"].path)
        self.assertEqual(by_id["acme---gone"].source, "unresolved")

    def test_history_orders_by_last_opened_and_allows_one_id_at_two_paths(self):
        from ktw_dashboard.projects import history_path, record_open, resolve

        clone_a = self._project(
            "acme---twin", os.path.join(self.tmp.name, "far", "deep", "er", "twin-a")
        )
        clone_b = self._project(
            "acme---twin", os.path.join(self.tmp.name, "far", "deep", "er", "twin-b")
        )
        record_open("acme---twin", clone_a)
        record_open("acme---twin", clone_b)
        record_open("acme---twin", clone_a)  # opened again: back to the top
        elsewhere = os.path.join(self.tmp.name, "elsewhere")
        os.makedirs(elsewhere)
        projects, selected = resolve(elsewhere)
        recent = [p for p in projects if p.source == "history"]
        self.assertEqual([p.path for p in recent], [clone_a, clone_b])
        self.assertEqual(selected, clone_a)
        self.assertTrue(os.path.exists(history_path()))
        self.assertEqual(len({p.key for p in projects}), len(projects))

    def test_history_drops_paths_that_are_gone_and_caps_the_list(self):
        from ktw_dashboard.projects import HISTORY_LIMIT, record_open, resolve

        record_open("acme---ghost", os.path.join(self.tmp.name, "nowhere"))
        for i in range(HISTORY_LIMIT + 3):
            record_open(
                f"acme---p{i}",
                self._project(
                    f"acme---p{i}",
                    os.path.join(self.tmp.name, "many", "x", "y", f"p{i}"),
                ),
            )
        elsewhere = os.path.join(self.tmp.name, "elsewhere")
        os.makedirs(elsewhere)
        projects, _ = resolve(elsewhere)
        recent = [p for p in projects if p.source == "history"]
        self.assertEqual(len(recent), HISTORY_LIMIT)
        self.assertEqual(recent[0].id, f"acme---p{HISTORY_LIMIT + 2}")
        self.assertNotIn("acme---ghost", {p.id for p in projects})

    def test_no_history_writes_nothing(self):
        from ktw_dashboard.projects import history_path, resolve

        resolve(os.path.join(self.work, "alpha"), use_history=False)
        self.assertFalse(os.path.exists(history_path()))


class UpdatesTest(unittest.TestCase):
    def test_version_compare(self):
        from ktw_dashboard.updates import is_newer

        self.assertTrue(is_newer("0.1.1", "0.1.0"))
        self.assertTrue(is_newer("0.16.2.0", "0.16.1.3"))
        self.assertFalse(is_newer("0.16.1.0", "0.16.1.0"))
        self.assertFalse(is_newer("0.9.9", "0.16.1.0"))

    def test_check_with_fake_index(self):
        from ktw_dashboard.updates import check

        seen = {}

        def fake(name):
            seen[name] = True
            return {"keep-the-why-dashboard": "99.0.0", "keep-the-why-lint": None}[name]

        r = check(fetch=fake)
        self.assertEqual(sorted(seen), ["keep-the-why-dashboard", "keep-the-why-lint"])
        self.assertTrue(r["keep-the-why-dashboard"]["outdated"])
        self.assertEqual(r["keep-the-why-dashboard"]["latest"], "99.0.0")
        self.assertFalse(
            r["keep-the-why-lint"]["outdated"]
        )  # lookup failed: no claim either way
        self.assertIsNone(r["keep-the-why-lint"]["latest"])

    def test_disabled_checker_never_starts(self):
        from ktw_dashboard.updates import UpdateChecker

        c = UpdateChecker(enabled=False)
        self.assertIsNone(c.start())
        self.assertIn(b'"enabled": false', c.payload())


class ServerWiringTest(unittest.TestCase):
    def test_projects_manager_carries_an_update_checker(self):
        from ktw_dashboard.server import Projects

        m = Projects(
            [],
            None,
            interval=2.0,
            anonymize=False,
            use_history=False,
            update_check=False,
        )
        self.assertFalse(m.updates.enabled)
        self.assertIsNone(m.updates.start())
        m.stop()
