"""The version scheme is load-bearing: first three segments == SUPPORTED_SCHEMA."""

import re
import unittest

import ktw_lint


class VersionScheme(unittest.TestCase):
    def test_four_segments(self):
        self.assertRegex(ktw_lint.__version__, r"^\d+\.\d+\.\d+\.\d+$")

    def test_prefix_matches_supported_schema(self):
        prefix = tuple(int(p) for p in ktw_lint.__version__.split(".")[:3])
        self.assertEqual(prefix, ktw_lint.SUPPORTED_SCHEMA)

    def test_supported_schema_covers_every_gate(self):
        from ktw_lint import checks

        gates = [
            value
            for name, value in vars(checks).items()
            if name.startswith("GATE_") and isinstance(value, tuple)
        ]
        self.assertTrue(gates)
        self.assertTrue(all(gate <= ktw_lint.SUPPORTED_SCHEMA for gate in gates))

    def test_no_hidden_characters_in_own_source(self):
        import os
        from ktw_lint.checks import _SUSPICIOUS_CHARS

        pkg = os.path.dirname(ktw_lint.__file__)
        for name in os.listdir(pkg):
            if not name.endswith(".py"):
                continue
            with open(os.path.join(pkg, name), encoding="utf-8") as fh:
                text = fh.read()
            for char in _SUSPICIOUS_CHARS:
                self.assertNotIn(char, text, msg=f"{name} contains U+{ord(char):04X}")


if __name__ == "__main__":
    unittest.main()
