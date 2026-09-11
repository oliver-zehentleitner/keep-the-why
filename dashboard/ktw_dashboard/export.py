"""Static export: one self-contained index.html with the state embedded,
plus state.json next to it. No server, no external requests."""

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


def export(builder, out_dir: str) -> str:
    state = builder.build()
    state["exported"] = True
    os.makedirs(out_dir, exist_ok=True)
    index = os.path.join(out_dir, "index.html")
    with open(index, "w", encoding="utf-8") as fh:
        fh.write(render_page(state))
    with open(os.path.join(out_dir, "state.json"), "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=1)
    return index
