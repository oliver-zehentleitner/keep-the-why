"""Offline tests for what a run records about its own instrument."""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.analysis import session_shape  # noqa: E402
from ktw_evals.common import cli_version  # noqa: E402
from ktw_evals.judge import (  # noqa: E402
    JUDGE_PROMPT,
    JUDGE_PROMPT_SHA,
    resolved_model,
    session_usage,
)


class Instrument(unittest.TestCase):
    def test_resolved_model_comes_from_the_init_event(self):
        events = [
            {"type": "rate_limit_event"},
            {"type": "system", "subtype": "init", "model": "claude-sonnet-5"},
            {"type": "result", "modelUsage": {"claude-haiku-4-5": {}}},
        ]
        self.assertEqual(resolved_model(events), "claude-sonnet-5")

    def test_no_init_event_is_unknown_not_a_guess(self):
        self.assertIsNone(resolved_model([{"type": "result"}]))
        self.assertIsNone(resolved_model([]))
        self.assertIsNone(resolved_model(None))
        self.assertIsNone(resolved_model(["not a dict"]))

    def test_prompt_sha_names_the_prompt(self):
        self.assertRegex(JUDGE_PROMPT_SHA, r"^[0-9a-f]{12}$")
        import hashlib

        self.assertEqual(
            JUDGE_PROMPT_SHA, hashlib.sha256(JUDGE_PROMPT.encode()).hexdigest()[:12]
        )
        self.assertTrue(re.search(r"\{EXPECTED\}", JUDGE_PROMPT))

    def test_session_shape_counts_turns_and_tool_calls(self):
        t = (
            "[tool call] Bash: {}\n[tool result] x\n[assistant]\nhi\n"
            "[tool call] Read: {}\n[session ended] subtype=success turns=7"
        )
        self.assertEqual(session_shape(t), {"turns": 7, "tool_calls": 2})
        self.assertEqual(session_shape(""), {"turns": None, "tool_calls": 0})
        self.assertEqual(session_shape(None), {"turns": None, "tool_calls": 0})

    def test_session_usage_from_the_result_event(self):
        events = [
            {"type": "system", "subtype": "init", "model": "claude-sonnet-5"},
            {
                "type": "result",
                "usage": {
                    "input_tokens": 6,
                    "cache_read_input_tokens": 95203,
                    "cache_creation_input_tokens": 19224,
                    "output_tokens": 1702,
                    "output_tokens_details": {"thinking_tokens": 1563},
                    "service_tier": "standard",
                },
                "modelUsage": {
                    "claude-sonnet-5": {
                        "thinkingTokens": 1563,
                        "canonicalModel": "claude-sonnet-5",
                    }
                },
                "ttft_ms": 1516,
                "duration_api_ms": 20682,
                "total_cost_usd": 0.113,
            },
        ]
        u = session_usage(events)
        self.assertEqual(u["thinking_tokens"], 1563)
        self.assertEqual(u["output_tokens"], 1702)
        self.assertEqual(u["cache_read_input_tokens"], 95203)
        self.assertEqual(u["ttft_ms"], 1516)
        self.assertEqual(u["service_tier"], "standard")
        self.assertEqual(u["canonical_model"], "claude-sonnet-5")

    def test_session_usage_without_a_result_event_is_all_none(self):
        u = session_usage([{"type": "system", "subtype": "init"}])
        self.assertTrue(all(v is None for v in u.values()))
        self.assertIn("thinking_tokens", u)
        self.assertTrue(all(v is None for v in session_usage(None).values()))

    def test_cli_version_of_a_missing_binary_is_none(self):
        self.assertIsNone(cli_version("no-such-binary-ktw-evals"))


if __name__ == "__main__":
    unittest.main()
