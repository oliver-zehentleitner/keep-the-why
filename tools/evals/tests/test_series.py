"""Offline tests for the series verdict: no agent, no judge, just verdicts.

python3 -m unittest discover -s tools/evals/tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.checks import is_guard  # noqa: E402
from ktw_evals.series import (  # noqa: E402
    case_history,
    guard_labels,
    judge_series,
    record_series,
    render,
)


def run(**verdicts):
    return {cid: {"verdict": v} for cid, v in verdicts.items()}


class SeriesVerdict(unittest.TestCase):
    def test_clean_series_passes_both(self):
        r = judge_series([run(a="pass", b="pass")] * 3)
        self.assertTrue(r["gate_ok"] and r["run_limit_ok"])
        self.assertEqual(r["all_runs_passed"], 2)
        self.assertEqual(r["flipped"], {})

    def test_one_flip_per_run_on_different_cases_passes(self):
        r = judge_series(
            [
                run(a="fail", b="pass", c="pass"),
                run(a="pass", b="pass", c="pass"),
                run(a="pass", b="pass", c="fail"),
            ]
        )
        self.assertTrue(r["gate_ok"] and r["run_limit_ok"])
        self.assertEqual(r["flips_per_run"], [1, 0, 1])
        self.assertEqual(sorted(r["flipped"]), ["a", "c"])

    def test_same_case_twice_fails_the_gate(self):
        r = judge_series(
            [run(a="fail", b="pass"), run(a="fail", b="pass"), run(a="pass", b="pass")]
        )
        self.assertFalse(r["gate_ok"])
        self.assertEqual(r["below_gate"], ["a"])
        self.assertTrue(r["run_limit_ok"])

    def test_two_flips_in_one_run_fail_the_run_limit_only(self):
        r = judge_series(
            [run(a="fail", b="fail"), run(a="pass", b="pass"), run(a="pass", b="pass")]
        )
        self.assertTrue(r["gate_ok"])
        self.assertFalse(r["run_limit_ok"])

    def test_error_and_missing_count_as_not_passed(self):
        r = judge_series([run(a="error"), run(a="pass"), {}])
        self.assertEqual(r["flipped"]["a"], ["error", "pass", "missing"])
        self.assertFalse(r["gate_ok"])

    # -- completeness: an empty or half-finished run is not a measurement --

    def test_three_empty_runs_are_not_a_passing_series(self):
        r = judge_series([{}, {}, {}])
        self.assertFalse(r["complete_ok"])
        self.assertIn("no cases at all", render(r))

    def test_a_run_missing_a_case_is_incomplete_and_the_case_counts_as_failed(self):
        runs = [run(a="pass", b="pass"), run(a="pass"), run(a="pass", b="pass")]
        r = judge_series(runs, expected_ids=["a", "b"], expected_runs=3)
        self.assertFalse(r["complete_ok"])
        self.assertEqual(r["complete"]["missing"], {2: ["b"]})
        self.assertEqual(r["flipped"], {"b": ["pass", "missing", "pass"]})
        self.assertIn("run 2  missing 1 case(s): b", render(r))

    def test_an_unknown_case_id_is_incomplete(self):
        runs = [run(a="pass", z="pass")] * 3
        r = judge_series(runs, expected_ids=["a"], expected_runs=3)
        self.assertFalse(r["complete_ok"])
        self.assertEqual(r["complete"]["unknown"], {1: ["z"], 2: ["z"], 3: ["z"]})

    def test_the_wrong_number_of_runs_is_incomplete(self):
        r = judge_series([run(a="pass")] * 2, expected_ids=["a"], expected_runs=3)
        self.assertFalse(r["complete_ok"])
        self.assertIn("2 run(s), expected 3", render(r))

    def test_a_complete_series_passes_completeness(self):
        r = judge_series(
            [run(a="pass", b="pass")] * 3, expected_ids=["a", "b"], expected_runs=3
        )
        self.assertTrue(r["complete_ok"])
        self.assertIn("complete (3 runs × 2 cases): PASS", render(r))

    def test_a_partial_series_is_judged_on_what_it_has(self):
        r = judge_series([run(a="pass")] * 3)
        self.assertTrue(r["complete_ok"])
        self.assertEqual(r["cases"], 1)

    def test_render_names_the_flipped_cases(self):
        out = render(judge_series([run(a="fail"), run(a="pass"), run(a="pass")]))
        self.assertIn("2/3  a  (fail, pass, pass)", out)
        self.assertIn("gate (every case passes >= 2 of 3): PASS", out)


CASES = [
    {
        "id": "a",
        "checks": [
            {"type": "no_changes_under", "path": "context/"},
            {"type": "changes_under", "path": "docs/"},
        ],
    },
    {"id": "b", "checks": [{"type": "text_absent", "text": "x", "guard": False}]},
]


class Guards(unittest.TestCase):
    def test_prohibitions_are_guards_unless_opted_out(self):
        self.assertTrue(is_guard({"type": "no_changes_under", "path": "context/"}))
        self.assertTrue(is_guard({"type": "text_absent", "text": "sk_live"}))
        self.assertFalse(is_guard({"type": "text_absent", "text": "x", "guard": False}))
        self.assertFalse(is_guard({"type": "changes_under", "path": "context/"}))
        self.assertTrue(is_guard({"type": "text_present", "text": "x", "guard": True}))

    def test_labels_match_what_a_run_stores(self):
        self.assertEqual(
            guard_labels(CASES), {"a": {"no_changes_under path='context/'"}, "b": set()}
        )

    def test_one_guard_violation_fails_the_series_even_at_two_of_three(self):
        bad = {
            "a": {
                "verdict": "fail",
                "failed_checks": ["no_changes_under path='context/'"],
            },
            "b": {"verdict": "pass", "failed_checks": []},
        }
        good = {"a": {"verdict": "pass"}, "b": {"verdict": "pass"}}
        r = judge_series([good, bad, good], guards=guard_labels(CASES))
        self.assertTrue(r["gate_ok"] and r["run_limit_ok"])
        self.assertFalse(r["guards_ok"])
        self.assertEqual(
            r["guard_violations"], [(2, "a", "no_changes_under path='context/'")]
        )
        self.assertIn("guards (no guard check violated in any run): FAIL", render(r))

    def test_a_failed_non_guard_check_is_ordinary_variance(self):
        bad = {
            "a": {"verdict": "fail", "failed_checks": ["changes_under path='docs/'"]},
            "b": {"verdict": "fail", "failed_checks": ["text_absent text='x'"]},
        }
        good = {"a": {"verdict": "pass"}, "b": {"verdict": "pass"}}
        r = judge_series(
            [good, good, bad], guards=guard_labels(CASES), max_flips_per_run=2
        )
        self.assertTrue(r["guards_ok"] and r["gate_ok"] and r["run_limit_ok"])


class History(unittest.TestCase):
    def test_record_and_read_back(self):
        h = {"series": []}
        good, bad = run(a="pass", b="pass"), run(a="fail", b="pass")
        record_series(h, "1.0.0", "2026-01-01", [good, bad, good])
        record_series(h, "1.1.0", "2026-02-01", [good, good, good])
        self.assertEqual(h["series"][0]["cases"], {"a": 2, "b": 3})
        self.assertEqual(h["series"][0]["passed_per_run"], [2, 1, 2])
        self.assertEqual(case_history(h, "a"), (5, 6, 2))
        self.assertEqual(case_history(h, "a", exclude_version="1.1.0"), (2, 3, 1))
        self.assertEqual(case_history(h, "new-case"), (0, 0, 0))

    def test_recording_a_version_again_replaces_it(self):
        h = {"series": []}
        record_series(h, "1.0.0", "2026-01-01", [run(a="fail")] * 3)
        record_series(h, "1.0.0", "2026-01-02", [run(a="pass")] * 3)
        self.assertEqual(len(h["series"]), 1)
        self.assertEqual(h["series"][0]["cases"], {"a": 3})

    def test_flipped_case_shows_its_record_without_the_series_being_judged(self):
        h = {"series": []}
        good, bad = run(a="pass"), run(a="fail")
        record_series(h, "1.0.0", "2026-01-01", [good, good, good])
        record_series(h, "1.1.0", "2026-02-01", [good, bad, good])
        out = render(judge_series([good, bad, good], history=h, version="1.1.0"))
        self.assertIn("before: 3/3 over 1 series", out)
        out = render(judge_series([good, bad, good]))
        self.assertIn("before: no recorded series", out)


if __name__ == "__main__":
    unittest.main()
