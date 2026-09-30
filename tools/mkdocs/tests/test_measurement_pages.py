"""Offline tests for the series and round navigation: no build, just the
ordering and the pieces the hook puts on a page.

python3 -m unittest discover -s tools/mkdocs/tests -v   (needs mkdocs importable)
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from measurement_pages import (  # noqa: E402
    COLLECTIONS,
    insert_nav_group,
    neighbours,
    run_order,
    stems,
    under_title,
)

SERIES, ROUNDS = COLLECTIONS


def docs_with(directory, names):
    docs = Path(tempfile.mkdtemp())
    (docs / directory).mkdir()
    for name in names:
        (docs / directory / name).write_text("# x\n")
    return docs


class Ordering(unittest.TestCase):
    def test_versions_sort_as_versions_newest_first(self):
        docs = docs_with("evals", ["0.9.0.md", "0.18.0.md", "0.11.0.md", "0.6.2.md"])
        self.assertEqual(stems(docs, SERIES), ["0.18.0", "0.11.0", "0.9.0", "0.6.2"])

    def test_only_series_pages_count(self):
        docs = docs_with("evals", ["0.18.0.md", "notes.md", "0.18.md"])
        self.assertEqual(stems(docs, SERIES), ["0.18.0"])

    def test_rounds_sort_by_number(self):
        docs = docs_with("agent-matrix", ["round-2.md", "round-10.md", "round-1.md"])
        self.assertEqual(stems(docs, ROUNDS), ["round-10", "round-2", "round-1"])
        self.assertEqual(ROUNDS.label("round-10"), "Round 10")

    def test_neighbours_at_both_ends_and_between(self):
        ordered = ["0.18.0", "0.17.1", "0.17.0"]
        self.assertEqual(neighbours(ordered, "0.18.0"), ("0.17.1", None))
        self.assertEqual(neighbours(ordered, "0.17.1"), ("0.17.0", "0.18.0"))
        self.assertEqual(neighbours(ordered, "0.17.0"), (None, "0.17.1"))

    def test_runs_come_first_then_a_second_series_then_the_rest(self):
        names = [
            "counter-run-cli-2.1.274",
            "evening-run-2",
            "run-10",
            "run-2",
            "evening-run-1",
            "run-1",
        ]
        self.assertEqual(
            sorted(names, key=run_order),
            [
                "run-1",
                "run-2",
                "run-10",
                "evening-run-1",
                "evening-run-2",
                "counter-run-cli-2.1.274",
            ],
        )


class Navigation(unittest.TestCase):
    def test_group_lands_right_after_its_home_page_in_a_nested_section(self):
        nav = [
            {"Overview": "index.md"},
            {"Evals": [{"Full suite": "evals.md"}, {"Matrix": "agent-matrix.md"}]},
        ]
        self.assertTrue(insert_nav_group(nav, SERIES, ["0.18.0", "0.17.1"]))
        self.assertEqual(
            nav[1]["Evals"],
            [
                {"Full suite": "evals.md"},
                {
                    "Series": [
                        {"0.18.0": "evals/0.18.0.md"},
                        {"0.17.1": "evals/0.17.1.md"},
                    ]
                },
                {"Matrix": "agent-matrix.md"},
            ],
        )

    def test_a_home_page_missing_from_the_nav_is_reported(self):
        self.assertFalse(
            insert_nav_group([{"Overview": "index.md"}], SERIES, ["0.18.0"])
        )


class Placement(unittest.TestCase):
    def test_block_goes_under_the_first_heading_only(self):
        page = "# Evals\n\nIntro.\n\n# Not a title, further down\n"
        self.assertEqual(
            under_title(page, "<nav></nav>"),
            "# Evals\n\n<nav></nav>\n\nIntro.\n\n# Not a title, further down\n",
        )

    def test_a_page_without_heading_gets_it_on_top(self):
        self.assertEqual(
            under_title("Intro.\n", "<nav></nav>"), "<nav></nav>\n\nIntro.\n"
        )


if __name__ == "__main__":
    unittest.main()
