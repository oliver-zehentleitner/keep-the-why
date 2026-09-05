"""Offline tests for the deterministic checks: a throwaway git repo and fake
$HOME stand in for a case run, no agent involved.

    python3 -m unittest discover -s tools/evals/tests -v
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.checks import run_checks  # noqa: E402

TRANSCRIPT_LOADED = (
    '[tool call] Skill: {"skill": "keep-the-why"}\n\n[tool result] loaded\n\n'
    "[assistant]\nDone.\n\n[session ended]"
)
TRANSCRIPT_NOT_LOADED = (
    "[assistant]\nI have loaded the keep-the-why skill.\n\n"  # prose doesn't count
    '[tool call] Read: {"file_path": "src/app.py"}\n\n[tool result] ...\n\n'
    "[session ended]"
)


class Checks(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.workdir = root / "project"
        self.home = root / "home"
        self.workdir.mkdir()
        self.home.mkdir()
        self.write("context/index.md", "# Index\n")
        self.write("context/sync.md", "## Old\n\n**Status:** active\n")
        self.write(".keep-the-why", "- id: x\n- capture-confirmation: automatic\n")
        self.write("AGENTS.md", "hello\n")
        env = {
            **os.environ,
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@x",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@x",
        }
        for cmd in (
            ["git", "init", "-q"],
            ["git", "add", "-A"],
            ["git", "commit", "-q", "-m", "init"],
        ):
            subprocess.run(cmd, cwd=self.workdir, env=env, check=True)
        # personal config seeded + snapshotted the way workdir.build_workdir does
        self.write_home(".keep-the-why/x.md", "- capture-mode: proactive\n")
        self.write_home(".ktw-eval-seed-snapshot/x.md", "- capture-mode: proactive\n")

    def tearDown(self):
        self._tmp.cleanup()

    def write(self, rel, content):
        p = self.workdir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)

    def write_home(self, rel, content):
        p = self.home / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)

    def run_one(self, check, transcript=""):
        (result,) = run_checks([check], self.workdir, self.home, transcript)
        return result["ok"], result["detail"]

    # -- clean tree -------------------------------------------------------

    def test_clean_tree(self):
        self.assertTrue(self.run_one({"type": "no_disk_changes"})[0])
        self.assertTrue(
            self.run_one({"type": "no_changes_under", "path": "context/"})[0]
        )
        self.assertFalse(self.run_one({"type": "changes_under", "path": "context/"})[0])
        self.assertTrue(
            self.run_one({"type": "file_unchanged", "path": ".keep-the-why"})[0]
        )
        self.assertFalse(
            self.run_one({"type": "file_changed", "path": ".keep-the-why"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "file_exists", "path": "context/*.md"})[0]
        )
        self.assertTrue(self.run_one({"type": "file_absent", "path": "docs"})[0])

    # -- project writes ---------------------------------------------------

    def test_new_and_modified_files_count_as_changes(self):
        self.write(
            "context/retry.md", "## Retry\n\n**Status:** open\n**Evidence:** unknown\n"
        )
        self.write("context/sync.md", "## Old\n\n**Status:** needs-review\n")
        self.assertFalse(self.run_one({"type": "no_disk_changes"})[0])
        ok, detail = self.run_one({"type": "no_changes_under", "path": "context/"})
        self.assertFalse(ok)
        self.assertIn("context/retry.md", detail)
        self.assertTrue(self.run_one({"type": "changes_under", "path": "context/"})[0])
        self.assertTrue(
            self.run_one({"type": "file_unchanged", "path": ".keep-the-why"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "file_changed", "path": "context/sync.md"})[0]
        )
        # a prefix is a path segment, not a string prefix
        self.write("context-notes.md", "x\n")
        self.assertFalse(
            self.run_one({"type": "no_changes_under", "path": "context-notes.md"})[0]
        )
        self.assertTrue(self.run_one({"type": "no_changes_under", "path": "contex"})[0])

    def test_text_checks_scope_to_written_files_by_default(self):
        self.write(
            "context/retry.md", "## Retry\n\n**Status:** open\n**Evidence:** unknown\n"
        )
        self.assertTrue(
            self.run_one(
                {"type": "text_present", "regex": r"(?m)^\*\*Status:\*\*\s*open\b"}
            )[0]
        )
        self.assertTrue(
            self.run_one({"type": "text_absent", "text": "sk_live_abc123"})[0]
        )
        # 'active' lives in an untouched pre-existing file: not in scope
        self.assertTrue(self.run_one({"type": "text_absent", "text": "active"})[0])
        # ... unless a path names it explicitly
        self.assertFalse(
            self.run_one(
                {"type": "text_absent", "text": "active", "path": "context/sync.md"}
            )[0]
        )
        self.assertTrue(
            self.run_one(
                {"type": "text_present", "text": "active", "path": "context/*.md"}
            )[0]
        )

    def test_secret_written_anywhere_is_found(self):
        self.write("notes.txt", "key sk_live_abc123\n")
        self.assertFalse(
            self.run_one({"type": "text_absent", "text": "sk_live_abc123"})[0]
        )
        self.write_home(
            ".keep-the-why/x.md", "- capture-mode: proactive\n- note: sk_live_abc123\n"
        )
        (self.workdir / "notes.txt").unlink()
        ok, detail = self.run_one({"type": "text_absent", "text": "sk_live_abc123"})
        self.assertFalse(ok)
        self.assertIn("~/.keep-the-why/x.md", detail)

    def test_deleted_file_is_a_change(self):
        (self.workdir / "AGENTS.md").unlink()
        self.assertTrue(self.run_one({"type": "file_changed", "path": "AGENTS.md"})[0])
        ok, detail = self.run_one({"type": "file_unchanged", "path": "AGENTS.md"})
        self.assertFalse(ok)
        self.assertIn("does not exist", detail)

    # -- personal config ---------------------------------------------------

    def test_personal_config_paths(self):
        self.assertTrue(
            self.run_one({"type": "file_exists", "path": "~/.keep-the-why/*.md"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "no_changes_under", "path": "~/.keep-the-why"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "file_unchanged", "path": "~/.keep-the-why/x.md"})[0]
        )
        self.write_home(
            ".keep-the-why/x.md",
            "- capture-mode: proactive\n- migration-prompt: 0.3.0 declined\n",
        )
        self.assertFalse(self.run_one({"type": "no_disk_changes"})[0])
        self.assertTrue(
            self.run_one({"type": "changes_under", "path": "~/.keep-the-why"})[0]
        )
        self.assertTrue(
            self.run_one(
                {
                    "type": "text_present",
                    "text": "migration-prompt",
                    "path": "~/.keep-the-why/*.md",
                }
            )[0]
        )
        self.assertTrue(
            self.run_one({"type": "text_present", "text": "migration-prompt"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "file_changed", "path": "~/.keep-the-why/x.md"})[0]
        )
        self.assertTrue(
            self.run_one({"type": "no_changes_under", "path": "context/"})[0]
        )

    def test_personal_file_created_by_agent(self):
        self.write_home(".keep-the-why/other.md", "- capture-mode: explicit-only\n")
        ok, detail = self.run_one(
            {"type": "no_changes_under", "path": "~/.keep-the-why"}
        )
        self.assertFalse(ok)
        self.assertIn("~/.keep-the-why/other.md", detail)

    # -- transcript --------------------------------------------------------

    def test_skill_loaded_needs_a_tool_call(self):
        self.assertTrue(self.run_one({"type": "skill_loaded"}, TRANSCRIPT_LOADED)[0])
        self.assertFalse(
            self.run_one({"type": "skill_loaded"}, TRANSCRIPT_NOT_LOADED)[0]
        )
        explicit = '[tool call] read_file: {"path": "./skills/keep-the-why/SKILL.md"}\n\n[tool result] ...'
        self.assertTrue(self.run_one({"type": "skill_loaded"}, explicit)[0])
        opencode = '[tool call] skill: {"name": "keep-the-why"}\n\n[tool result] ...'
        self.assertTrue(self.run_one({"type": "skill_loaded"}, opencode)[0])
        other = '[tool call] skill: {"name": "something-else"}\n\n[tool result] ...'
        self.assertFalse(self.run_one({"type": "skill_loaded"}, other)[0])

    def test_unknown_type_fails_loudly(self):
        ok, detail = self.run_one({"type": "nope"})
        self.assertFalse(ok)
        self.assertIn("unknown check type", detail)

    def test_no_checks_no_results(self):
        self.assertEqual(run_checks([], self.workdir, self.home, ""), [])


if __name__ == "__main__":
    unittest.main()
