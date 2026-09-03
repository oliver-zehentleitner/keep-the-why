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
KNOWN_FIELDS = ("Type", "Status", "Evidence", "Source", "Verification", "Revisit when")

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
_FIELD_RE = re.compile(
    r"^\*\*(Type|Status|Evidence|Source|Verification|Revisit when):\*\*\s*(.*?)\s*$"
)
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
