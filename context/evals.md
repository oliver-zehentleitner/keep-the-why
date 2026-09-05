# Eval runner and suite

Design decisions about `tools/evals/` — the runner, the judge, the fixtures, what the numbers mean. The suite's results and caveats are on `docs/evals.md`; this file is about why the tooling is shaped the way it is.

## The runner is a package with one module per responsibility, `run.py` stays the entry point

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** external review of 0.11.0 (2026-09-04) named the 2,250-line `run.py` as the clearest maintainability risk; Oliver approved the split
**Revisit when:** a second judge, a new driver family, or a CI consumer needs to import the runner rather than shell out to it

`tools/evals/run.py` holds the CLI and the module docstring only; the code is in `tools/evals/ktw_evals/` — `common`, `cases`, `workdir`, `drivers/` (one module per agent CLI, registry in `__init__`), `analysis`, `judge`, `results`, `runner`, `matrix`. Every documented `python3 tools/evals/run.py …` invocation is unchanged.

**Reason:** the split was done now, before the deterministic per-case checks and the separated activation/completion/judge counts, because both land in exactly one module each (`runner`/`results`) instead of in the middle of one 2,250-line file — and because the next driver, or a second judge, would otherwise have grown the monolith further. Not done earlier because the file was still readable and nothing needed to import it; "refactor because it's possible" was deliberately rejected for `lint/checks.py` at the same time (650 lines, one consumer, no growth pressure).

**Rejected alternative:** a `drivers/` split only, leaving the rest of the file whole — the drivers are the biggest block but not where the next changes go. Also rejected: making the package pip-installable. It is a development tool for this repository; a `pyproject.toml` would invite the impression that it is a product like `keep-the-why-lint`, which it is not.

**Consequence:** mechanical refactors here get the same before/after check as any other: the same cases run on the same host before and after, records compared. Worth it even for a pure move — the after-run caught two mistakes the import smoke test did not: `TOOL_DIR` resolved one directory too deep once `common.py` lived inside the package, and `skill_version = skill_version()` in two functions shadowed the helper it called. Two cases were enough for a move; a behavior change to the runner needs more.
