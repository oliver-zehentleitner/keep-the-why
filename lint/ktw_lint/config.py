"""Parsing of the .keep-the-why project config (and the legacy AGENTS.md block).

The config format is a delimited block of `- key: value` lines:

    <!-- keep-the-why:config -->
    - id: acme---widget-service
    - context: `context/`
    - init: complete
    - context-schema: 0.11.0
    - capture-confirmation: confirm-when-unsure
    - source-reference: never
    <!-- /keep-the-why:config -->

Projects set up before the dedicated .keep-the-why file existed
(skill < 0.10.0) carry the same block inside their entry-point file
(AGENTS.md); the linter reads either location.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

CONFIG_START = "<!-- keep-the-why:config -->"
CONFIG_END = "<!-- /keep-the-why:config -->"
DEFAULTS_START = "<!-- keep-the-why:personal-defaults -->"
DEFAULTS_END = "<!-- /keep-the-why:personal-defaults -->"

_FIELD_RE = re.compile(r"^\s*-\s+([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$")
_SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


@dataclass
class ConfigBlock:
    """One delimited block: every field as key -> list of (line, value)."""

    path: str
    start_line: int = 0
    fields: dict = field(default_factory=dict)  # key -> list[(line, value)]

    def add(self, key: str, line: int, value: str) -> None:
        self.fields.setdefault(key, []).append((line, value))

    def first(self, key: str):
        """(line, value) of the first occurrence, or None."""
        values = self.fields.get(key)
        return values[0] if values else None


@dataclass
class ParsedConfig:
    path: str  # config file, relative to project root
    legacy: bool  # True when read from an AGENTS.md block, not .keep-the-why
    config: ConfigBlock | None
    personal_defaults: ConfigBlock | None


def _extract_block(lines, start_marker, end_marker, path):
    block = None
    for lineno, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if stripped == start_marker:
            block = ConfigBlock(path=path, start_line=lineno)
            continue
        if block is None:
            continue
        if stripped == end_marker:
            return block
        match = _FIELD_RE.match(raw)
        if match:
            block.add(match.group(1), lineno, match.group(2))
    # Start marker without end marker: return what was collected, flagged by
    # start_line being set but the caller seeing no end (checks handle this).
    return block


def parse_config_text(text: str, path: str, legacy: bool) -> ParsedConfig:
    lines = text.splitlines()
    return ParsedConfig(
        path=path,
        legacy=legacy,
        config=_extract_block(lines, CONFIG_START, CONFIG_END, path),
        personal_defaults=_extract_block(lines, DEFAULTS_START, DEFAULTS_END, path),
    )


def parse_semver(value: str):
    """(major, minor, patch) or None."""
    match = _SEMVER_RE.match(value.strip())
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def context_dir_from_value(value: str) -> str:
    """Normalize the `context` field value to a plain relative path.

    The documented examples write it with backticks (`context/`); accept
    both, and strip a trailing slash.
    """
    cleaned = value.strip().strip("`").strip()
    return cleaned.rstrip("/") or "context"
