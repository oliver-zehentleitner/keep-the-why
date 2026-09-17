"""Offline tests for the series verdict: no agent, no judge, just verdicts.

python3 -m unittest discover -s tools/evals/tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.series import judge_series, render  # noqa: E402


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

    def test_render_names_the_flipped_cases(self):
        out = render(judge_series([run(a="fail"), run(a="pass"), run(a="pass")]))
        self.assertIn("2/3  a  (fail, pass, pass)", out)
        self.assertIn("gate (every case passes >= 2 of 3): PASS", out)


if __name__ == "__main__":
    unittest.main()
