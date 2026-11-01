"""The page's library files (web/ktw-views.json): the manifest, the classic
script form, and the rendering-safety rules another host relies on.

A host that vendors these files — Maity first — forbids HTML sinks in its
own scripts, because agent-written text reaches the page. The library is
held to the same rules here, so a regression fails in this repository
before it reaches anyone's vendor pull request.
"""

from __future__ import annotations

import os
import re
import unittest

from ktw_dashboard import views
from ktw_dashboard.export import render_page
from ktw_dashboard.state import STATE_JSON_VERSION

# The safety subset: what turns text into markup or code. Matched against the
# raw file, comments included — a comment that names one is reworded, not
# exempted.
FORBIDDEN = [
    (r"\.innerHTML\b", "innerHTML"),
    (r"\.outerHTML\b", "outerHTML"),
    (r"\binsertAdjacentHTML\b", "insertAdjacentHTML"),
    (r"\bdocument\.write(ln)?\b", "document.write"),
    (r"\bcreateContextualFragment\b", "createContextualFragment"),
    (r"\bDOMParser\b", "DOMParser"),
    (r"\beval\s*\(", "eval"),
    (r"\bnew\s+Function\b", "new Function"),
    (
        r"\bset(Timeout|Interval)\s*\(\s*['\"`]",
        "a string passed to setTimeout/setInterval",
    ),
    (r"\bhtml\s*:", "an html: attribute"),
    (r"\bstyle\s*=", "a style= attribute"),
    (r"setAttribute\(\s*['\"]style['\"]", 'setAttribute("style")'),
    (r"\bon[a-z]+\s*=\s*['\"\\]", "an on*= event-handler attribute in a string"),
    (r"setAttribute\(\s*['\"]on[a-z]+['\"]", "setAttribute of an on* event handler"),
    (r"\bsrcdoc\b", "srcdoc"),
    (r"['\"`]\s*javascript:", "a javascript: URL literal"),
]


def _read(name: str) -> str:
    with open(os.path.join(views.WEB_DIR, name), encoding="utf-8") as fh:
        return fh.read()


class ManifestTest(unittest.TestCase):
    def test_lists_existing_ktw_files_and_the_state_major(self):
        data = views.manifest()
        self.assertIn("ktw-core.js", data["scripts"])
        self.assertEqual(data["scripts"][0], "ktw-core.js", "the core loads first")
        self.assertIsInstance(data["api"], int)
        self.assertEqual(data["state"], STATE_JSON_VERSION)

    def test_every_ktw_file_in_web_is_listed(self):
        data = views.manifest()
        listed = set(data["scripts"]) | set(data["styles"])
        on_disk = {
            n for n in os.listdir(views.WEB_DIR) if re.match(r"^ktw-.+\.(js|css)$", n)
        }
        self.assertEqual(on_disk, listed)

    def test_served_page_loads_the_library_before_the_app(self):
        with open(os.path.join(views.WEB_DIR, "index.html"), encoding="utf-8") as fh:
            page = views.page(fh.read())
        self.assertNotIn(views.PLACEHOLDER, page)
        self.assertLess(
            page.index('<script src="/static/ktw-core.js"></script>'),
            page.index('src="/static/app.js"'),
        )

    def test_export_inlines_the_library_in_order_and_ahead_of_the_app(self):
        html = render_page({"project": {}, "entries": [], "topics": [], "authors": []})
        self.assertNotIn(views.PLACEHOLDER, html)
        self.assertNotIn('src="/static/ktw-', html)
        at = -1
        for name in views.manifest()["scripts"]:
            marker = _read(name).splitlines()[0]
            i = html.index(marker)
            self.assertGreater(i, at, f"{name} out of order")
            at = i
        self.assertLess(at, html.index('<script type="module">'))

    def test_a_page_without_the_placeholder_is_refused(self):
        with self.assertRaises(ValueError):
            views.page("<html></html>")


# what makes a request; the views get their data from a provider, the dashboard's
# lives in one block of app.js
REQUESTS = r"\bfetch\s*\(|\bEventSource\b|\bXMLHttpRequest\b|\bsendBeacon\b|\bWebSocket\b|\bimportScripts\b"
PROVIDER_START = "// ---------------------------------------------------------------- provider: every request the page makes"
PROVIDER_END = (
    "// ---------------------------------------------------------------- provider end"
)


class RequestsTest(unittest.TestCase):
    def test_the_library_makes_no_request(self):
        for name in views.manifest()["scripts"]:
            for lineno, line in enumerate(_read(name).splitlines(), 1):
                with self.subTest(name=name, line=lineno):
                    self.assertIsNone(
                        re.search(REQUESTS, line),
                        f"{name}:{lineno}: a request in the library",
                    )

    def test_app_requests_only_inside_its_provider_block(self):
        src = _read("app.js")
        self.assertEqual(src.count(PROVIDER_START), 1)
        self.assertEqual(src.count(PROVIDER_END), 1)
        start, end = src.index(PROVIDER_START), src.index(PROVIDER_END)
        outside = src[:start] + src[end:]
        for lineno, line in enumerate(outside.splitlines(), 1):
            with self.subTest(line=lineno):
                self.assertIsNone(
                    re.search(REQUESTS, line),
                    f"app.js (outside the provider): {line.strip()[:80]}",
                )
        self.assertRegex(
            src[start:end], r"\bfetch\s*\(", "the provider block makes the requests"
        )


class LibraryFilesTest(unittest.TestCase):
    def files(self):
        return views.manifest()["scripts"]

    def test_app_module_keeps_to_the_safety_subset_too(self):
        # app.js is no library file and no host vendors it, but it builds no markup from
        # text either since the DOM renderer; this keeps it that way
        for lineno, line in enumerate(_read("app.js").splitlines(), 1):
            for pattern, what in FORBIDDEN:
                with self.subTest(line=lineno, rule=what):
                    self.assertIsNone(
                        re.search(pattern, line), f"app.js:{lineno}: {what}"
                    )

    def test_classic_scripts_on_one_namespace(self):
        for name in self.files():
            src = _read(name)
            with self.subTest(name=name):
                self.assertIsNone(
                    re.search(r"^\s*(import|export)\b", src, re.M), "a module keyword"
                )
                self.assertIsNotNone(
                    re.search(r'^\(function \(root\) \{\n"use strict";', src, re.M)
                )
                self.assertIn("root.KeepTheWhy = root.KeepTheWhy || {}", src)
                self.assertTrue(src.rstrip().endswith("})(globalThis);"))

    def test_rendering_safety_subset(self):
        for name in self.files():
            for lineno, line in enumerate(_read(name).splitlines(), 1):
                for pattern, what in FORBIDDEN:
                    with self.subTest(name=name, line=lineno, rule=what):
                        self.assertIsNone(
                            re.search(pattern, line),
                            f"{name}:{lineno}: {what} — build nodes, set textContent",
                        )


if __name__ == "__main__":
    unittest.main()
