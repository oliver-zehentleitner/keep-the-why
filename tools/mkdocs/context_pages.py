"""MkDocs hook: publish this project's own ``context/`` on the site.

Every topic file in ``context/`` becomes the page ``/context/<name>/``,
generated at build time from the file itself. There is no stub under
``docs/`` to add or forget, and no second copy to edit.

The content is read as-is. Relative links between topic files
(``lint.md``, ``index.md``) resolve to the sibling pages, exactly as they
do in the repository.

Wired in through ``hooks:`` in ``mkdocs.yml``.
"""

from __future__ import annotations

from pathlib import Path

from mkdocs.config.defaults import MkDocsConfig
from mkdocs.exceptions import PluginError
from mkdocs.structure.files import File, Files

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTEXT_DIR = REPO_ROOT / "context"

# Directory scaffolding, not topic files: the on-disk README, the agent
# guard and its import. Mirrors NON_TOPIC_FILES in lint/ktw_lint/checks.py
# (minus index.md, which is this section's landing page) - not imported
# from there, so the docs build does not depend on the linter package.
# Change both together.
NOT_PAGES = {"README.md", "AGENTS.md", "CLAUDE.md"}


def on_config(config: MkDocsConfig) -> MkDocsConfig:
    # Live reload on ``mkdocs serve`` when a topic file changes.
    config.watch.append(str(CONTEXT_DIR))
    return config


def on_files(files: Files, config: MkDocsConfig) -> Files:
    for path in sorted(CONTEXT_DIR.glob("*.md")):
        if path.name in NOT_PAGES:
            continue
        src_uri = f"context/{path.name}"
        if files.get_file_from_path(src_uri) is not None:
            raise PluginError(
                f"docs/{src_uri} exists, but the page /{src_uri[:-3]}/ is generated from "
                f"{path.relative_to(REPO_ROOT)} by tools/mkdocs/context_pages.py "
                "- delete the file under docs/."
            )
        files.append(
            File.generated(
                config,
                src_uri,
                content=path.read_text(encoding="utf-8"),
            )
        )
    return files
