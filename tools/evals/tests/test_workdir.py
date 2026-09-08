"""Offline tests for fixture materialization helpers.

python3 -m unittest discover -s tools/evals/tests -v
"""

import datetime
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.common import fake_home_env  # noqa: E402
from ktw_evals.workdir import commit_date  # noqa: E402


class CommitDate(unittest.TestCase):
    def test_fixed_date_is_passed_through(self):
        self.assertEqual(
            commit_date({"message": "x", "date": "2026-07-29T15:00:00"}),
            "2026-07-29T15:00:00",
        )

    def test_days_ago_moves_with_the_calendar(self):
        got = commit_date({"message": "x", "days_ago": 14})
        expected = datetime.datetime.now() - datetime.timedelta(days=14)
        self.assertEqual(got, expected.strftime("%Y-%m-%dT10:00:00"))

    def test_no_date_means_no_override(self):
        self.assertIsNone(commit_date({"message": "x"}))

    def test_both_is_an_error(self):
        with self.assertRaises(ValueError):
            commit_date({"message": "x", "date": "2026-07-29T15:00:00", "days_ago": 1})


if __name__ == "__main__":
    unittest.main()


class FakeHomeEnv(unittest.TestCase):
    def test_every_install_location_points_into_the_fake_home(self):
        env = fake_home_env({"PATH": "/usr/bin", "HOME": "/real/home"}, Path("/fake"))
        self.assertEqual(env["HOME"], "/fake")
        for key in (
            "PIPX_HOME",
            "PIPX_BIN_DIR",
            "UV_TOOL_DIR",
            "UV_TOOL_BIN_DIR",
            "PYTHONUSERBASE",
        ):
            self.assertTrue(env[key].startswith("/fake/"), key)
        self.assertTrue(env["PATH"].startswith("/fake/.local/bin:"))
        self.assertIn("/usr/bin", env["PATH"])

    def test_bin_dirs_agree_with_path(self):
        env = fake_home_env({}, Path("/fake"))
        self.assertEqual(env["PIPX_BIN_DIR"], env["UV_TOOL_BIN_DIR"])
        self.assertEqual(env["PATH"], env["PIPX_BIN_DIR"] + ":")
