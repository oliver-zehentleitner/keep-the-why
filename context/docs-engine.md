# Docs engine

## Current: mkdocs-material

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

Docs are built with mkdocs + the `mkdocs-material` theme + the `mkdocs-include-markdown-plugin`. Source lives in `docs/*.md`. Most pages are thin include-directive wrappers (the plugin's own syntax, not spelled out literally here — writing it out breaks this file's own build, see the note at the bottom) pointing at the actual source of truth (`README.md`, `references/*.md`, `examples/*.md`) — one copy of each piece of content, not a duplicate maintained separately for the site. Build output goes to `site/`, which is git-ignored; the live site is built and deployed by `.github/workflows/docs.yml` via GitHub Pages' "deploy via Actions" mechanism, not committed to any branch.

**Reason for the include-directive approach specifically:** avoids maintaining two versions of the same content (one for GitHub's raw-file rendering, one for the built site).

## Rejected: Sphinx + furo + myst-parser

**Status:** superseded (2026-07-10, same day it was built)
**Confirmed**

First implementation. Copied directly from the `a1-ai-expert-case-study` project's docs pipeline at the maintainer's explicit request ("mit dem Theme wie aus dem A1 case study Projekt"): Sphinx source in `dev/sphinx/config/`, built HTML committed to `docs/` and served via GitHub Pages "deploy from branch."

**Rejected because:** Sphinx's core feature set (`autodoc`, `napoleon`, RST-first tooling) exists to document a Python package's API. This repo has no Python package and nothing to autodoc — it's markdown content only. That mismatch surfaced as unnecessary complexity: `build_docs.sh` had to *stage* copies of `README.md`, `references/`, and `examples/` into the Sphinx source directory before every build and delete them afterward, purely to satisfy Sphinx's assumption that all source content lives in one directory it controls.

**What triggered the change:** the maintainer asked directly, after the initial Sphinx setup was already built and working, "ich möchte keine strukturellen Altlasten aus UBS übernehmen" (I don't want to inherit structural baggage from UBS) — followed by a direct question about whether `dev/` was still justified. That prompted a critical review of the whole pipeline rather than treating "it already works" as sufficient justification to keep it.

**Also changed in the same pass, for the same reason:**
- Committing built `docs/` HTML to `main` was replaced with a CI-built, artifact-deployed Pages site (see `repo-conventions.md`) — the original A1-style pattern of "build locally, commit the output" was itself the thing being avoided, not something to merely automate.
- `dev/sphinx/` was flattened to `sphinx/` (later removed entirely with the Sphinx→mkdocs switch) — there was nothing else under `dev/` to justify the extra nesting; it existed only because A1 had other dev-only tooling that this repo doesn't.

## Why this file avoids spelling out the include-directive syntax literally

**Status:** active
**Confirmed**

The paragraph above deliberately doesn't write out the plugin's own directive syntax character-for-character. It caused a real build failure: this file gets pulled into the docs site via that same directive (`docs/context/docs-engine.md` includes this file), and the plugin's parser tried to execute the literal syntax found in this file's own prose as a second, nested directive with no path argument, and the build broke. This note exists so nobody "fixes" the paraphrase back to the literal syntax without knowing why it was avoided.

