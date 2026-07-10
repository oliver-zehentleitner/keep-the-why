# Docs engine

## Current: mkdocs-material

**Status:** active
**Confirmed**

Docs are built with mkdocs + the `mkdocs-material` theme + the `mkdocs-include-markdown-plugin`. Source lives in `docs/*.md`. Most pages are thin include-directive wrappers (the plugin's own syntax, not spelled out literally here — writing it out breaks this file's own build, see the note at the bottom) pointing at the actual source of truth (`README.md`, `references/*.md`, `examples/*.md`) — one copy of each piece of content, not a duplicate maintained separately for the site. Build output goes to `site/`, which is git-ignored; the live site is built and deployed by `.github/workflows/docs.yml` via GitHub Pages' "deploy via Actions" mechanism, not committed to any branch.

**Reason for the include-directive approach specifically:** avoids maintaining two versions of the same content (one for GitHub's raw-file rendering, one for the built site).

## Rejected: Sphinx + furo + myst-parser

**Status:** superseded
**Confirmed**

Sphinx (with the `furo` theme and `myst-parser` for Markdown support) was considered and briefly implemented before being replaced.

**Rejected because:** Sphinx's core feature set (`autodoc`, `napoleon`, RST-first tooling) exists to document a Python package's API. This repo has no Python package and nothing to autodoc — it's Markdown content only. That mismatch showed up as unnecessary complexity: keeping all documentation source inside one Sphinx-controlled directory required staging copies of `README.md`, `references/`, and `examples/` into that directory before every build and deleting them afterward, purely to satisfy an assumption Sphinx makes that doesn't apply to a pure-Markdown project.

**Chosen instead:** mkdocs-material, because it's built for exactly this case — Markdown-only content, no API to autodoc — and its include-directive plugin lets pages reference the real source files directly without a staging/cleanup step.

**Also decided at the same time, for the same underlying reason (no structural complexity without a concrete need for it):**
- Built HTML is never committed to `main` — see `repo-conventions.md`. The build runs in CI and deploys straight to GitHub Pages via the Actions-artifact mechanism.
- Docs tooling lives directly at the repo root (`mkdocs.yml`, `docs/`, `requirements-docs.txt`) rather than nested under a `dev/` directory — there's nothing else under `dev/` that would justify the extra nesting.

## Why this file avoids spelling out the include-directive syntax literally

**Status:** active
**Confirmed**

The paragraph above deliberately doesn't write out the plugin's own directive syntax character-for-character. It caused a real build failure: this file gets pulled into the docs site via that same directive (`docs/context/docs-engine.md` includes this file), and the plugin's parser tried to execute the literal syntax found in this file's own prose as a second, nested directive with no path argument, and the build broke. This note exists so nobody "fixes" the paraphrase back to the literal syntax without knowing why it was avoided.
