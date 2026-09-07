"""Command-line interface.

Exit codes: 0 clean (warnings allowed), 1 errors found (or warnings with
--strict), 2 usage/environment problem.
"""

from __future__ import annotations

import argparse
import os
import sys

from . import __version__
from .checks import Linter
from .config import parse_config_text
from .findings import ERROR, WARNING


def _load_config(root: str, linter: Linter):
    """The project config: `.keep-the-why`, or the legacy block in AGENTS.md.

    Read through the linter so the config file gets the same treatment as
    everything below it: a symlink leaving the tree is E009 and not read,
    invalid UTF-8 is E302 and still parsed.
    """
    for name, legacy in ((".keep-the-why", False), ("AGENTS.md", True)):
        if not os.path.isfile(os.path.join(root, name)):
            continue
        if not linter._confined(name):
            linter.add(
                ERROR,
                "E009",
                name,
                0,
                f"{name} is a symlink leaving the repository — not read",
            )
            linter.config_rejected = True
            return None
        parsed = parse_config_text(linter._read(name), name, legacy=legacy)
        if not legacy or parsed.config is not None:
            return parsed
    return None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="ktw-lint",
        description="Structural linter for Keep the Why projects: validates "
        ".keep-the-why and the configured context directory. Structure only — "
        "whether the recorded rationale is true is not mechanically checkable.",
    )
    parser.add_argument(
        "path", nargs="?", default=".", help="project root (default: current directory)"
    )
    parser.add_argument(
        "--strict", action="store_true", help="treat warnings as errors"
    )
    parser.add_argument(
        "--github",
        action="store_true",
        help="emit GitHub Actions annotations (auto-enabled when GITHUB_ACTIONS is set)",
    )
    parser.add_argument(
        "--version", action="version", version=f"ktw-lint {__version__}"
    )
    args = parser.parse_args(argv)

    root = os.path.abspath(args.path)
    if not os.path.isdir(root):
        print(f"ktw-lint: not a directory: {args.path}", file=sys.stderr)
        return 2

    as_github = args.github or os.environ.get("GITHUB_ACTIONS") == "true"

    linter = Linter(root)
    findings = linter.run(_load_config(root, linter))
    findings.sort(key=lambda f: (f.path, f.line, f.code))

    for finding in findings:
        print(finding.format_github() if as_github else finding.format_text())

    errors = sum(1 for f in findings if f.severity == ERROR)
    warnings = sum(1 for f in findings if f.severity == WARNING)
    schema = ".".join(str(part) for part in linter.schema)
    # A rejected location (E009) is not echoed raw: it came from the config
    # file and may carry anything, control characters included.
    context = "rejected" if linter.context_rejected else f"{linter.context_dir}/"
    print(
        f"ktw-lint {__version__}: {errors} error(s), {warnings} warning(s) "
        f"(context-schema {schema}, context: {context})"
    )

    if errors or (args.strict and warnings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
