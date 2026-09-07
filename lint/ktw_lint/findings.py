"""Finding type and severity model shared by all checks."""

from __future__ import annotations

from dataclasses import dataclass

ERROR = "error"
WARNING = "warning"


def _plain(text: str) -> str:
    """Control characters escaped as \\xNN — a finding quotes values from a
    file the linter does not trust, and those values end up in a terminal
    and in GitHub annotations. Escaping here, once, covers every message."""
    return "".join(
        (
            ch
            if (ch >= " " and ch != "\x7f" and not "\x80" <= ch <= "\x9f")
            else f"\\x{ord(ch):02x}"
        )
        for ch in text
    )


@dataclass(frozen=True)
class Finding:
    severity: str  # ERROR or WARNING
    code: str  # e.g. "E103"
    path: str  # path relative to the linted project root
    line: int  # 1-based; 0 means "whole file / not line-specific"
    message: str

    def format_text(self) -> str:
        path = _plain(self.path)
        loc = f"{path}:{self.line}" if self.line else path
        return f"{loc}: [{self.code}] {_plain(self.message)}"

    def format_github(self) -> str:
        kind = "error" if self.severity == ERROR else "warning"
        loc = f"file={_plain(self.path)}" + (f",line={self.line}" if self.line else "")
        return f"::{kind} {loc}::[{self.code}] {_plain(self.message)}"
