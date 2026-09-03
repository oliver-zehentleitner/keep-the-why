"""End-to-end tests: build a project tree in a temp dir, run the linter, assert codes."""

from __future__ import annotations

import contextlib
import io
import os
import tempfile
import unittest
from unittest import mock

from ktw_lint.checks import Linter
from ktw_lint.cli import _load_config, main

GOOD_CONFIG = """\
This is machine-readable project state for the Keep the Why skill.

<!-- keep-the-why:config -->
- id: acme---widget-service
- context: `context/`
- init: complete
- context-schema: 0.10.1
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
"""

GOOD_ENTRY = """\
# Sync

## Snapshot-before-buffer ordering

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14
**Revisit when:** the sync protocol changes

Body text.

**Reason:** because.

**Rejected alternative:** parallel replay.
"""


class LintProject(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name
        # Inside GitHub Actions the CLI auto-switches to ::error/::warning
        # annotations — fixture findings from these tests would then show up
        # as real annotations on the workflow run. Force plain mode.
        self._env = mock.patch.dict(os.environ, {"GITHUB_ACTIONS": ""})
        self._env.start()

    def tearDown(self):
        self._env.stop()
        self._tmp.cleanup()

    @staticmethod
    def cli(argv):
        """main() with stdout swallowed — the exit code is what these tests assert."""
        with contextlib.redirect_stdout(io.StringIO()):
            return main(argv)

    # -- helpers ---------------------------------------------------------

    def write(self, relpath, content):
        path = os.path.join(self.root, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)

    def base_project(self, config=GOOD_CONFIG, topic=GOOD_ENTRY):
        self.write(".keep-the-why", config)
        self.write("context/sync.md", topic)
        self.write(
            "context/index.md",
            "# Context index\n\n- [sync.md](sync.md) — sync design\n",
        )
        self.write("context/README.md", "# Project context\n")
        self.write("context/AGENTS.md", "Invoke the keep-the-why skill first.\n")
        self.write("context/CLAUDE.md", "@AGENTS.md\n")

    def run_lint(self):
        linter = Linter(self.root)
        return linter.run(_load_config(self.root)), linter

    def codes(self, findings):
        return sorted(f.code for f in findings)

    # -- happy path ------------------------------------------------------

    def test_clean_project(self):
        self.base_project()
        findings, linter = self.run_lint()
        self.assertEqual(
            self.codes(findings), [], msg=[f.format_text() for f in findings]
        )
        self.assertEqual(linter.schema, (0, 10, 1))

    def test_exit_codes(self):
        self.base_project()
        self.assertEqual(self.cli([self.root]), 0)
        self.write(
            "context/sync.md", GOOD_ENTRY.replace("**Evidence:** confirmed\n", "")
        )
        self.assertEqual(self.cli([self.root]), 1)

    def test_strict_turns_warnings_into_failure(self):
        self.base_project(topic=GOOD_ENTRY.replace("**Type:** decision\n", ""))
        self.assertEqual(self.cli([self.root]), 0)
        self.assertEqual(self.cli([self.root, "--strict"]), 1)

    # -- config ----------------------------------------------------------

    def test_missing_config_entirely(self):
        findings, _ = self.run_lint()
        self.assertIn("E001", self.codes(findings))

    def test_legacy_agents_md_block_is_accepted(self):
        self.base_project()
        os.remove(os.path.join(self.root, ".keep-the-why"))
        legacy = GOOD_CONFIG.replace("- id: acme---widget-service\n", "")
        self.write("AGENTS.md", "# AGENTS\n\n" + legacy)
        findings, _ = self.run_lint()
        self.assertEqual(
            self.codes(findings), [], msg=[f.format_text() for f in findings]
        )

    def test_missing_required_field(self):
        self.base_project(config=GOOD_CONFIG.replace("- init: complete\n", ""))
        findings, _ = self.run_lint()
        self.assertIn("E002", self.codes(findings))

    def test_invalid_values(self):
        config = (
            GOOD_CONFIG.replace("confirm-when-unsure", "ask-sometimes")
            .replace("- init: complete", "- init: done")
            .replace("- source-reference: never", "- source-reference: filtered")
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        self.assertEqual(self.codes(findings).count("E003"), 3)

    def test_filtered_with_criteria_is_valid(self):
        config = GOOD_CONFIG.replace(
            "- source-reference: never",
            "- source-reference: filtered — only for entries in context/incidents.md",
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        self.assertEqual(self.codes(findings), [])

    def test_duplicate_and_unknown_fields(self):
        config = GOOD_CONFIG.replace(
            "<!-- /keep-the-why:config -->",
            "- init: declined\n- frobnicate: yes\n<!-- /keep-the-why:config -->",
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        self.assertIn("E004", self.codes(findings))
        self.assertIn("E005", self.codes(findings))

    def test_missing_schema_warns_and_gates_everything_off(self):
        config = GOOD_CONFIG.replace("- context-schema: 0.10.1\n", "")
        entry = GOOD_ENTRY.replace("**Status:** active\n", "").replace(
            "**Evidence:** confirmed\n", ""
        )
        self.base_project(config=config, topic=entry)
        findings, linter = self.run_lint()
        codes = self.codes(findings)
        self.assertIn("W001", codes)
        self.assertEqual(linter.schema, (0, 2, 0))
        self.assertNotIn("E101", codes)  # pre-0.3.0: Status/Evidence not required
        self.assertIn("W104", codes)  # but a Type line on 0.2.0 gets flagged

    def test_schema_newer_than_linter_warns(self):
        self.base_project(config=GOOD_CONFIG.replace("0.10.1", "9.9.9"))
        findings, linter = self.run_lint()
        self.assertIn("W003", self.codes(findings))
        self.assertEqual(linter.schema, (9, 9, 9))  # still linted with every known gate
        self.assertEqual([f.code for f in findings if f.severity == "error"], [])

    def test_pinned_pair(self):
        config = GOOD_CONFIG.replace(
            "<!-- /keep-the-why:config -->",
            "- pinned-version: 0.9.5\n<!-- /keep-the-why:config -->",
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        self.assertIn("E006", self.codes(findings))

    def test_pinned_path_must_exist(self):
        config = GOOD_CONFIG.replace(
            "<!-- /keep-the-why:config -->",
            "- pinned-version: 0.9.5\n- pinned-path: .claude/skills/keep-the-why/SKILL.md\n<!-- /keep-the-why:config -->",
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        self.assertIn("E006", self.codes(findings))
        self.write(
            ".claude/skills/keep-the-why/SKILL.md", "---\nname: keep-the-why\n---\n"
        )
        findings, _ = self.run_lint()
        self.assertNotIn("E006", self.codes(findings))

    def test_context_dir_missing(self):
        self.write(".keep-the-why", GOOD_CONFIG)
        findings, _ = self.run_lint()
        self.assertIn("E007", self.codes(findings))

    def test_personal_defaults_block(self):
        config = GOOD_CONFIG + (
            "\n<!-- keep-the-why:personal-defaults -->\n"
            "- capture-mode: sometimes\n"
            "- confirmation-flow: sequential\n"
            "- update-check: every 14 days — last: 2026-07-21\n"
            "- consistency-check: monthly\n"
            "<!-- /keep-the-why:personal-defaults -->\n"
        )
        self.base_project(config=config)
        findings, _ = self.run_lint()
        codes = self.codes(findings)
        self.assertIn("E003", codes)  # capture-mode: sometimes
        self.assertIn("E008", codes)  # last: timestamp in defaults
        self.assertIn("W002", codes)  # monthly

    # -- entries ---------------------------------------------------------

    def test_missing_status_and_evidence(self):
        entry = GOOD_ENTRY.replace("**Status:** active\n", "").replace(
            "**Evidence:** confirmed\n", ""
        )
        self.base_project(topic=entry)
        findings, _ = self.run_lint()
        codes = self.codes(findings)
        self.assertIn("E101", codes)
        self.assertIn("E102", codes)

    def test_invalid_status_evidence_type_verification(self):
        entry = (
            GOOD_ENTRY.replace("**Status:** active", "**Status:** current")
            .replace("**Evidence:** confirmed", "**Evidence:** sure")
            .replace("**Type:** decision", "**Type:** choice")
            + "\n**Verification:** checked\n"
        )
        self.base_project(topic=entry)
        codes = self.codes(self.run_lint()[0])
        for code in ("E103", "E104", "E105", "E106"):
            self.assertIn(code, codes)

    def test_contradicted_needs_explanation(self):
        entry = GOOD_ENTRY + "\n**Verification:** contradicted\n"
        self.base_project(topic=entry)
        self.assertIn("E111", self.codes(self.run_lint()[0]))
        entry = (
            GOOD_ENTRY
            + "\n**Verification:** contradicted — code caps at 5, interview said 3\n"
        )
        self.base_project(topic=entry)
        self.assertNotIn("E111", self.codes(self.run_lint()[0]))

    def test_undefined_type_needs_reason_and_stays_exclusive(self):
        entry = GOOD_ENTRY.replace("**Type:** decision", "**Type:** undefined")
        self.base_project(topic=entry)
        self.assertIn("E107", self.codes(self.run_lint()[0]))
        entry = GOOD_ENTRY.replace(
            "**Type:** decision", "**Type:** undefined — names a convention"
        )
        self.base_project(topic=entry)
        self.assertNotIn("E107", self.codes(self.run_lint()[0]))
        entry = GOOD_ENTRY.replace(
            "**Type:** decision", "**Type:** undefined — reason\n**Type:** workaround"
        )
        self.base_project(topic=entry)
        self.assertIn("E108", self.codes(self.run_lint()[0]))

    def test_multi_type_gated_by_schema(self):
        entry = GOOD_ENTRY.replace(
            "**Type:** decision", "**Type:** workaround\n**Type:** incident"
        )
        self.base_project(topic=entry)
        self.assertNotIn("E110", self.codes(self.run_lint()[0]))
        self.base_project(config=GOOD_CONFIG.replace("0.10.1", "0.8.0"), topic=entry)
        codes = self.codes(self.run_lint()[0])
        self.assertIn("E110", codes)

    def test_duplicate_type_value(self):
        entry = GOOD_ENTRY.replace(
            "**Type:** decision", "**Type:** incident\n**Type:** incident"
        )
        self.base_project(topic=entry)
        self.assertIn("E109", self.codes(self.run_lint()[0]))

    def test_missing_type_is_only_a_warning(self):
        entry = GOOD_ENTRY.replace("**Type:** decision\n", "")
        self.base_project(topic=entry)
        findings, _ = self.run_lint()
        self.assertIn("W101", self.codes(findings))
        self.assertEqual([f.code for f in findings if f.severity == "error"], [])

    def test_type_after_status_warns(self):
        entry = GOOD_ENTRY.replace(
            "**Type:** decision\n**Status:** active",
            "**Status:** active\n**Type:** decision",
        )
        self.base_project(topic=entry)
        self.assertIn("W103", self.codes(self.run_lint()[0]))

    def test_prose_heading_without_fields_warns_only(self):
        self.base_project(topic=GOOD_ENTRY + "\n## Background\n\nJust prose here.\n")
        findings, _ = self.run_lint()
        self.assertIn("W102", self.codes(findings))
        self.assertEqual([f.code for f in findings if f.severity == "error"], [])

    def test_fenced_examples_are_ignored(self):
        topic = GOOD_ENTRY + (
            "\n```markdown\n## Example entry\n\n**Status:** bogus\n**Evidence:** nope\n```\n"
        )
        self.base_project(topic=topic)
        self.assertEqual(self.codes(self.run_lint()[0]), [])

    # -- index -----------------------------------------------------------

    def test_index_missing(self):
        self.base_project()
        os.remove(os.path.join(self.root, "context/index.md"))
        self.assertIn("E201", self.codes(self.run_lint()[0]))

    def test_index_broken_link_and_unlisted_topic(self):
        self.base_project()
        self.write(
            "context/index.md", "# Context index\n\n- [gone.md](gone.md) — nope\n"
        )
        codes = self.codes(self.run_lint()[0])
        self.assertIn("E202", codes)
        self.assertIn("E203", codes)

    def test_index_sort_is_an_error_since_0_10(self):
        self.base_project()
        self.write("context/auth.md", GOOD_ENTRY.replace("# Sync", "# Auth"))
        self.write(
            "context/index.md",
            "# Context index\n\n- [sync.md](sync.md) — sync\n- [auth.md](auth.md) — auth\n",
        )
        self.assertIn("E204", self.codes(self.run_lint()[0]))

    def test_index_sort_not_enforced_before_0_10(self):
        self.base_project(config=GOOD_CONFIG.replace("0.10.1", "0.9.0"))
        self.write("context/auth.md", GOOD_ENTRY.replace("# Sync", "# Auth"))
        self.write(
            "context/index.md",
            "# Context index\n\n- [sync.md](sync.md) — sync\n- [auth.md](auth.md) — auth\n",
        )
        self.assertNotIn("E204", self.codes(self.run_lint()[0]))

    # -- guard files -----------------------------------------------------

    def test_guard_files_warn_when_missing(self):
        self.base_project()
        os.remove(os.path.join(self.root, "context/CLAUDE.md"))
        self.assertIn("W201", self.codes(self.run_lint()[0]))

    # -- hidden content --------------------------------------------------

    def test_invisible_characters_are_an_error(self):
        self.base_project(topic=GOOD_ENTRY + "\nA sneaky​zero width space.\n")
        self.assertIn("E301", self.codes(self.run_lint()[0]))

    def test_bidi_override_is_an_error(self):
        self.base_project(topic=GOOD_ENTRY + "\nA ‮ reversed ‬ region.\n")
        self.assertIn("E301", self.codes(self.run_lint()[0]))

    def test_base64_blob_warns_but_hex_digest_does_not(self):
        blob = "aGVsbG9Xb3JsZA" * 6 + "=="
        self.base_project(topic=GOOD_ENTRY + f"\nPayload: {blob}\n")
        self.assertIn("W301", self.codes(self.run_lint()[0]))
        digest = "a" * 30 + "0" * 34
        self.base_project(topic=GOOD_ENTRY + f"\nCommit: {digest}\n")
        self.assertNotIn("W301", self.codes(self.run_lint()[0]))


if __name__ == "__main__":
    unittest.main()
