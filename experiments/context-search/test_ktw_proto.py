"""Tests for the prototype's cache key and its Type filter.

python -m unittest discover -s experiments/context-search -p 'test_*.py'
"""

from __future__ import annotations

import io
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ktw_proto as P  # noqa: E402

TOPIC = """# Notes

## A decision that was also an incident

**Id:** 11111111-1111-4111-8111-111111111111
**Type:** decision
**Type:** incident
**Status:** active
**Evidence:** explicit

{marker}

## A plain decision

**Id:** 22222222-2222-4222-8222-222222222222
**Type:** decision
**Status:** active
**Evidence:** explicit

Nothing else.
"""


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


class CacheAndType(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "project"
        (self.root / "context").mkdir(parents=True)
        (self.root / ".keep-the-why").write_text(
            "context-schema: 0.20.3\n", encoding="utf-8"
        )
        (self.root / "context" / "index.md").write_text(
            "# Context index\n\n- [Notes](notes.md)\n", encoding="utf-8"
        )
        self.write("first-marker")
        git(self.root, "init", "-q")
        git(self.root, "add", ".")
        git(
            self.root,
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@example.invalid",
            "commit",
            "-qm",
            "init",
        )
        os.environ["KTW_CACHE"] = str(Path(self.tmp.name) / "cache")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, marker: str, name: str = "notes.md") -> None:
        (self.root / "context" / name).write_text(
            TOPIC.format(marker=marker), encoding="utf-8"
        )

    def text(self) -> str:
        c, _ = P.load(self.root)
        return c["entries"]["11111111-1111-4111-8111-111111111111"]["text"]

    def test_second_change_to_a_dirty_file_rebuilds(self):
        # the review's reproduction: mark, build, mark again, load normally
        self.write("dirty-one")
        c, info = P.load(self.root, rebuild=True)
        self.write("dirty-two")
        c, info = P.load(self.root)
        self.assertFalse(info["hit"])
        self.assertIn("dirty-two", self.text())
        self.assertNotIn("dirty-one", self.text())

    def test_untracked_file_rebuilds(self):
        P.load(self.root, rebuild=True)
        self.write("in-a-new-file", name="other.md")
        _, info = P.load(self.root)
        self.assertFalse(info["hit"])

    def test_unchanged_hits(self):
        P.load(self.root, rebuild=True)
        _, info = P.load(self.root)
        self.assertTrue(info["hit"])

    def test_type_filter_matches_a_second_type_line(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            P.main([str(self.root), "find", "--type", "incident", "-n", "100"])
        out = buf.getvalue()
        self.assertIn("11111111-1111-4111-8111-111111111111", out)
        self.assertNotIn("22222222-2222-4222-8222-222222222222", out)
        self.assertIn("decision+incident/active", out)


if __name__ == "__main__":
    unittest.main()
