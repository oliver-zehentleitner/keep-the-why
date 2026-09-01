# AGENTS.md

This project uses Keep the Why (itself) to preserve the reasoning behind its own code.

- Usage docs: see `docs/` (or https://keepthewhy.com)
- Why things are the way they are: see `context/index.md`
- If `AGENTS.local.md` exists in this checkout, read that too — personal/local notes, not committed.

Read `context/index.md` before making non-trivial changes — naming, docs
tooling, and repo structure have already been argued through once; check
there before re-litigating or accidentally reverting a decision.

Keep the Why's config for this project migrated to .keep-the-why on
2026-09-01 — requires skill version 0.10.0 or later to read it.

## Working conventions (no why needed, just follow these)

- `CHANGELOG.md`: one `### Added` / `### Changed` / `### Fixed` heading per category under `[Unreleased]` — reuse an existing one instead of opening a new one for the same category. Entries within a category, alphabetically ordered by first word, not insertion order.
