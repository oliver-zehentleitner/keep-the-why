"""Structural linter for Keep the Why projects.

Validates the structure of a project's .keep-the-why config and its
context/ directory (entry fields, field values, index consistency,
hidden-content red flags). Content — whether the recorded rationale is
true, complete, or honest — is out of scope by design: that part is not
mechanically checkable.

Versioning: the first three segments of __version__ are the newest skill
schema this linter knows every structural gate of (SUPPORTED_SCHEMA); the
fourth segment is the linter's own revision, bumped for linter-only
changes. PEP 440, not strict SemVer — PyPI rejects the SemVer build-
metadata spelling this would otherwise use.
"""

__version__ = "0.11.0.0"

SUPPORTED_SCHEMA = (0, 11, 0)
