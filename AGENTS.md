# AGENTS.md

This project uses Keep the Why (itself) to preserve the reasoning behind its own code.

- Usage docs: see `docs/` (or https://keepthewhy.com)
- Why things are the way they are: see `context/index.md`
- If `AGENTS.local.md` exists in this checkout, read that too — personal/local notes, not committed.

Read `context/index.md` before making non-trivial changes — naming, docs
tooling, and repo structure have already been argued through once; check
there before re-litigating or accidentally reverting a decision.

<!-- keep-the-why:config -->
- context: `context/`
- init: complete
- context-schema: 0.8.0
- capture-confirmation: confirm-always
- source-reference: never
<!-- /keep-the-why:config -->

## Working conventions (no why needed, just follow these)

- `CHANGELOG.md`: one `### Added` / `### Changed` / `### Fixed` heading per category under `[Unreleased]` — reuse an existing one instead of opening a new one for the same category. Entries within a category, alphabetically ordered by first word, not insertion order.
