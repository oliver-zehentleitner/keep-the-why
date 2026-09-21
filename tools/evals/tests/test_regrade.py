"""Offline tests for the re-grade summary: stored verdicts in, agreement out."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.regrade import original_judge_verdict, render, summarize  # noqa: E402


def rec(cid, stored, now, source="r1"):
    return {
        "id": cid,
        "source": source,
        "stored_verdict": stored,
        "stored_judge_verdict": stored,
        "checks_passed": None,
        "regrades": [{"verdict": v, "score": None} for v in now],
    }


class RegradeSummary(unittest.TestCase):
    def test_unanimous_and_split_records(self):
        s = summarize(
            [
                rec("a", "pass", ["pass"] * 5),
                rec("b", "fail", ["fail"] * 5),
                rec("c", "fail", ["pass", "pass", "fail", "pass", "pass"]),
            ]
        )
        self.assertEqual((s["unanimous_records"], s["split_records"]), (2, 1))
        self.assertEqual(s["agreement_with_stored_pass"], (5, 5))
        self.assertEqual(s["agreement_with_stored_fail"], (6, 10))
        self.assertEqual(s["stored_failures_overturned_by_majority"], ["r1  c"])
        self.assertIn("c", s["wobbly_cases"])

    def test_errors_are_not_verdicts(self):
        s = summarize([rec("a", "pass", ["pass", "error", "pass"])])
        self.assertEqual((s["regrades"], s["errors"]), (2, 1))
        self.assertEqual(s["unanimous_records"], 1)

    def test_original_judge_verdict(self):
        self.assertEqual(
            original_judge_verdict({"verdict": "fail", "judge_verdict": "pass"}), "pass"
        )
        self.assertIsNone(
            original_judge_verdict({"verdict": "fail", "checks_passed": False})
        )
        self.assertEqual(original_judge_verdict({"verdict": "fail"}), "fail")

    def test_render_lists_wobbly_cases_and_changed_expectations(self):
        out = render(
            summarize([rec("c", "fail", ["pass", "fail"])], changed_since=["c", "zzz"])
        )
        self.assertIn("cases the judge is split on", out)
        self.assertIn("expectation text changed since", out)
        self.assertNotIn("zzz", out)


if __name__ == "__main__":
    unittest.main()
