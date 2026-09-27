"""Static export: one self-contained index.html with the state embedded,
state.json next to it, and badge.svg — a static badge with the project's
numbers, for a README to link to this export. No server, no external
requests, no badge service in between."""

from __future__ import annotations

import base64
import json
import os

from .server import WEB_DIR


def render_page(state: dict) -> str:
    with open(os.path.join(WEB_DIR, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    with open(os.path.join(WEB_DIR, "style.css"), encoding="utf-8") as fh:
        css = fh.read()
    with open(os.path.join(WEB_DIR, "app.js"), encoding="utf-8") as fh:
        js = fh.read()
    data = json.dumps(state, ensure_ascii=False).replace("</", "<\\/")
    for name in ("icon.png", "wordmark.png"):
        with open(os.path.join(WEB_DIR, name), "rb") as fh:
            data_uri = "data:image/png;base64," + base64.b64encode(fh.read()).decode(
                "ascii"
            )
        html = html.replace(f"/static/{name}", data_uri)
    html = html.replace(
        '<link rel="stylesheet" href="/static/style.css">', f"<style>\n{css}\n</style>"
    )
    html = html.replace(
        '<script type="module" src="/static/app.js"></script>',
        f'<script>window.__KTW_STATE__ = {data};</script>\n<script type="module">\n{js}\n</script>',
    )
    return html


_NEEDS_A_PERSON = ("open", "needs-review", "pending-confirmation")


def badge_text(state: dict) -> str:
    """`42 entries · 3 open` — what still needs a person counts as open."""
    entries = state.get("entries", [])
    total = len(entries)
    open_ = sum(1 for e in entries if e.get("status") in _NEEDS_A_PERSON)
    noun = "entry" if total == 1 else "entries"
    return f"{total} {noun} · {open_} open"


def _svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_badge(state: dict, label: str = "keep the why") -> str:
    """A flat two-part badge as static SVG: the label on the left, the
    project's numbers on the right. Widths are estimated from character
    counts (Verdana, 11px), which is what the badge services do too."""
    value = badge_text(state)
    char = 6.5
    pad = 10
    lw = int(len(label) * char + pad)
    vw = int(len(value) * char + pad)
    total = lw + vw
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="20" role="img" aria-label="{_svg_escape(label)}: {_svg_escape(value)}">
  <title>{_svg_escape(label)}: {_svg_escape(value)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="{total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="20" fill="#555"/>
    <rect x="{lw}" width="{vw}" height="20" fill="#2f6f9f"/>
    <rect width="{total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="{lw / 2}" y="14" fill="#010101" fill-opacity=".3">{_svg_escape(label)}</text>
    <text x="{lw / 2}" y="13">{_svg_escape(label)}</text>
    <text x="{lw + vw / 2}" y="14" fill="#010101" fill-opacity=".3">{_svg_escape(value)}</text>
    <text x="{lw + vw / 2}" y="13">{_svg_escape(value)}</text>
  </g>
</svg>
"""


def export(builder, out_dir: str) -> str:
    state = builder.build()
    state["exported"] = True
    os.makedirs(out_dir, exist_ok=True)
    index = os.path.join(out_dir, "index.html")
    with open(index, "w", encoding="utf-8") as fh:
        fh.write(render_page(state))
    with open(os.path.join(out_dir, "state.json"), "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "badge.svg"), "w", encoding="utf-8") as fh:
        fh.write(render_badge(state))
    return index
