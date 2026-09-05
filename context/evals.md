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

## Deterministic checks decide a case when they fail; the judge only grades what a machine can't settle

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** external review of 0.11.0 (2026-09-04), which pointed out the judge was being asked things like "was file X created?"; Oliver approved as item 6
**Revisit when:** a check turns out to fail a case the judge would rightly have passed more than once — that is the signal the certainty rule was applied too loosely

A case in `evals.json` may declare `checks` (file written / not written under a prefix, a file unchanged, a literal string absent from everything the agent wrote, a regex present in a named file, the skill loaded by a tool call). They run against the workdir itself, before the judge. Any failed check fails the case with the check's own one-line detail as the reasoning; the judge is not called. `--judge-always` calls it regardless and keeps its verdict in a separate field.

**Reason:** three things at once. Cost — a judge call on a case that has already mechanically failed buys nothing. Reproducibility — "no file under `context/` was written" is the same answer every time, a judge's reading of the same diff is not (the r8 flip on `type-field-multiple-values-when-warranted` was exactly a formatting fact a regex settles). Judge calibration — with `--judge-always` the judge's verdict on a mechanically failed case is stored next to the final one, so a judge blind spot shows up as data instead of staying invisible inside a pass count. The checks were added only where they follow with certainty from the expected behavior: 44 of 74 cases, deliberately not more.

**Rejected alternative:** feeding check results to the judge as hints and letting it decide. That keeps the judge in the loop for facts it should not be interpreting, and it costs the same call. Also rejected: running the judge always by default and treating checks as advisory — then a check that failed and a judge that passed would need a tie-break rule, and the honest tie-break is that the machine is right about what is on disk.

**Consequence:** a check is a hard assertion, so the bar for adding one is certainty, not plausibility. "Asks before writing" cases got `no_changes_under context/` only where the expected behavior says nothing may be written before the answer; cases where an agent could legitimately write a differently-shaped entry got no text check. The first run over the 44 cases that had checks, with `--judge-always`, is the calibration record (2026-09-05, `docs/evals.md`): checks 41/44, judge 43/44. One disagreement each way — the judge passed a one-line `**Type:** incident, workaround` that the case's own expected behavior calls the failure form (check right, judge wrong), and a `changes_under context/` check failed a case whose prompt never states the decision, so the agent correctly asked instead of writing (check wrong, removed; 43 cases carry checks now). Both outcomes are what the mechanism is for.

## The summary reports activation, completion, deterministic checks and judge pass as four numbers, not one

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** external review of 0.11.0 (2026-09-04); the 2026-08-25 run in `docs/evals.md` is the historical case for it
**Revisit when:** a fifth failure class shows up that none of the four attribute correctly

`summary.json` carries a `metrics` block and `summary.md` one line: skill loaded n/m, completed n/m, deterministic checks n/m, judge pass n/m. "Skill loaded" is mechanical — a tool call in the transcript loaded the skill; the agent saying so does not count.

**Reason:** the 2026-08-25 row (56/70) was mostly the skill never being loaded, not the skill misbehaving, and it took reading fourteen transcripts to know that. With the numbers apart, a drop in "skill loaded" is an activation problem, a drop in "completed" is the harness or the account, and only the last two are about the skill. The pass count stays as the headline because it is what the run history compares; the four are what to read when it moves.

**Rejected alternative:** reporting only the judge number on the cases that activated — hides the activation problem, which is the one that has actually bitten.

