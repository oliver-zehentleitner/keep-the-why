"""Offline tests for fixture materialization helpers.

python3 -m unittest discover -s tools/evals/tests -v
"""

import datetime
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ktw_evals.common import fake_home_env  # noqa: E402
from ktw_evals.drivers import seed_fake_home  # noqa: E402
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
        self.assertEqual(env["PATH"], env["PIPX_BIN_DIR"])

    def test_operators_local_bin_is_shadowed_without_the_linter(self):
        real = str(Path.home() / ".local" / "bin")
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "home"
            env = fake_home_env(
                {"PATH": f"/usr/local/bin:{real}:/usr/bin:{real}/"}, fake
            )
            parts = env["PATH"].split(":")
            self.assertEqual(parts[0], str(fake / ".local" / "bin"))
            self.assertNotIn(real, parts)
            self.assertNotIn(real + "/", parts)
            shadow = fake / ".local" / "host-bin"
            if Path(real).is_dir():
                self.assertEqual(parts[1:], ["/usr/local/bin", str(shadow), "/usr/bin"])
                for name in ("ktw-lint", "keep-the-why-lint"):
                    self.assertFalse((shadow / name).exists(), name)
                    self.assertFalse((shadow / name).is_symlink(), name)
                real_names = {e.name for e in Path(real).iterdir()} - {
                    "ktw-lint",
                    "keep-the-why-lint",
                }
                self.assertEqual({e.name for e in shadow.iterdir()}, real_names)
            else:
                self.assertEqual(parts[1:], ["/usr/local/bin", "/usr/bin"])

    def test_unwritable_fake_home_still_drops_the_real_bin(self):
        real = str(Path.home() / ".local" / "bin")
        env = fake_home_env({"PATH": f"{real}:/usr/bin"}, Path("/fake"))
        self.assertEqual(env["PATH"], "/fake/.local/bin:/usr/bin")


class TolerantCopy(unittest.TestCase):
    def test_transient_files_are_skipped_and_vanished_sources_tolerated(self):
        import shutil
        from ktw_evals.drivers import _copytree_tolerant

        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "src"
            (src / "sub").mkdir(parents=True)
            (src / "keep.json").write_text("{}")
            (src / ".oauth_refresh.lock").write_text("")
            (src / "sub" / "state.tmp").write_text("")
            _copytree_tolerant(src, Path(tmp) / "dst")
            names = {p.name for p in (Path(tmp) / "dst").rglob("*")}
            self.assertIn("keep.json", names)
            self.assertNotIn(".oauth_refresh.lock", names)
            self.assertNotIn("state.tmp", names)
            # a real error is still raised
            with self.assertRaises(shutil.Error):
                raise shutil.Error([("a", "b", "Permission denied")])


class SeedFakeHome(unittest.TestCase):
    def seed(self, settings_text):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        real, fake = Path(tmp.name) / "real", Path(tmp.name) / "fake"
        (real / ".claude").mkdir(parents=True)
        fake.mkdir()
        if settings_text is not None:
            (real / ".claude" / "settings.json").write_text(settings_text)
        seed_fake_home(real, fake, "claude")
        return real / ".claude" / "settings.json", fake / ".claude" / "settings.json"

    def test_operator_hooks_are_dropped_from_the_copy_only(self):
        original = json.dumps({"model": "sonnet", "hooks": {"SessionStart": []}})
        real, fake = self.seed(original)
        self.assertEqual(json.loads(fake.read_text()), {"model": "sonnet"})
        self.assertEqual(real.read_text(), original)

    def test_settings_without_hooks_are_copied_unchanged(self):
        original = '{"model":"sonnet"}'
        _, fake = self.seed(original)
        self.assertEqual(fake.read_text(), original)

    def test_no_settings_file_is_fine(self):
        _, fake = self.seed(None)
        self.assertFalse(fake.exists())

    def test_unreadable_settings_stop_the_run(self):
        with self.assertRaises(json.JSONDecodeError):
            self.seed("{not json")
