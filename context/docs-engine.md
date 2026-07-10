# Docs engine

## mkdocs-material

**Status:** active
**Confirmed**

Docs are built with mkdocs + the `mkdocs-material` theme + the `mkdocs-include-markdown-plugin`. Source lives in `docs/*.md`. Most pages are thin include-directive wrappers (the plugin's own syntax, not spelled out literally here — writing it out breaks this file's own build, see the note at the bottom) pointing at the actual source of truth (`README.md`, `references/*.md`, `examples/*.md`) — one copy of each piece of content, not a duplicate maintained separately for the site. Build output goes to `site/`, which is git-ignored; the live site is built and deployed by `.github/workflows/docs.yml` via GitHub Pages' "deploy via Actions" mechanism, not committed to any branch.

**Reason:** this repo has no Python package and nothing to autodoc — it's Markdown content only, so a tool built specifically for Markdown-only documentation sites fits better than a heavier, API-reference-oriented generator would. The include-directive plugin lets pages reference the real source files directly, so there's exactly one copy of each piece of content — no separate site-only version to keep in sync.

## Why this file avoids spelling out the include-directive syntax literally

**Status:** active
**Confirmed**

The paragraph above deliberately doesn't write out the plugin's own directive syntax character-for-character. It caused a real build failure: this file gets pulled into the docs site via that same directive (`docs/context/docs-engine.md` includes this file), and the plugin's parser tried to execute the literal syntax found in this file's own prose as a second, nested directive with no path argument, and the build broke. This note exists so nobody "fixes" the paraphrase back to the literal syntax without knowing why it was avoided.
