"""All structural checks, gated by the target project's context-schema.

The gate versions mirror the skill's references/migrations.md: a project
whose context/ was last migrated against an older skill version must not
fail on structure that version didn't define yet ("next time touched" is
the skill's own retrofit rule — a linter that ignores it would force the
big-bang backfill the methodology explicitly rejects).

    0.3.0   Status/Evidence split (both mandatory per entry), Verification
    0.7.0   Type field (optional, single value)
    0.8.0   `undefined — <reason>` Type value, exclusive
    0.9.0   multiple Type lines allowed
    0.10.0  dedicated .keep-the-why (id field), sorted index, guard files
"""

from __future__ import annotations

import os
import re
import unicodedata

from . import SUPPORTED_SCHEMA
from .config import (
    ParsedConfig,
    context_dir_from_value,
    parse_semver,
)
from .entries import parse_index_text, parse_topic_text
from .findings import ERROR, WARNING, Finding

GATE_STATUS_EVIDENCE = (0, 3, 0)
GATE_TYPE = (0, 7, 0)
GATE_UNDEFINED = (0, 8, 0)
GATE_MULTI_TYPE = (0, 9, 0)
GATE_DEDICATED_CONFIG = (0, 10, 0)

FALLBACK_SCHEMA = (0, 2, 0)  # the skill's own backfill default for a missing field

STATUS_VALUES = ("active", "superseded", "open", "needs-review")
EVIDENCE_VALUES = ("confirmed", "inferred", "unknown")
TYPE_VALUES = ("decision", "workaround", "incident", "constraint")
VERIFICATION_VALUES = ("corroborated", "uncorroborated", "contradicted")

CONFIG_REQUIRED = (
    "context",
    "init",
    "context-schema",
    "capture-confirmation",
    "source-reference",
)
CONFIG_KNOWN = CONFIG_REQUIRED + ("id", "pinned-version", "pinned-path")
INIT_VALUES = ("complete",)
CAPTURE_CONFIRMATION_VALUES = ("automatic", "confirm-always", "confirm-when-unsure")

DEFAULTS_KNOWN = (
    "capture-mode",
    "confirmation-flow",
    "update-check",
    "consistency-check",
)
CAPTURE_MODE_VALUES = ("proactive", "explicit-only")
CONFIRMATION_FLOW_VALUES = ("sequential", "batch")
_INTERVAL_RE = re.compile(r"^(every\s+\d+\s+days?|no)$")

NON_TOPIC_FILES = ("README.md", "AGENTS.md", "CLAUDE.md", "index.md")

# Values may carry an em/en dash or hyphen separated remainder ("undefined — reason").
_DASH_SPLIT_RE = re.compile(r"\s+[—–-]\s+")

# Verification in the wild separates value and explanation with a dash,
# colon, or plain sentence punctuation — accept any, the value word is
# what's constrained. "uncorroborated" must come first (it contains
# "corroborated").
_VERIFICATION_RE = re.compile(
    r"^(uncorroborated|corroborated|contradicted)\b[.:,]?\s*[—–-]?\s*(.*)$", re.DOTALL
)

# Invisible / direction-control characters that have no business in a
# plain-text knowledge file (see the skill's trust model: hidden content
# is a red flag, not documentation). Written as codepoints so this source
# file passes its own check.
_SUSPICIOUS_CODEPOINTS = (
    0x200B,  # ZERO WIDTH SPACE
    0x200C,  # ZERO WIDTH NON-JOINER
    0x200D,  # ZERO WIDTH JOINER
    0x2060,  # WORD JOINER
    0xFEFF,  # ZERO WIDTH NO-BREAK SPACE (BOM when leading)
    0x202A,  # LEFT-TO-RIGHT EMBEDDING
    0x202B,  # RIGHT-TO-LEFT EMBEDDING
    0x202C,  # POP DIRECTIONAL FORMATTING
    0x202D,  # LEFT-TO-RIGHT OVERRIDE
    0x202E,  # RIGHT-TO-LEFT OVERRIDE
    0x2066,  # LEFT-TO-RIGHT ISOLATE
    0x2067,  # RIGHT-TO-LEFT ISOLATE
    0x2068,  # FIRST STRONG ISOLATE
    0x2069,  # POP DIRECTIONAL ISOLATE
)
_SUSPICIOUS_CHARS = {
    chr(cp): unicodedata.name(chr(cp), f"U+{cp:04X}") for cp in _SUSPICIOUS_CODEPOINTS
}

_BASE64_RE = re.compile(r"[A-Za-z0-9+/]{60,}={0,2}")


def _split_value(value: str):
    """(head, remainder) — remainder is what follows an explicit dash separator."""
    parts = _DASH_SPLIT_RE.split(value, maxsplit=1)
    head = parts[0].strip()
    rest = parts[1].strip() if len(parts) > 1 else ""
    return head, rest


class Linter:
    def __init__(self, root: str):
        self.root = root
        self.findings: list = []
        self.schema = FALLBACK_SCHEMA
        self.context_dir = "context"

    # -- helpers ---------------------------------------------------------

    def add(self, severity, code, path, line, message):
        self.findings.append(Finding(severity, code, path, line, message))

    def _read(self, relpath):
        with open(os.path.join(self.root, relpath), encoding="utf-8") as fh:
            return fh.read()

    def _exists(self, relpath):
        return os.path.exists(os.path.join(self.root, relpath))

    # -- config ----------------------------------------------------------

    def check_config(self, parsed: ParsedConfig):
        block = parsed.config
        path = parsed.path
        if block is None:
            self.add(ERROR, "E001", path, 0, "no keep-the-why:config block found")
            return

        for key, occurrences in block.fields.items():
            if len(occurrences) > 1:
                lines = ", ".join(str(line) for line, _ in occurrences)
                self.add(
                    ERROR,
                    "E004",
                    path,
                    occurrences[1][0],
                    f"config field '{key}' recorded more than once (lines {lines}) — "
                    "conflicting duplicates are exactly the state the skill refuses to guess about",
                )
            if key not in CONFIG_KNOWN:
                self.add(
                    ERROR,
                    "E005",
                    path,
                    occurrences[0][0],
                    f"unknown config field '{key}' (known: {', '.join(CONFIG_KNOWN)})",
                )

        for key in CONFIG_REQUIRED:
            if key not in block.fields:
                if key == "context-schema":
                    self.add(
                        WARNING,
                        "W001",
                        path,
                        block.start_line,
                        "config has no context-schema — assuming 0.2.0, the skill's own backfill default",
                    )
                else:
                    self.add(
                        ERROR,
                        "E002",
                        path,
                        block.start_line,
                        f"required config field '{key}' is missing",
                    )

        schema_field = block.first("context-schema")
        if schema_field:
            line, value = schema_field
            version = parse_semver(value)
            if version is None:
                self.add(
                    ERROR,
                    "E003",
                    path,
                    line,
                    f"context-schema '{value}' is not a plain semver version (X.Y.Z)",
                )
            else:
                self.schema = version
                if version > SUPPORTED_SCHEMA:
                    known = ".".join(str(part) for part in SUPPORTED_SCHEMA)
                    self.add(
                        WARNING,
                        "W003",
                        path,
                        line,
                        f"context-schema {value} is newer than the newest schema this linter knows ({known}) — "
                        "update keep-the-why-lint if the skill's references/migrations.md lists structural "
                        "changes since; otherwise checks for the newer version simply don't exist yet",
                    )

        init_field = block.first("init")
        if init_field and init_field[1] not in INIT_VALUES:
            self.add(
                ERROR,
                "E003",
                path,
                init_field[0],
                f"init '{init_field[1]}' is not one of: {', '.join(INIT_VALUES)}",
            )

        cc_field = block.first("capture-confirmation")
        if cc_field and cc_field[1] not in CAPTURE_CONFIRMATION_VALUES:
            self.add(
                ERROR,
                "E003",
                path,
                cc_field[0],
                f"capture-confirmation '{cc_field[1]}' is not one of: {', '.join(CAPTURE_CONFIRMATION_VALUES)}",
            )

        sr_field = block.first("source-reference")
        if sr_field:
            line, value = sr_field
            head, rest = _split_value(value)
            if value in ("always", "never"):
                pass
            elif (
                head == "filtered"
                or value.startswith("filtered:")
                or value.startswith("filtered ")
            ):
                criteria = (
                    rest or value.partition("filtered")[2].lstrip(":—– -").strip()
                )
                if not criteria:
                    self.add(
                        ERROR,
                        "E003",
                        path,
                        line,
                        "source-reference 'filtered' needs its criteria recorded alongside the value",
                    )
            else:
                self.add(
                    ERROR,
                    "E003",
                    path,
                    line,
                    f"source-reference '{value}' is not one of: always, never, filtered — <criteria>",
                )

        if not parsed.legacy and self.schema >= GATE_DEDICATED_CONFIG:
            id_field = block.first("id")
            if id_field is None:
                self.add(
                    ERROR,
                    "E002",
                    path,
                    block.start_line,
                    "required config field 'id' is missing (dedicated .keep-the-why files carry one since 0.10.0)",
                )
            elif not id_field[1] or " " in id_field[1]:
                self.add(
                    ERROR,
                    "E003",
                    path,
                    id_field[0],
                    f"id '{id_field[1]}' must be a non-empty token without spaces",
                )

        pinned_version = block.first("pinned-version")
        pinned_path = block.first("pinned-path")
        if (pinned_version is None) != (pinned_path is None):
            present = "pinned-version" if pinned_version else "pinned-path"
            line = (pinned_version or pinned_path)[0]
            self.add(
                ERROR,
                "E006",
                path,
                line,
                f"'{present}' without its counterpart — pinned-version and pinned-path are both present or both absent",
            )
        elif pinned_version and pinned_path:
            if parse_semver(pinned_version[1]) is None:
                self.add(
                    ERROR,
                    "E003",
                    path,
                    pinned_version[0],
                    f"pinned-version '{pinned_version[1]}' is not a plain semver version (X.Y.Z)",
                )
            if not self._exists(pinned_path[1]):
                self.add(
                    ERROR,
                    "E006",
                    path,
                    pinned_path[0],
                    f"pinned-path '{pinned_path[1]}' does not exist in the repository",
                )

        ctx_field = block.first("context")
        if ctx_field:
            self.context_dir = context_dir_from_value(ctx_field[1])
            if not self._exists(self.context_dir):
                self.add(
                    ERROR,
                    "E007",
                    path,
                    ctx_field[0],
                    f"configured context location '{self.context_dir}' does not exist",
                )

        self._check_personal_defaults(parsed)

    def _check_personal_defaults(self, parsed: ParsedConfig):
        block = parsed.personal_defaults
        if block is None:
            return
        path = parsed.path
        for key, occurrences in block.fields.items():
            if len(occurrences) > 1:
                self.add(
                    ERROR,
                    "E004",
                    path,
                    occurrences[1][0],
                    f"personal-defaults field '{key}' recorded more than once",
                )
            if key not in DEFAULTS_KNOWN:
                self.add(
                    ERROR,
                    "E005",
                    path,
                    occurrences[0][0],
                    f"unknown personal-defaults field '{key}' (known: {', '.join(DEFAULTS_KNOWN)})",
                )
            line, value = occurrences[0]
            if "last:" in value:
                self.add(
                    ERROR,
                    "E008",
                    path,
                    line,
                    "personal-defaults must not carry 'last:' timestamps — those are per-developer, "
                    "set fresh when a developer adopts the defaults",
                )
        cm = block.first("capture-mode")
        if cm and cm[1] not in CAPTURE_MODE_VALUES:
            self.add(
                ERROR,
                "E003",
                path,
                cm[0],
                f"capture-mode '{cm[1]}' is not one of: {', '.join(CAPTURE_MODE_VALUES)}",
            )
        cf = block.first("confirmation-flow")
        if cf and cf[1] not in CONFIRMATION_FLOW_VALUES:
            self.add(
                ERROR,
                "E003",
                path,
                cf[0],
                f"confirmation-flow '{cf[1]}' is not one of: {', '.join(CONFIRMATION_FLOW_VALUES)}",
            )
        for key in ("update-check", "consistency-check"):
            fld = block.first(key)
            if fld and not _INTERVAL_RE.match(fld[1].strip()):
                self.add(
                    WARNING,
                    "W002",
                    path,
                    fld[0],
                    f"{key} '{fld[1]}' doesn't match the documented shape ('every N days' or 'no')",
                )

    # -- entries ---------------------------------------------------------

    def check_topic_file(self, relpath: str):
        text = self._read(relpath)
        for entry in parse_topic_text(text):
            self._check_entry(relpath, entry)

    def _check_entry(self, path, entry):
        if not entry.fields:
            self.add(
                WARNING,
                "W102",
                path,
                entry.line,
                f"'{entry.title}': level-2 heading without any schema fields — "
                "fine for a prose section, an error if this was meant to be an entry",
            )
            return

        if self.schema >= GATE_STATUS_EVIDENCE:
            self._check_single_valued(
                path, entry, "Status", STATUS_VALUES, "E101", "E103"
            )
            self._check_single_valued(
                path, entry, "Evidence", EVIDENCE_VALUES, "E102", "E104"
            )
            for fld in entry.get("Verification"):
                match = _VERIFICATION_RE.match(fld.value.strip())
                if not match:
                    self.add(
                        ERROR,
                        "E106",
                        path,
                        fld.line,
                        f"Verification '{fld.value}' does not start with one of: {', '.join(VERIFICATION_VALUES)}",
                    )
                elif match.group(1) == "contradicted" and not match.group(2).strip():
                    self.add(
                        ERROR,
                        "E111",
                        path,
                        fld.line,
                        "Verification 'contradicted' must say what contradicts it — the label alone isn't an explanation",
                    )

        self._check_type(path, entry)

        for fld in entry.get("Revisit when"):
            if not fld.value.strip():
                self.add(
                    WARNING, "W105", path, fld.line, "empty 'Revisit when' condition"
                )

    def _check_single_valued(
        self, path, entry, name, allowed, missing_code, invalid_code
    ):
        fields = entry.get(name)
        if not fields:
            self.add(
                ERROR,
                missing_code,
                path,
                entry.line,
                f"'{entry.title}': entry has no **{name}:** field",
            )
            return
        if len(fields) > 1:
            self.add(
                ERROR,
                "E112",
                path,
                fields[1].line,
                f"'{entry.title}': more than one **{name}:** line",
            )
        value = fields[0].value.strip()
        if value not in allowed:
            self.add(
                ERROR,
                invalid_code,
                path,
                fields[0].line,
                f"{name} '{value}' is not one of: {', '.join(allowed)}",
            )

    def _check_type(self, path, entry):
        type_fields = entry.get("Type")

        if self.schema < GATE_TYPE:
            if type_fields:
                self.add(
                    WARNING,
                    "W104",
                    path,
                    type_fields[0].line,
                    "Type field present but context-schema predates 0.7.0 — migrate the project "
                    "(references/migrations.md) so the field is actually part of its schema",
                )
            return

        if not type_fields:
            self.add(
                WARNING,
                "W101",
                path,
                entry.line,
                f"'{entry.title}': no **Type:** field — fill it in the next time the entry is touched",
            )
            return

        heads = []
        for fld in type_fields:
            head, rest = _split_value(fld.value)
            heads.append(head)
            if head == "undefined":
                if self.schema < GATE_UNDEFINED:
                    self.add(
                        ERROR,
                        "E105",
                        path,
                        fld.line,
                        "Type 'undefined' needs context-schema >= 0.8.0",
                    )
                elif not rest:
                    self.add(
                        ERROR,
                        "E107",
                        path,
                        fld.line,
                        "Type 'undefined' must carry a reason: 'undefined — <short reason>'",
                    )
            elif head not in TYPE_VALUES:
                self.add(
                    ERROR,
                    "E105",
                    path,
                    fld.line,
                    f"Type '{fld.value}' is not one of: {', '.join(TYPE_VALUES)} (or 'undefined — <reason>')",
                )

        if len(type_fields) > 1:
            if self.schema < GATE_MULTI_TYPE:
                self.add(
                    ERROR,
                    "E110",
                    path,
                    type_fields[1].line,
                    "multiple **Type:** lines need context-schema >= 0.9.0",
                )
            if "undefined" in heads:
                self.add(
                    ERROR,
                    "E108",
                    path,
                    type_fields[0].line,
                    "'undefined' never combines with other Type values — it means none of them fit",
                )
            seen = set()
            for fld, head in zip(type_fields, heads):
                if head in seen:
                    self.add(
                        ERROR, "E109", path, fld.line, f"duplicate Type value '{head}'"
                    )
                seen.add(head)

        # Field order: Type is documented as placed before Status.
        status_fields = entry.get("Status")
        if (
            status_fields
            and type_fields
            and type_fields[0].line > status_fields[0].line
        ):
            self.add(
                WARNING,
                "W103",
                path,
                type_fields[0].line,
                "**Type:** is documented to come before **Status:**",
            )

    # -- index -----------------------------------------------------------

    def check_index(self, topic_files):
        index_path = os.path.join(self.context_dir, "index.md")
        if not self._exists(index_path):
            self.add(
                ERROR,
                "E201",
                index_path,
                0,
                "context index.md is missing — it's the load-bearing file for selective loading",
            )
            return
        rows = parse_index_text(self._read(index_path))
        listed = []
        for line, _text, target in rows:
            target = target.split("#", 1)[0]
            if not target.endswith(".md"):
                continue
            listed.append((line, target))
            if target not in topic_files:
                self.add(
                    ERROR,
                    "E202",
                    index_path,
                    line,
                    f"index links to '{target}', which doesn't exist in {self.context_dir}/",
                )
        listed_names = [name for _line, name in listed]
        for topic in topic_files:
            if topic not in listed_names:
                self.add(
                    ERROR,
                    "E203",
                    index_path,
                    0,
                    f"topic file '{topic}' is not listed in index.md",
                )
        if self.schema >= GATE_DEDICATED_CONFIG and listed_names != sorted(
            listed_names
        ):
            self.add(
                ERROR,
                "E204",
                index_path,
                listed[0][0] if listed else 0,
                "index entries are not sorted alphabetically by filename (convention since 0.10.0)",
            )

    # -- guard files -----------------------------------------------------

    def check_guard_files(self):
        if self.schema < GATE_DEDICATED_CONFIG:
            return
        for name in ("README.md", "AGENTS.md", "CLAUDE.md"):
            if not self._exists(os.path.join(self.context_dir, name)):
                self.add(
                    WARNING,
                    "W201",
                    os.path.join(self.context_dir, name),
                    0,
                    f"{self.context_dir}/{name} is missing (created by setup since 0.10.0; "
                    "an equivalent doing the same job is fine — then silence this deliberately)",
                )

    # -- hidden content --------------------------------------------------

    def check_hidden_content(self, relpath: str):
        text = self._read(relpath)
        for lineno, line in enumerate(text.splitlines(), start=1):
            if lineno == 1 and line.startswith(chr(0xFEFF)):
                line = line[1:]  # a leading BOM is legitimate encoding, not hiding
            for char, name in _SUSPICIOUS_CHARS.items():
                if char in line:
                    self.add(
                        ERROR,
                        "E301",
                        relpath,
                        lineno,
                        f"invisible/directional character U+{ord(char):04X} ({name}) — "
                        "hidden content doesn't belong in plain-text knowledge files",
                    )
            for match in _BASE64_RE.finditer(line):
                blob = match.group(0)
                if all(c in "0123456789abcdefABCDEF" for c in blob):
                    continue  # a long hex digest, not base64
                self.add(
                    WARNING,
                    "W301",
                    relpath,
                    lineno,
                    f"base64-looking blob ({len(blob)} chars) — if it needs decoding to be read, "
                    "it doesn't belong in an entry meant to be read",
                )

    # -- driver ----------------------------------------------------------

    def run(self, parsed: ParsedConfig | None):
        if parsed is None:
            self.add(
                ERROR,
                "E001",
                ".keep-the-why",
                0,
                "no .keep-the-why found, and no legacy keep-the-why:config block in AGENTS.md — "
                "nothing to lint (a project that never opted in shouldn't run this linter)",
            )
            return self.findings

        self.check_config(parsed)

        context_abs = os.path.join(self.root, self.context_dir)
        if not os.path.isdir(context_abs):
            return self.findings

        all_md = sorted(
            name
            for name in os.listdir(context_abs)
            if name.endswith(".md") and os.path.isfile(os.path.join(context_abs, name))
        )
        topic_files = [name for name in all_md if name not in NON_TOPIC_FILES]

        for name in topic_files:
            self.check_topic_file(os.path.join(self.context_dir, name))
        self.check_index(topic_files)
        self.check_guard_files()
        for name in all_md:
            self.check_hidden_content(os.path.join(self.context_dir, name))
        self.check_hidden_content(parsed.path)

        return self.findings
