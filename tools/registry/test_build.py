"""The registry build's pure part — backlink paths, citations, the backlink files — without the network."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402

A = "https://github.com/acme/app"
B = "https://github.com/acme/lib"
U1 = "11111111-1111-4111-8111-111111111111"
U2 = "22222222-2222-4222-8222-222222222222"
U3 = "33333333-3333-4333-8333-333333333333"


def entry(uuid, title="t", see=(), superseded_by=""):
    return {
        "uuid": uuid,
        "title": title,
        "see": list(see),
        "superseded_by": superseded_by,
    }


def see(remote, uuid, date="2026-10-01"):
    return {"locator": remote, "uuid": uuid, "date": date, "remote": remote}


class BacklinkPath(unittest.TestCase):
    def test_three_plain_segments_lowercase(self):
        self.assertEqual(
            build.backlink_path("https://GitHub.com/Acme/App"),
            "github.com/acme/app.json",
        )
        self.assertEqual(
            build.backlink_path("https://github.com/acme/app.git/"),
            "github.com/acme/app.json",
        )

    def test_anything_else_is_refused(self):
        for url in (
            "http://github.com/acme/app",
            "https://github.com/acme",
            "https://gitlab.com/group/sub/app",
            "https://github.com/../etc",
            "https://github.com/acme/..",
            "https://github.com/acme/a%2Fb",
            "https://github.com/acme/a b",
            "",
            None,
        ):
            self.assertIsNone(build.backlink_path(url), url)


class Citations(unittest.TestCase):
    def test_see_and_superseded_by_into_other_repositories(self):
        state = {
            "entries": [
                entry(
                    U1,
                    "one",
                    see=[see(B, U2), {"locator": "x.md#y", "uuid": U3, "remote": None}],
                ),
                entry(U3, "three", superseded_by=f"{B} — {U2} — as of 2026-09-28"),
                entry(U2, "local", superseded_by=f"x.md#y — {U1} — as of 2026-09-28"),
            ]
        }
        got = build.citations(state, A)
        self.assertEqual(
            [(c["target"], c["entry"], c["kind"], c["to"], c["as_of"]) for c in got],
            [
                (B, U1, "see", U2, "2026-10-01"),
                (B, U3, "superseded_by", U2, "2026-09-28"),
            ],
        )

    def test_own_repository_and_bad_urls_are_not_citations(self):
        state = {
            "entries": [
                entry(U1, see=[see(A + "/", U2), see("https://github.com/../x", U2)])
            ]
        }
        self.assertEqual(build.citations(state, A), [])

    def test_malformed_entries_are_skipped(self):
        state = {
            "entries": [
                "x",
                {"title": "no uuid", "see": [see(B, U2)]},
                entry(U1, see=["x", {"remote": B}]),
            ]
        }
        self.assertEqual(build.citations(state, A), [])


class Backlinks(unittest.TestCase):
    def test_files_counts_resolution_and_order(self):
        c = "https://github.com/acme/cli"
        ext = "https://github.com/other/thing"
        states = {
            B: {"entries": [entry(U2)]},
            c: {"entries": [entry(U3, "c", see=[see(B, U2), see(ext, U1)])]},
            A: {"entries": [entry(U1, "a", see=[see(B, U2), see(B, U3)])]},
        }
        files, counts, warnings = build.backlinks(states, "2026-10-05")
        self.assertEqual(warnings, [])
        self.assertEqual(
            list(files), ["github.com/acme/lib.json", "github.com/other/thing.json"]
        )
        lib = files["github.com/acme/lib.json"]
        self.assertEqual(lib["canonical"], B)
        self.assertEqual(lib["checked"], "2026-10-05")
        self.assertEqual(
            [(x["from"], x["to"]) for x in lib["cited_by"]], [(A, U2), (A, U3), (c, U2)]
        )
        # loaded in the same build: whether the cited Id exists there
        self.assertEqual([x["resolved"] for x in lib["cited_by"]], [True, False, True])
        # not loaded: nothing to check against, so no claim either way
        self.assertNotIn(
            "resolved", files["github.com/other/thing.json"]["cited_by"][0]
        )
        self.assertEqual(counts[B.lower()], {"repositories": 2, "citations": 3})
        self.assertEqual(counts[ext.lower()], {"repositories": 1, "citations": 1})

    def test_same_input_in_another_order_gives_the_same_files(self):
        s1 = {
            A: {"entries": [entry(U1, see=[see(B, U2)])]},
            B: {"entries": [entry(U2, see=[see(A, U1)])]},
        }
        s2 = dict(reversed(list(s1.items())))
        self.assertEqual(build.backlinks(s1, "d")[0], build.backlinks(s2, "d")[0])

    def test_one_export_cannot_flood_the_site(self):
        many = [
            see(f"https://github.com/spam/r{i}", U2)
            for i in range(build.MAX_CITATIONS + 5)
        ]
        files, _, warnings = build.backlinks(
            {A: {"entries": [entry(U1, see=many)]}}, "d"
        )
        self.assertEqual(len(files), build.MAX_CITATIONS)
        self.assertEqual(len(warnings), 1)


class Family(unittest.TestCase):
    def setUp(self):
        self._load = build.load

    def tearDown(self):
        build.load = self._load

    def test_children_are_loaded_once_failures_warn_cycles_end(self):
        child, grandchild, broken = (
            "https://github.com/acme/child",
            "https://github.com/acme/grand",
            "https://github.com/acme/broken",
        )
        tree = {
            child: {
                "project": {
                    "children": [{"location": f"`{grandchild}`"}, {"location": A}]
                },
                "entries": [],
            },
            grandchild: {"project": {"children": [{"location": child}]}, "entries": []},
        }
        calls = []

        def fake_load(url):
            calls.append(url)
            if url not in tree:
                raise ValueError("no dashboard-state line")
            return {"canonical": url}, tree[url]

        build.load = fake_load
        states = {
            A: {
                "project": {
                    "children": [
                        {"location": child},
                        {"location": broken},
                        {"location": "../local"},
                        "x",
                    ]
                },
                "entries": [],
            }
        }
        warnings = build.family(states)
        self.assertEqual(sorted(states), [A, child, grandchild])
        self.assertEqual(sorted(calls), [broken, child, grandchild])
        self.assertEqual(len(warnings), 1)
        self.assertIn(broken, warnings[0])


if __name__ == "__main__":
    unittest.main()
