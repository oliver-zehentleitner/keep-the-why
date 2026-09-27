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

    # -- the tree is the boundary (the linter's E009, applied to reads) ----

    def _outside(self):
        out = tempfile.TemporaryDirectory(prefix="ktw-dash-outside-")
        self.addCleanup(out.cleanup)
        with open(os.path.join(out.name, "leak.md"), "w") as fh:
            fh.write(
                "# Outside\n\n## Leaked\n\n**Type:** decision\n**Status:** active\n"
                "**Evidence:** confirmed\n\nSYNTHETIC_OUTSIDE_MARKER\n"
            )
        with open(os.path.join(out.name, "index.md"), "w") as fh:
            fh.write("# Context index\n\n## L\n\n- [leak.md](leak.md) — leak\n")
        return out.name

    def test_rejected_context_location_is_not_read(self):
        outside = self._outside()
        rel = os.path.relpath(outside, self.root)
        with open(os.path.join(self.root, ".keep-the-why"), "w") as fh:
            fh.write(CONFIG.replace("`context/`", f"`{rel}/`"))
        s = StateBuilder(self.root).build()
        self.assertIn("E009", [f["code"] for f in s["findings"]["items"]])
        self.assertEqual(s["entries"], [])
        self.assertEqual(s["topics"], [])
        self.assertNotIn("SYNTHETIC_OUTSIDE_MARKER", json.dumps(s))
        self.assertNotIn("SYNTHETIC_OUTSIDE_MARKER", render_page(s))

    def test_topic_symlink_leaving_the_tree_is_skipped(self):
        outside = self._outside()
        os.symlink(
            os.path.join(outside, "leak.md"),
            os.path.join(self.root, "context", "leak.md"),
        )
        s = StateBuilder(self.root).build()
        self.assertNotIn("leak.md", [t["file"] for t in s["topics"]])
        self.assertNotIn("SYNTHETIC_OUTSIDE_MARKER", json.dumps(s))
        self.assertEqual(len(s["topics"]), 2)  # sync.md and incidents.md still read

    def test_index_symlink_leaving_the_tree_is_ignored(self):
        outside = self._outside()
        os.remove(os.path.join(self.root, "context", "index.md"))
        os.symlink(
            os.path.join(outside, "index.md"),
            os.path.join(self.root, "context", "index.md"),
        )
        s = StateBuilder(self.root).build()
        self.assertEqual([t["index_line"] for t in s["topics"]], ["", ""])
        self.assertNotIn("leak", json.dumps(s["topics"]))

    def test_context_directory_symlink_leaving_the_tree_is_not_read(self):
        outside = self._outside()
        ctx = os.path.join(self.root, "context")
        for n in os.listdir(ctx):
            os.remove(os.path.join(ctx, n))
        os.rmdir(ctx)
        os.symlink(outside, ctx)
        b = StateBuilder(self.root)
        s = b.build()
        self.assertEqual(s["entries"], [])
        self.assertNotIn("SYNTHETIC_OUTSIDE_MARKER", json.dumps(s))
        self.assertIsInstance(b.fingerprint(), str)

    def test_shallow_flag_is_reported(self):
        s = StateBuilder(self.root).build()
        self.assertFalse(s["project"]["git"]["shallow"])
        clone = tempfile.TemporaryDirectory(prefix="ktw-dash-shallow-")
        self.addCleanup(clone.cleanup)
        dest = os.path.join(clone.name, "c")
        subprocess.run(
            ["git", "clone", "-q", "--depth", "1", f"file://{self.root}", dest],
            check=True,
            capture_output=True,
        )
        self.assertTrue(StateBuilder(dest).build()["project"]["git"]["shallow"])

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


class ProjectsJsonTest(unittest.TestCase):
    """projects.json, the mapping shared with the skill, and the fold-in of the
    pre-0.2.0 dashboard-history.json."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="ktw-dash-mapping-")
        self.home = os.path.join(self.tmp.name, "home")
        self.work = os.path.join(self.tmp.name, "work")
        os.makedirs(os.path.join(self.home, ".keep-the-why"))
        self.alpha = os.path.join(self.work, "alpha")
        os.makedirs(self.alpha)
        with open(os.path.join(self.alpha, ".keep-the-why"), "w") as fh:
            fh.write(
                CONFIG.replace(
                    "- id: acme---widget",
                    "- id: acme---alpha\n- canonical: https://github.com/acme/alpha",
                )
            )
        self._old_home = os.environ.get("HOME")
        os.environ["HOME"] = self.home

    def tearDown(self):
        if self._old_home is not None:
            os.environ["HOME"] = self._old_home
        self.tmp.cleanup()

    def test_legacy_history_is_folded_in_and_removed(self):
        from ktw_dashboard import projects as P

        legacy = os.path.join(self.home, ".keep-the-why", "dashboard-history.json")
        with open(legacy, "w") as fh:
            json.dump(
                {
                    "dashboard-history": 1,
                    "projects": [
                        {
                            "id": "acme---alpha",
                            "path": self.alpha,
                            "last_opened": "2026-09-01T10:00:00",
                        },
                        {
                            "id": "acme---alpha",
                            "path": "/elsewhere/alpha",
                            "last_opened": "2026-08-01T10:00:00",
                        },
                        {
                            "id": "acme---beta",
                            "path": "/x/beta",
                            "last_opened": "2026-07-01T10:00:00",
                        },
                    ],
                },
                fh,
            )
        rows = P.load_projects()
        self.assertEqual({r["id"] for r in rows}, {"acme---alpha", "acme---beta"})
        alpha = next(r for r in rows if r["id"] == "acme---alpha")
        self.assertEqual(
            [p["path"] for p in alpha["paths"]], [self.alpha, "/elsewhere/alpha"]
        )
        self.assertFalse(os.path.exists(legacy))
        with open(P.projects_path()) as fh:
            data = json.load(fh)
        self.assertEqual(data["projects-json"], 1)
        # the flattened history the menu uses, most recent first
        self.assertEqual(
            [h["path"] for h in P.load_history()][:2], [self.alpha, "/elsewhere/alpha"]
        )

    def test_record_open_writes_canonical_and_last_seen(self):
        from ktw_dashboard import projects as P

        P.record_open("acme---alpha", self.alpha)
        rows = P.load_projects()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["canonical"], "https://github.com/acme/alpha")
        self.assertEqual(rows[0]["paths"][0]["path"], self.alpha)
        self.assertTrue(rows[0]["paths"][0]["last_seen"])
        P.record_open("acme---alpha", self.alpha)  # again: still one path
        self.assertEqual(len(P.load_projects()[0]["paths"]), 1)


class EntryIdentityTest(StateTest):
    """Id, See and Superseded by reach the state, and See lines are edges."""

    def test_uuid_see_and_edges(self):
        from ktw_dashboard.export import badge_text, render_badge

        uid = "550e8400-e29b-41d4-a716-446655440000"
        inc = "9b2d4f60-7c1e-4a8b-b3d5-6e7f8a9b0c1d"
        with open(os.path.join(self.root, "context", "sync.md"), "w") as fh:
            fh.write(
                "# Sync\n\n## Snapshot before buffer\n\n"
                f"**Id:** {uid}\n**Type:** decision\n**Status:** active\n**Evidence:** confirmed\n"
                f"**See:** incidents.md#2025-11-duplicate-state — {inc} — as of 2026-09-27\n"
                f"**See:** https://github.com/acme/other — {inc} — as of 2026-09-27\n\n"
                "The sync step waits.\n"
            )
        state = StateBuilder(self.root).build()
        e = next(x for x in state["entries"] if x["file"] == "sync.md")
        self.assertEqual(e["uuid"], uid)
        self.assertEqual(len(e["see"]), 2)
        self.assertEqual(e["see"][0]["file"], "incidents.md")
        self.assertEqual(e["see"][0]["anchor"], "2025-11-duplicate-state")
        self.assertEqual(e["see"][1]["remote"], "https://github.com/acme/other")
        self.assertIn("incidents.md", e["refs"])  # the See line is an edge
        sync = next(t for t in state["topics"] if t["file"] == "sync.md")
        self.assertIn("incidents.md", sync["refs_out"])
        self.assertEqual(badge_text(state), "2 entries · 1 open")
        svg = render_badge(state)
        self.assertTrue(svg.startswith("<svg "))
        self.assertIn("2 entries · 1 open", svg)


class FamilyTest(unittest.TestCase):
    """The family of a project — parent, children, siblings — resolved against
    what the machine knows, cache rows in the project list, and `forget`."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="ktw-dash-family-")
        self.home = os.path.join(self.tmp.name, "home")
        self.work = os.path.join(self.tmp.name, "work")
        os.makedirs(os.path.join(self.home, ".keep-the-why", "cache"))
        self._old_home = os.environ.get("HOME")
        os.environ["HOME"] = self.home
        # a suite: parent lists two children by URL; one child is checked out
        # next to it, the other exists only as a cache
        self.suite = self._project(
            "suite",
            "acme---suite",
            "https://github.com/acme/suite",
            extra=(
                "\n<!-- keep-the-why:children -->\n"
                "- rest: https://github.com/acme/rest — REST client, rate limits\n"
                "- ws: https://github.com/acme/ws — stream client\n"
                "<!-- /keep-the-why:children -->\n"
            ),
        )
        self.rest = self._project(
            "rest",
            "acme---rest",
            "https://github.com/acme/rest",
            parent="https://github.com/acme/suite",
        )
        self.ws_cache = os.path.join(self.home, ".keep-the-why", "cache", "acme---ws")
        self._project(
            self.ws_cache,
            "acme---ws",
            "https://github.com/acme/ws",
            parent="https://github.com/acme/suite",
            absolute=True,
        )
        from ktw_dashboard import projects as P

        P.save_projects(
            [
                {
                    "id": "acme---ws",
                    "canonical": "https://github.com/acme/ws",
                    "root": "",
                    "paths": [],
                    "cache": self.ws_cache,
                }
            ]
        )

    def _project(self, sub, pid, canonical, parent="", extra="", absolute=False):
        path = sub if absolute else os.path.join(self.work, sub)
        os.makedirs(os.path.join(path, "context"), exist_ok=True)
        cfg = CONFIG.replace(
            "- id: acme---widget",
            f"- id: {pid}\n- canonical: {canonical}"
            + (f"\n- parent: {parent}" if parent else ""),
        )
        with open(os.path.join(path, ".keep-the-why"), "w") as fh:
            fh.write(cfg + extra)
        with open(os.path.join(path, "context", "index.md"), "w") as fh:
            fh.write(
                "# Context index\n\n"
                + INDEX_HEADS.replace("## S", "## S\n\n- [sync.md](sync.md) — sync")
                + "\n"
            )
        with open(os.path.join(path, "context", "sync.md"), "w") as fh:
            fh.write(
                SYNC_V1.replace(
                    "## Snapshot before buffer\n",
                    f"## Snapshot before buffer\n\n**Id:** 550e8400-e29b-41d4-a716-{pid[-12:].replace('-', '0').ljust(12, '0')}\n",
                )
            )
        return path

    def tearDown(self):
        if self._old_home is not None:
            os.environ["HOME"] = self._old_home
        self.tmp.cleanup()

    def test_cache_rows_and_kinds(self):
        from ktw_dashboard.projects import resolve

        projects, _ = resolve(self.rest)
        kinds = {p.id: p.kind for p in projects if p.path}
        self.assertEqual(kinds["acme---rest"], "repository")
        self.assertEqual(kinds["acme---suite"], "repository")
        self.assertEqual(kinds["acme---ws"], "cache")
        rest = next(p for p in projects if p.id == "acme---rest")
        self.assertEqual(rest.parent, "https://github.com/acme/suite")
        self.assertEqual(rest.canonical, "https://github.com/acme/rest")

    def test_family_from_a_child(self):
        from ktw_dashboard.projects import family, resolve

        projects, _ = resolve(self.rest)
        me = next(p for p in projects if p.id == "acme---rest")
        members = family(me, projects)
        roles = {(m["role"], m["name"]): m for m in members}
        self.assertEqual(roles[("self", "rest")]["scope"], "REST client, rate limits")
        parent = roles[("parent", "suite")]
        self.assertEqual(parent["available"], "repository")
        ws = roles[("sibling", "ws")]
        self.assertEqual(ws["available"], "cache")
        self.assertEqual(ws["scope"], "stream client")

    def test_family_from_the_parent_names_the_missing_member(self):
        from ktw_dashboard import projects as P
        from ktw_dashboard.projects import family, resolve

        P.save_projects([])  # no cache known any more
        import shutil

        shutil.rmtree(self.ws_cache)
        projects, _ = resolve(self.suite)
        me = next(p for p in projects if p.id == "acme---suite")
        members = family(me, projects)
        ws = next(m for m in members if m["name"] == "ws")
        self.assertEqual(ws["available"], "none")
        self.assertIn(
            "git clone --filter=blob:none --sparse https://github.com/acme/ws",
            ws["fetch"]["cache"],
        )
        self.assertIn(".keep-the-why", ws["fetch"]["cache"])

    def test_forget_a_cache_removes_the_directory_and_a_path_only_the_row(self):
        from ktw_dashboard import projects as P

        P.record_open("acme---rest", self.rest)
        self.assertTrue(P.forget(self.rest))
        self.assertTrue(os.path.isdir(self.rest))  # a working tree is never touched
        self.assertEqual([p for r in P.load_projects() for p in r["paths"]], [])
        self.assertTrue(P.forget(self.ws_cache))
        self.assertFalse(os.path.exists(self.ws_cache))
        self.assertFalse(any("cache" in r for r in P.load_projects()))
        self.assertFalse(P.forget("/nowhere"))

    def test_server_finds_an_entry_by_uuid_across_projects(self):
        from ktw_dashboard.projects import resolve
        from ktw_dashboard.server import Projects

        projects, selected = resolve(self.rest)
        srv = Projects(
            projects,
            selected,
            interval=60,
            anonymize=False,
            use_history=False,
            update_check=False,
        )
        try:
            state = json.loads(srv.live(selected).payload)
            self.assertEqual(
                state["project"]["parent"], "https://github.com/acme/suite"
            )
            suite_uuid = "550e8400-e29b-41d4-a716-" + "acme---suite"[-12:].replace(
                "-", "0"
            ).ljust(12, "0")
            hit = srv.find_entry(suite_uuid, selected)
            self.assertIsNotNone(hit)
            self.assertEqual(hit["project"], self.suite)
            self.assertEqual(hit["entry"]["uuid"], suite_uuid)
            self.assertIsNone(
                srv.find_entry("00000000-0000-4000-8000-000000000000", selected)
            )
            suite_state = json.loads(srv.live(self.suite).payload)
            self.assertEqual(
                [c["name"] for c in suite_state["project"]["children"]], ["rest", "ws"]
            )
            self.assertTrue(srv.forget(self.suite))
            self.assertIsNone(srv.by_key(self.suite))
        finally:
            srv.stop()


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
