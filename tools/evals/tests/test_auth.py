"""A logged-out agent CLI stops a run instead of being retried for hours.

python3 -m unittest discover -s tools/evals/tests -v
"""

import sys
import unittest
from argparse import Namespace
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.drivers.claude import error_from_run  # noqa: E402
from ktw_evals.results import AUTH_FAILURE_RE  # noqa: E402

# what Claude Code 2.1.282 emits with no valid credentials (probed 2026-09-28)
LOGGED_OUT_EVENTS = [
    {"type": "system", "subtype": "hook_started", "hook_name": "SessionStart:startup"},
    {"type": "system", "subtype": "init"},
    {
        "type": "assistant",
        "error": "authentication_failed",
        "message": {
            "content": [{"type": "text", "text": "Not logged in · Please run /login"}]
        },
    },
    {
        "type": "result",
        "subtype": "success",
        "is_error": True,
        "result": "Not logged in · Please run /login",
    },
]


class ErrorFromRun(unittest.TestCase):
    def test_logged_out_is_an_auth_failure_with_the_real_message(self):
        error, auth = error_from_run(1, LOGGED_OUT_EVENTS, '{"type":"system"}', "")
        self.assertTrue(auth)
        self.assertIn("Not logged in", error)
        self.assertNotIn("hook_started", error)  # not the head of stdout any more

    def test_structured_signal_alone_is_enough(self):
        events = [
            dict(LOGGED_OUT_EVENTS[2], message={"content": []}),
            {"type": "result", "is_error": True, "result": "failed"},
        ]
        _, auth = error_from_run(1, events, "", "")
        self.assertTrue(auth)

    def test_other_failures_are_errors_not_auth_failures(self):
        events = [
            {"type": "result", "is_error": True, "result": "Tool execution timed out"}
        ]
        error, auth = error_from_run(1, events, "", "")
        self.assertFalse(auth)
        self.assertIn("timed out", error)

    def test_no_result_event_falls_back_to_stderr_then_stdout_tail(self):
        error, auth = error_from_run(2, [], "x" * 3000 + "THE END", "")
        self.assertIn("THE END", error)
        self.assertFalse(auth)
        error, _ = error_from_run(2, [], "stdout", "segfault in node")
        self.assertIn("segfault", error)

    def test_success_is_no_error(self):
        self.assertEqual(
            error_from_run(
                0, [{"type": "result", "is_error": False, "result": "ok"}], "", ""
            ),
            (None, False),
        )

    def test_text_forms_of_other_clis(self):
        for text in (
            "Invalid API key",
            "OAuth token has expired",
            "HTTP 401 Unauthorized",
            "please run /login",
        ):
            with self.subTest(text=text):
                self.assertTrue(AUTH_FAILURE_RE.search(text))
        for text in (
            "You've hit your usage limit",
            "401 lines changed",
            "login.py updated",
        ):
            with self.subTest(text=text):
                self.assertFalse(AUTH_FAILURE_RE.search(text))


class LoopStopsOnAuthFailure(unittest.TestCase):
    def test_run_until_resolved_returns_5_without_sleeping(self):
        from ktw_evals import runner

        records = [
            {"id": "a", "verdict": "pass"},
            {"id": "b", "verdict": "auth_failed"},
        ]
        summary = {"passed": 1, "total": 2, "failed": 0, "errors": 1}
        args = Namespace(
            max_wait_hours=10,
            retry_until_complete=True,
            retry_interval=3000,
            error_retry_interval=30,
        )
        with mock.patch.object(runner, "refuse_tempdir_inside_home"), mock.patch.object(
            runner, "execute_pass", return_value=(records, summary, False)
        ), mock.patch.object(runner.time, "sleep") as sleep:
            code = runner.run_until_resolved(
                [{"id": "a"}, {"id": "b"}], args, Path("/nonexistent")
            )
        self.assertEqual(code, 5)
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
