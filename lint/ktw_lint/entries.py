"""Parsing of context/ topic files into entries.

An entry is a level-2 heading (`## ...`) plus the schema field lines
directly associated with it (`**Status:** active` etc.). Fenced code
blocks are skipped entirely — topic files (and this project's own docs)
legitimately contain example entries inside ``` fences, and those must
never be linted as real fields.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# The schema's header fields. "Revisit when" contains a space on purpose.
KNOWN_FIELDS = (
    "Id",
    "Type",
    "Status",
    "Evidence",
    "Source",
    "Verification",
    "Revisit when",
    "See",
    "Superseded by",
)

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
_FIELD_RE = re.compile(
    r"^\*\*(Id|Type|Status|Evidence|Source|Verification|Revisit when|See|Superseded by):\*\*"
    r"\s*(.*?)\s*$"
)
_ANCHOR_DROP_RE = re.compile(r"[^\w\- ]", re.UNICODE)
_CODE_SPAN_RE = re.compile(r"(`+)(.+?)\1")
_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_UNDERSCORE_EM_RE = re.compile(r"(?<!\w)(__?)(?=\S)(.+?)(?<=\S)\1(?!\w)")
_TAG_RE = re.compile(r"</?([A-Za-z][A-Za-z0-9]*)(?:\s[^<>]*)?/?>")
# The inline tags a host renders as HTML inside a heading — GitHub's sanitizer
# allows them, and so does GitLab's. Their markup is not in the heading's text,
# so not in its anchor; any other tag is shown as text on GitHub (GitLab drops
# it), and its name stays in the anchor.
INLINE_TAGS = frozenset(
    "a abbr b bdi bdo big br cite code del dfn em font i img ins kbd mark q rp rt "
    "ruby s samp small span strike strong sub sup time tt u var wbr".split()
)


def heading_text(title: str) -> str:
    """The text a host shows for a Markdown heading: a code span as written,
    a link as its text, an image as nothing, emphasis with underscores
    without them, and the markup of an inline HTML tag left out."""

    def plain(part: str) -> str:
        part = _IMAGE_RE.sub("", part)
        part = _LINK_RE.sub(r"\1", part)
        part = _UNDERSCORE_EM_RE.sub(r"\2", part)
        return _TAG_RE.sub(
            lambda m: "" if m.group(1).lower() in INLINE_TAGS else m.group(0), part
        )

    out, pos = [], 0
    for m in _CODE_SPAN_RE.finditer(title):
        out.append(plain(title[pos : m.start()]))
        out.append(m.group(2))
        pos = m.end()
    out.append(plain(title[pos:]))
    return "".join(out)


def anchor(title: str) -> str:
    """The heading anchor a Markdown host derives from an entry title (GitHub's
    rule, which GitLab shares): the heading's text as the host shows it, then
    lowercase, everything but letters, digits, `_`, `-` and spaces dropped,
    each space a hyphen. A local `See` locator uses it as `<file>#<anchor>`,
    the dashboard as an entry's id. A repeated heading's `-1` is not reproduced."""
    return _ANCHOR_DROP_RE.sub("", heading_text(title).strip().lower()).replace(
        " ", "-"
    )


def legacy_anchor(title: str) -> str:
    """The anchor as the linter derived it before 0.20.3.1, from the raw title —
    it differs only for a title with inline HTML, a link or underscore emphasis.
    E119 still accepts it, so a locator written then keeps resolving."""
    return _ANCHOR_DROP_RE.sub("", title.strip().lower()).replace(" ", "-")


_FENCE_RE = re.compile(r"^\s*(```|~~~)")


@dataclass
class FieldLine:
    name: str
    value: str
    line: int


@dataclass
class Entry:
    title: str
    line: int  # line of the ## heading
    fields: list = field(default_factory=list)  # list[FieldLine]

    def get(self, name: str):
        return [f for f in self.fields if f.name == name]


def parse_topic_text(text: str):
    """All level-2 entries of one topic file, in order."""
    entries = []
    current = None
    in_fence = False
    fence_marker = ""
    for lineno, raw in enumerate(text.splitlines(), start=1):
        fence = _FENCE_RE.match(raw)
        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
            continue
        if in_fence:
            continue
        heading = _HEADING_RE.match(raw)
        if heading:
            level = len(heading.group(1))
            if level == 2:
                current = Entry(title=heading.group(2), line=lineno)
                entries.append(current)
            elif level == 1:
                current = None  # a new top-level section ends the entry
            continue
        if current is None:
            continue
        fld = _FIELD_RE.match(raw)
        if fld:
            current.fields.append(
                FieldLine(name=fld.group(1), value=fld.group(2), line=lineno)
            )
    return entries


_INDEX_LINK_RE = re.compile(r"^\s*-\s*\[([^\]]+)\]\(([^)]+)\)")


_INDEX_HEADING_RE = re.compile(r"^##\s+(.*?)\s*$")


def parse_index_headings(text: str):
    """(line, heading_text) for every level-2 heading in index.md, in order."""
    rows = []
    in_fence = False
    for lineno, raw in enumerate(text.splitlines(), start=1):
        if _FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = _INDEX_HEADING_RE.match(raw)
        if match:
            rows.append((lineno, match.group(1)))
    return rows


def parse_index_text(text: str):
    """(line, link_text, link_target) for every list-item link in index.md."""
    rows = []
    in_fence = False
    for lineno, raw in enumerate(text.splitlines(), start=1):
        if _FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = _INDEX_LINK_RE.match(raw)
        if match:
            rows.append((lineno, match.group(1), match.group(2)))
    return rows
