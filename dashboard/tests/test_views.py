"""The page's library files (web/ktw-views.json): the manifest, the classic
script form, and the rendering-safety rules another host relies on.

A host that vendors these files — Maity first — forbids HTML sinks in its
own scripts, because agent-written text reaches the page. The library is
held to the same rules here, so a regression fails in this repository
before it reaches anyone's vendor pull request.
"""

from __future__ import annotations

import json
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
# lives in one block of app.js. A textual net for regressions, not a proof: a call
# spelled indirectly (a computed name, a dynamic import, an image's src) passes it.
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
        # the whole file, the block's lines skipped, so a finding names the real line of app.js
        lines = _read("app.js").splitlines()
        starts = [n for n, line in enumerate(lines) if line.startswith(PROVIDER_START)]
        ends = [n for n, line in enumerate(lines) if line.startswith(PROVIDER_END)]
        self.assertEqual((len(starts), len(ends)), (1, 1))
        start, end = starts[0], ends[0]
        for n, line in enumerate(lines):
            if start <= n <= end:
                continue
            with self.subTest(line=n + 1):
                self.assertIsNone(
                    re.search(REQUESTS, line),
                    f"app.js:{n + 1} (outside the provider): {line.strip()[:80]}",
                )
        self.assertTrue(
            any(re.search(r"\bfetch\s*\(", line) for line in lines[start:end]),
            "the provider block makes the requests",
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

    def test_routing_goes_through_nav(self):
        # the page's place lives behind nav: the library files never touch the address, and
        # app.js reads or writes the hash and the history only in its nav (host) block
        # the page's own address, not a parameter that happens to be called location
        address = r"\bwindow\.location\b|\blocation\.(hash|href|search|pathname|origin|reload|assign)\b|\bhistory\.(pushState|replaceState|back|forward|go)\b"
        routing = re.compile(
            r"\blocation\.hash\b|\bhistory\.|[\"']hashchange[\"']|[\"']popstate[\"']"
        )
        for name in self.files():
            with self.subTest(name=name):
                self.assertIsNone(re.search(address, _read(name)))
        lines = _read("app.js").splitlines()
        start = next(i for i, l in enumerate(lines) if l.endswith(" nav (host)"))
        end = next(i for i, l in enumerate(lines) if l.endswith(" end of nav (host)"))
        for lineno, line in enumerate(lines, 1):
            if start < lineno <= end:
                continue
            with self.subTest(line=lineno):
                self.assertIsNone(
                    routing.search(line), f"app.js:{lineno}: routing outside nav"
                )

    def test_settings_go_through_prefs(self):
        # what a reader sets is kept behind prefs: the library files keep nothing in the
        # browser, and app.js reaches localStorage only in its prefs (host) block
        storage = re.compile(r"\b(localStorage|sessionStorage|indexedDB)\b")
        for name in self.files():
            with self.subTest(name=name):
                self.assertIsNone(storage.search(_read(name)))
        lines = _read("app.js").splitlines()
        start = next(i for i, l in enumerate(lines) if l.endswith(" prefs (host)"))
        end = next(i for i, l in enumerate(lines) if l.endswith(" end of prefs (host)"))
        for lineno, line in enumerate(lines, 1):
            if start < lineno <= end:
                continue
            with self.subTest(line=lineno):
                self.assertNotIn(
                    "localStorage", line, f"app.js:{lineno}: a setting outside prefs"
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

    def test_one_generic_attribute_setter(self):
        # every element the views build gets its attributes through ui.setAttrs, which sends a style through the
        # CSSOM (a strict Content-Security-Policy drops a style attribute); any setAttribute whose name is not a
        # quoted string — a loop's key, a variable, a template — could be handed "style", and only the one in
        # setAttrs, which routes "style" away first, is allowed
        found = [
            (name, lineno)
            for name in self.files()
            for lineno, line in enumerate(_read(name).splitlines(), 1)
            if re.search(r"""\.setAttribute\(\s*(?!["'])""", line)
        ]
        self.assertEqual(
            [n for n, _ in found], ["ktw-ui.js"], f"generic attribute setters: {found}"
        )

    def test_one_address_rule(self):
        # an address reaches the DOM through ui.setAttrs, which sets href, xlink:href, src, action and formaction only
        # as core.safeHref passes them; the one other setter is the Markdown builder, behind the same safeHref. No
        # library file assigns an address property or opens a window on its own: navigating is the host's nav
        URL_ATTR = r"""setAttribute\(\s*["'](?:href|xlink:href|src|srcset|action|formaction)["']"""
        found = [
            (name, lineno)
            for name in self.files()
            for lineno, line in enumerate(_read(name).splitlines(), 1)
            if re.search(URL_ATTR, line)
            or re.search(r"\.(?:href|src|srcset|action|formAction)\s*=(?!=)", line)
            or re.search(r"\bwindow\.open\(", line)
        ]
        self.assertEqual([n for n, _ in found], ["ktw-markdown.js"], f"address setters: {found}")
        src = _read("ktw-markdown.js")
        self.assertIn('n.href && safeHref(n.href) != null) {', src)

    def test_rendering_safety_subset(self):
        for name in self.files():
            for lineno, line in enumerate(_read(name).splitlines(), 1):
                for pattern, what in FORBIDDEN:
                    with self.subTest(name=name, line=lineno, rule=what):
                        self.assertIsNone(
                            re.search(pattern, line),
                            f"{name}:{lineno}: {what} — build nodes, set textContent",
                        )


# the dashboard's variable each of the views' tokens stands for (docs/dashboard-views.md)
TOKEN_OF = {
    "bg": "bg",
    "bg2": "surface",
    "bg3": "surface2",
    "line": "line",
    "fg": "fg",
    "fg2": "fg2",
    "fg3": "fg3",
    "accent": "accent",
    "accent2": "accent2",
    "ok": "ok",
    "warn": "warn",
    "bad": "bad",
    "info": "info",
    "muted": "muted",
    "confirmed": "confirmed",
    "inferred": "inferred",
    "unknown": "unknown",
    "active": "status-active",
    "superseded": "status-superseded",
    "open": "status-open",
    "needs-review": "status-needs-review",
    "pending-confirmation": "status-pending-confirmation",
    "radius": "radius",
    "font": "font",
    "mono": "mono",
}


def _block(css: str, selector: str) -> dict:
    m = re.search(r"(?m)^" + re.escape(selector) + r"\s*\{(.*?)\}", css, re.S)
    body = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
    return {k: v.strip() for k, v in re.findall(r"--([\w-]+)\s*:\s*([^;]+);", body)}


def _token_defaults() -> dict:
    src = _read("ktw-core.js")
    body = re.search(
        r"const TOKEN_DEFAULTS = Object\.freeze\(\{(.*?)\}\);", src, re.S
    ).group(1)
    return {
        k: json.loads(v)
        for k, v in re.findall(r'"(--ktw-[\w-]+)":\s*("(?:[^"\\]|\\.)*")', body)
    }


class StylesTest(unittest.TestCase):
    """ktw-views.css and the tokens: the views style .ktw-* only and read --ktw-*
    only, with fallbacks; the dashboard sets every token to its own colour."""

    def setUp(self):
        self.style = _read("style.css")
        self.views_css = _read("ktw-views.css")
        self.dark = _block(self.style, ":root")
        self.light = _block(self.style, ':root[data-theme="light"]')

    def test_tokens_equal_the_dashboards_variables_in_both_themes(self):
        for theme, vals in (("dark", self.dark), ("light", self.light)):
            for var, token in TOKEN_OF.items():
                if var not in vals:
                    continue
                with self.subTest(theme=theme, token=token):
                    self.assertEqual(vals.get(f"ktw-{token}"), vals[var])
        for token in TOKEN_OF.values():
            self.assertIn(f"ktw-{token}", self.dark)

    def test_palette_starts_at_the_accent(self):
        self.assertEqual(self.dark["ktw-palette-0"], self.dark["accent"])

    def test_core_defaults_are_the_dashboards_dark_values(self):
        defaults = _token_defaults()
        dark = {f"--{k}": v for k, v in self.dark.items() if k.startswith("ktw-")}
        self.assertEqual(defaults, dark)

    def test_views_css_reads_tokens_only_each_with_its_default(self):
        defaults = _token_defaults()
        uses = re.findall(
            r"var\(\s*(--[\w-]+)\s*(,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)",
            self.views_css,
        )
        self.assertTrue(uses)
        for name, _, fallback in uses:
            with self.subTest(token=name):
                self.assertTrue(name.startswith("--ktw-"), f"{name} is not a token")
                self.assertTrue(fallback, f"{name} has no fallback")
                self.assertIn(name, defaults)
                # the same value TOKEN_DEFAULTS gives a canvas and an inline style: a host without the token
                # sees one colour wherever the views read it
                self.assertEqual(
                    " ".join(fallback.split()), " ".join(defaults[name].split())
                )

    def test_views_css_styles_ktw_classes_only(self):
        css = re.sub(r"/\*.*?\*/", "", self.views_css, flags=re.S)
        for head in re.findall(r"([^{}]+)\{", css):
            head = head.strip()
            if head.startswith("@") or head.startswith("from") or head.startswith("to"):
                continue
            for sel in re.split(r",(?![^()]*\))", head):
                sel = sel.strip()
                with self.subTest(selector=sel):
                    self.assertNotRegex(sel, r"#[\w-]", "an id is the host's")
                    for c in re.findall(r"\.(-?[_a-zA-Z][\w-]*)", sel):
                        self.assertTrue(c.startswith("ktw-"), f".{c} is not the views'")
                    self.assertTrue(
                        ".ktw-" in sel.split(":where(.ktw-root")[0]
                        or sel.startswith(":where(.ktw-root"),
                        "a bare element is styled under :where(.ktw-root) only",
                    )

    def test_library_reads_known_tokens_only(self):
        defaults = _token_defaults()
        for name in (
            n for n in os.listdir(views.WEB_DIR) if re.match(r"^ktw-.+\.js$", n)
        ):
            src = _read(name)
            # a name built in a template counts too: `--${status}` would read the host's variable
            for built in re.findall(r"`(--[\w-]*)\$\{", src):
                with self.subTest(file=name, token=built):
                    self.assertTrue(
                        built.startswith("--ktw-"),
                        f"{name} builds {built}…, the host's variable",
                    )
            for used in re.findall(r'(?:var\(|\(")(--[\w-]+)', src):
                with self.subTest(file=name, token=used):
                    self.assertTrue(
                        used.startswith("--ktw-"),
                        f"{name} reads {used}, the host's variable",
                    )
                    self.assertIn(used, defaults)

    def test_stylesheets_load_base_then_views_then_the_dashboards(self):
        with open(os.path.join(views.WEB_DIR, "index.html"), encoding="utf-8") as fh:
            page = views.page(fh.read())
        order = [
            page.index(f'href="/static/{n}"')
            for n in ("base.css", "ktw-views.css", "style.css")
        ]
        self.assertEqual(order, sorted(order))
        html = render_page({"project": {}, "entries": [], "topics": [], "authors": []})
        marks = [
            _read("base.css").splitlines()[0],
            self.views_css.splitlines()[0],
            self.style.splitlines()[0],
        ]
        at = [html.index(m) for m in marks]
        self.assertEqual(at, sorted(at))


if __name__ == "__main__":
    unittest.main()
