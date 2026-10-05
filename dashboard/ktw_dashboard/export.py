"""Static export: one self-contained index.html with the state embedded,
state.json next to it (without the entries' bodies, which go to
state.body.json beside it — see split_bodies), and two badges with the project's numbers — a static SVG each, in the project's
numbers, for a README to link to this export. No server, no external
requests, no badge service in between."""

from __future__ import annotations

import base64
import html as html_lib
import json
import os
import re

from . import gitinfo
from .server import WEB_DIR

TITLE_PREFIX = "Keep the Why Dashboard"


def page_title(state: dict) -> str:
    """`Keep the Why Dashboard · <id>` — the same in app.js, so a search
    result names the project and many exports stay told apart."""
    p = state.get("project", {})
    return f"{TITLE_PREFIX} · {p.get('id') or p.get('name') or 'project'}"


def page_description(state: dict) -> str:
    """One sentence for search results and link previews: whose repository,
    how many entries, what they are. `owner/repo` from `canonical`, else
    from the remote; without either, the project's id."""
    p = state.get("project", {})
    remote = gitinfo.normalize_remote(
        p.get("canonical") or (p.get("git") or {}).get("remote") or ""
    )
    repo = remote.split("/", 1)[1] if "/" in remote else ""
    whose = repo or p.get("id") or p.get("name") or "a project"
    entries = len(state.get("entries", []))
    topics = len(state.get("topics", []))
    e_noun = "entry" if entries == 1 else "entries"
    t_noun = "topic" if topics == 1 else "topics"
    return (
        f"Keep the Why dashboard of {whose}: {entries} recorded {e_noun} — "
        f"decisions, rejected alternatives, workarounds and constraints — "
        f"across {topics} {t_noun}; the reasoning the code cannot explain."
    )


def _head_meta(state: dict) -> str:
    title = html_lib.escape(page_title(state))
    desc = html_lib.escape(page_description(state))
    return (
        f"<title>{title}</title>\n"
        f'<meta name="description" content="{desc}">\n'
        f'<meta property="og:type" content="website">\n'
        f'<meta property="og:title" content="{title}">\n'
        f'<meta property="og:description" content="{desc}">'
    )


def render_page(state: dict) -> str:
    with open(os.path.join(WEB_DIR, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    with open(os.path.join(WEB_DIR, "style.css"), encoding="utf-8") as fh:
        css = fh.read()
    with open(os.path.join(WEB_DIR, "app.js"), encoding="utf-8") as fh:
        js = fh.read()
    with open(os.path.join(WEB_DIR, "lib.js"), encoding="utf-8") as fh:
        lib = fh.read()
    # one self-contained page: the library module is inlined ahead of the app,
    # its `export` keywords dropped and the app's import line removed
    js = (
        re.sub(r"^export ", "", lib, flags=re.M)
        + "\n"
        + re.sub(r"^import \{[^}]*\} from \"\./lib\.js\";\n", "", js, flags=re.M)
    )
    data = json.dumps(state, ensure_ascii=False).replace("</", "<\\/")
    for name in ("icon.png", "wordmark.png"):
        with open(os.path.join(WEB_DIR, name), "rb") as fh:
            data_uri = "data:image/png;base64," + base64.b64encode(fh.read()).decode(
                "ascii"
            )
        html = html.replace(f"/static/{name}", data_uri)
    # title and description in the page itself, not only set by the script:
    # a crawler or a link preview reads the static head
    html = re.sub(r"<title>[^<]*</title>", lambda _: _head_meta(state), html, count=1)
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


# The Keep the Why wordmark, as drawn on the static badge at
# keepthewhy.com/assets/badge.svg (viewBox 1100 × 180): the left part of the
# badge in the project's own style. Kept here verbatim so the export needs
# no file from the site.
_MARK_W, _MARK_H = 1100, 180
_MARK = """<g transform="translate(90 0)"><path d="M 22.524 47.149 L 43.112 47.149 L 43.112 76.293 L 72.786 47.149 L 96.693 47.149 L 58.240 84.970 L 100.647 127.000 L 74.874 127.000 L 43.112 95.546 L 43.112 127.000 L 22.524 127.000 L 22.524 47.149 Z M 164.400 96.898 L 164.400 102.340 L 119.649 102.340 Q 120.333 109.082 124.509 112.454 Q 128.685 115.825 136.163 115.825 Q 142.204 115.825 148.536 114.028 Q 154.885 112.231 161.577 108.603 L 161.577 123.355 Q 154.783 125.922 147.989 127.240 Q 141.195 128.557 134.401 128.557 Q 118.143 128.557 109.124 120.292 Q 100.123 112.026 100.123 97.103 Q 100.123 82.454 108.970 74.068 Q 117.818 65.666 133.340 65.666 Q 147.458 65.666 155.929 74.171 Q 164.400 82.659 164.400 96.898 Z M 144.720 90.531 Q 144.720 85.072 141.537 81.735 Q 138.354 78.381 133.220 78.381 Q 127.658 78.381 124.184 81.513 Q 120.710 84.644 119.854 90.531 L 144.720 90.531 Z M 238.683 96.898 L 238.683 102.340 L 193.931 102.340 Q 194.616 109.082 198.792 112.454 Q 202.967 115.825 210.446 115.825 Q 216.487 115.825 222.819 114.028 Q 229.168 112.231 235.859 108.603 L 235.859 123.355 Q 229.065 125.922 222.271 127.240 Q 215.477 128.557 208.683 128.557 Q 192.425 128.557 183.407 120.292 Q 174.405 112.026 174.405 97.103 Q 174.405 82.454 183.253 74.068 Q 192.100 65.666 207.622 65.666 Q 221.741 65.666 230.212 74.171 Q 238.683 82.659 238.683 96.898 Z M 219.002 90.531 Q 219.002 85.072 215.819 81.735 Q 212.636 78.381 207.502 78.381 Q 201.940 78.381 198.466 81.513 Q 194.992 84.644 194.137 90.531 L 219.002 90.531 Z M 272.321 118.341 L 272.321 149.778 L 253.188 149.778 L 253.188 67.103 L 272.321 67.103 L 272.321 75.865 Q 276.291 70.629 281.100 68.147 Q 285.909 65.666 292.173 65.666 Q 303.245 65.666 310.347 74.462 Q 317.466 83.258 317.466 97.103 Q 317.466 110.948 310.347 119.761 Q 303.245 128.557 292.173 128.557 Q 285.909 128.557 281.100 126.076 Q 276.291 123.577 272.321 118.341 Z M 285.054 79.562 Q 278.910 79.562 275.607 84.080 Q 272.321 88.598 272.321 97.103 Q 272.321 105.608 275.607 110.126 Q 278.910 114.644 285.054 114.644 Q 291.197 114.644 294.432 110.160 Q 297.683 105.660 297.683 97.103 Q 297.683 88.546 294.432 84.063 Q 291.197 79.562 285.054 79.562 Z M 390.615 50.093 L 390.615 67.103 L 410.364 67.103 L 410.364 80.794 L 390.615 80.794 L 390.615 106.190 Q 390.615 110.366 392.275 111.838 Q 393.935 113.309 398.864 113.309 L 408.704 113.309 L 408.704 127.000 L 392.275 127.000 Q 380.946 127.000 376.206 122.277 Q 371.482 117.536 371.482 106.190 L 371.482 80.794 L 361.950 80.794 L 361.950 67.103 L 371.482 67.103 L 371.482 50.093 L 390.615 50.093 Z M 482.280 90.531 L 482.280 127.000 L 463.028 127.000 L 463.028 121.062 L 463.028 99.191 Q 463.028 91.336 462.686 88.392 Q 462.343 85.449 461.488 84.063 Q 460.358 82.180 458.424 81.136 Q 456.508 80.092 454.043 80.092 Q 448.054 80.092 444.631 84.730 Q 441.208 89.351 441.208 97.531 L 441.208 127.000 L 422.076 127.000 L 422.076 43.778 L 441.208 43.778 L 441.208 75.865 Q 445.538 70.629 450.398 68.147 Q 455.276 65.666 461.163 65.666 Q 471.533 65.666 476.907 72.032 Q 482.280 78.381 482.280 90.531 Z M 559.825 96.898 L 559.825 102.340 L 515.074 102.340 Q 515.758 109.082 519.934 112.454 Q 524.110 115.825 531.588 115.825 Q 537.629 115.825 543.961 114.028 Q 550.310 112.231 557.002 108.603 L 557.002 123.355 Q 550.208 125.922 543.414 127.240 Q 536.620 128.557 529.826 128.557 Q 513.568 128.557 504.549 120.292 Q 495.548 112.026 495.548 97.103 Q 495.548 82.454 504.395 74.068 Q 513.243 65.666 528.765 65.666 Q 542.883 65.666 551.354 74.171 Q 559.825 82.659 559.825 96.898 Z M 540.145 90.531 Q 540.145 85.072 536.962 81.735 Q 533.779 78.381 528.645 78.381 Q 523.083 78.381 519.609 81.513 Q 516.135 84.644 515.279 90.531 L 540.145 90.531 Z M 606.523 47.149 L 626.255 47.149 L 640.048 105.180 L 653.739 47.149 L 673.573 47.149 L 687.264 105.180 L 701.074 47.149 L 720.635 47.149 L 701.810 127.000 L 678.074 127.000 L 663.579 66.299 L 649.255 127.000 L 625.502 127.000 L 606.523 47.149 Z M 793.476 90.531 L 793.476 127.000 L 774.223 127.000 L 774.223 121.062 L 774.223 99.191 Q 774.223 91.336 773.881 88.392 Q 773.539 85.449 772.683 84.063 Q 771.554 82.180 769.620 81.136 Q 767.703 80.092 765.239 80.092 Q 759.249 80.092 755.826 84.730 Q 752.404 89.351 752.404 97.531 L 752.404 127.000 L 733.271 127.000 L 733.271 43.778 L 752.404 43.778 L 752.404 75.865 Q 756.733 70.629 761.594 68.147 Q 766.471 65.666 772.358 65.666 Q 782.729 65.666 788.102 72.032 Q 793.476 78.381 793.476 90.531 Z" fill="#FFFFFF" /><line x1="850.48" y1="86.82" x2="821.48" y2="47.00" stroke="#8B4CFF" stroke-width="9" stroke-linecap="round" /><line x1="850.48" y1="86.82" x2="879.48" y2="47.00" stroke="#8B4CFF" stroke-width="9" stroke-linecap="round" /><line x1="850.48" y1="86.82" x2="850.48" y2="133.00" stroke="#8B4CFF" stroke-width="9" stroke-linecap="round" /><circle cx="821.48" cy="47.00" r="12" fill="#031131" stroke="#8B4CFF" stroke-width="7" /><circle cx="879.48" cy="47.00" r="12" fill="#8B4CFF" /><circle cx="850.48" cy="86.82" r="10" fill="#031131" stroke="#8B4CFF" stroke-width="7" /><circle cx="850.48" cy="133.00" r="12" fill="#031131" stroke="#8B4CFF" stroke-width="7" /></g>"""


def render_badge_ktw(state: dict) -> str:
    """The live badge in Keep the Why's own style: the wordmark block of the
    static badge, extended to the right by the project's numbers on the
    same dark ground inside the same purple frame. Height 20 like every
    README badge; the viewBox is the static badge's, so the mark keeps its
    proportions."""
    value = badge_text(state)
    fs = 96  # font size in viewBox units — 20 px tall badge renders it at ~10.7 px
    vw = int(
        len(value) * fs * 0.62 + 2 * 70
    )  # Verdana is wide; the badge services estimate the same way
    total = _MARK_W + vw
    width = round(total * 20 / _MARK_H)
    label = _svg_escape(f"Keep the Why: {value}")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {_MARK_H}" width="{width}" height="20" role="img" aria-label="{label}" preserveAspectRatio="xMidYMid meet">
  <title>{label}</title>
  <rect x="0" y="0" width="{total}" height="{_MARK_H}" rx="28" fill="#8B4CFF" />
  <rect x="6" y="6" width="{total - 12}" height="{_MARK_H - 12}" rx="22" fill="#031131" />
  <rect x="{_MARK_W - 3}" y="34" width="6" height="{_MARK_H - 68}" rx="3" fill="#8B4CFF" opacity="0.55" />
  {_MARK}
  <text x="{_MARK_W + vw / 2}" y="123" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="{fs}" font-weight="600" fill="#F3EEFF">{_svg_escape(value)}</text>
</svg>
"""


def render_badge_flat(state: dict, label: str = "keep the why") -> str:
    """The live badge in the flat style badge services draw: the label on the
    left, the project's numbers on the right. Widths are estimated from
    character counts (Verdana, 11px), which is what the badge services do too."""
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
    <rect x="{lw}" width="{vw}" height="20" fill="#8B4CFF"/>
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


# the files the export writes beside index.html and state.json: name -> renderer
BADGES = {
    "badge-entries.svg": render_badge_ktw,
    "badge-entries-flat.svg": render_badge_flat,
}


BODIES_FILE = "state.body.json"


def split_bodies(state: dict) -> tuple[dict, dict]:
    """The state without its entries' bodies, and the bodies on their own.

    A reader of another project's export — a friend in the graph, a family
    member beside it, a wave of the globe, the registry — needs the project,
    the topics and the entries' header fields; the bodies are three quarters
    of the file and are read only when an entry is opened. So `state.json`
    carries everything but the bodies and names the file beside it that has
    them (`bodies`); the page fetches that file when it shows an entry. The
    export's own page still embeds the full state. A state without the
    `bodies` field — an older export — carries its bodies inline, and a
    dashboard reads either."""
    lean = dict(state)
    lean["entries"] = [
        {k: v for k, v in e.items() if k != "body"} for e in state["entries"]
    ]
    lean["bodies"] = BODIES_FILE
    bodies = {
        "state-json": state.get("state-json"),
        "generated": state.get("generated"),
        "bodies": {e["id"]: e.get("body") for e in state["entries"]},
    }
    return lean, bodies


def export(builder, out_dir: str) -> str:
    state = builder.build()
    state["exported"] = True
    os.makedirs(out_dir, exist_ok=True)
    index = os.path.join(out_dir, "index.html")
    with open(index, "w", encoding="utf-8") as fh:
        fh.write(render_page(state))
    lean, bodies = split_bodies(state)
    with open(os.path.join(out_dir, "state.json"), "w", encoding="utf-8") as fh:
        json.dump(lean, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, BODIES_FILE), "w", encoding="utf-8") as fh:
        json.dump(bodies, fh, ensure_ascii=False, indent=1)
    for name, render in BADGES.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            fh.write(render(state))
    return index
