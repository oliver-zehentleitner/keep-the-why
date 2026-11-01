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


def script_tags() -> str:
    """The library's tags for the served page, in load order."""
    data = manifest()
    tags = [
        f'<link rel="stylesheet" href="/static/{n}">' for n in data.get("styles", [])
    ]
    tags += [f'<script src="/static/{n}"></script>' for n in data.get("scripts", [])]
    return "\n".join(tags)


def inline_tags() -> str:
    """The library inlined, for an export: one self-contained page."""
    data = manifest()
    out = []
    for kind, names in (
        ("style", data.get("styles", [])),
        ("script", data.get("scripts", [])),
    ):
        for name in names:
            with open(os.path.join(WEB_DIR, name), encoding="utf-8") as fh:
                text = fh.read()
            if f"</{kind}" in text.lower():
                raise ValueError(
                    f"{name} contains </{kind}, which would end its inlined tag"
                )
            out.append(f"<{kind}>\n{text}\n</{kind}>")
    return "\n".join(out)


def page(index_html: str, inline: bool = False) -> str:
    """`index.html` with the library's tags in place of the placeholder."""
    if PLACEHOLDER not in index_html:
        raise ValueError(f"index.html has no {PLACEHOLDER} placeholder")
    return index_html.replace(
        PLACEHOLDER, inline_tags() if inline else script_tags(), 1
    )
