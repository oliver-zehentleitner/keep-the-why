"""The page's library files, as `web/ktw-views.json` lists them.

The page is `index.html`, `app.js` (a module, the dashboard's host) and the
library files: classic scripts that put what they offer on
`globalThis.KeepTheWhy`, in the order they must load. The manifest is the
one list of them. The server writes their script tags into `index.html`,
the export inlines their text, and a host other than this dashboard reads
the manifest from the published wheel to know what to copy and in which
order. `context/dashboard.md` keeps why the page is split this way.
"""

from __future__ import annotations

import json
import os
import re

WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
MANIFEST = os.path.join(WEB_DIR, "ktw-views.json")
PLACEHOLDER = "<!--ktw:views-->"
# the library's stylesheets go in the head ahead of the host's own, so the host's
# rules come later in the cascade and win a tie (ktw-views.css is the base)
STYLES_PLACEHOLDER = "<!--ktw:styles-->"

# a listed file is a plain name in web/ with the ktw- prefix — the server
# serves /static/ by basename, the package ships web/* only
_NAME = re.compile(r"^ktw-[a-z0-9-]+\.(js|css)$")


def manifest() -> dict:
    """The manifest, checked: every listed file named as above and present."""
    with open(MANIFEST, encoding="utf-8") as fh:
        data = json.load(fh)
    for key in ("scripts", "styles"):
        for name in data.get(key, []):
            if not _NAME.match(name) or not os.path.isfile(os.path.join(WEB_DIR, name)):
                raise ValueError(
                    f"ktw-views.json lists {name!r}, not a ktw-* file in web/"
                )
    return data


def _inline(kind: str, names: list) -> str:
    out = []
    for name in names:
        with open(os.path.join(WEB_DIR, name), encoding="utf-8") as fh:
            text = fh.read()
        if f"</{kind}" in text.lower():
            raise ValueError(
                f"{name} contains </{kind}, which would end its inlined tag"
            )
        out.append(f"<{kind}>\n{text}\n</{kind}>")
    return "\n".join(out)


def style_tags(inline: bool = False) -> str:
    """The library's stylesheets, in load order: linked, or inlined for an export."""
    names = manifest().get("styles", [])
    if inline:
        return _inline("style", names)
    return "\n".join(f'<link rel="stylesheet" href="/static/{n}">' for n in names)


def script_tags(inline: bool = False) -> str:
    """The library's scripts, in load order: linked, or inlined for an export."""
    names = manifest().get("scripts", [])
    if inline:
        return _inline("script", names)
    return "\n".join(f'<script src="/static/{n}"></script>' for n in names)


def page(index_html: str, inline: bool = False) -> str:
    """`index.html` with the library's stylesheets and scripts in place of their
    placeholders; inlined, one self-contained page, for an export."""
    for mark in (STYLES_PLACEHOLDER, PLACEHOLDER):
        if mark not in index_html:
            raise ValueError(f"index.html has no {mark} placeholder")
    html = index_html.replace(STYLES_PLACEHOLDER, style_tags(inline), 1)
    return html.replace(PLACEHOLDER, script_tags(inline), 1)
