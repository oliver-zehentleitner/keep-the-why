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

## Case workdirs must not live under the operator's home; the runner refuses to start if they would

**Type:** incident
**Type:** constraint
**Status:** active
**Evidence:** confirmed
**Source:** 2026-09-05, two of three runs of `personal-defaults-auto-accept-no-question` with `TMPDIR` pointed inside the repository; the leaked file was found in the real `~/.keep-the-why/` and removed
**Revisit when:** the fake `$HOME` mechanism is replaced by something the agent can't see through (a container per case, a different user)

The eval runner's per-case fake `$HOME` isolates the agent from the operator's real `~/.keep-the-why/`. That isolation is only as good as the agent's ignorance of where the real home is. When `/tmp` (a 2 GB tmpfs on this host) ran full and `TMPDIR` was pointed at `tools/evals/results/tmp` inside the checkout, every case path began with `/home/claude-agent/…` — and two agents, told to write `~/.keep-the-why/<id>.md`, wrote it as `/home/claude-agent/.keep-the-why/<id>.md`, the real one, while the shell-level `ls ~/.keep-the-why` in the same session correctly showed the fake home. The run's own deterministic check caught it (the expected file was missing from the fake home), which is how it was noticed at all.

**Reason:** `run_until_resolved()` and `run_matrix()` now call `refuse_tempdir_inside_home()` — a hard stop, not a warning, because a run that has started is the one that leaks. `TMPDIR=/var/tmp` (disk-backed, outside home) is the documented answer for a small `/tmp`.

**Rejected alternative:** scrubbing the real home path from what the agent sees (a symlinked workdir, a chroot-ish rename). Fragile — `pwd`, tool results and error messages all carry the path — and a guard that refuses the unsafe layout costs nothing.

## A release series passes when every case passes two of three runs, no run has more than one failed case, and no guard check is violated at all

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** 19 consecutive full runs on 2026-09-16/17 (`docs/evals.md`, "How a series is judged"); maintainer decision, 2026-09-17
**Revisit when:** a newer agent model moves the per-case pass rate far enough that a series misses neither line for several releases — then the lines can be tightened

Three consecutive full runs are judged together by `tools/evals/series.py`: per case, at least 2 of 3 passes; per run, at most one failed case. A case that fails once is reported with the judge's reason and treated as variance until it comes back.

**Reason:** the goal had been three clean 88/88 runs in a row, and 19 full runs showed what that asks for. 98.6 % of 1,672 case runs passed, 1.2 cases failed per run, two runs were clean; the failing case was a different one almost every run and had passed 20 to 29 times before. Agent and judge are both sampled and neither can be seeded, so at that rate a clean run is the exception — two of the 19 — and three in a row are dice. What a series can actually show is that no case is reliably broken (the per-case line — the same threshold this project already used informally: one flip is variance, the same form twice is wording) and that no run is broadly off (the per-run line, which a regression or a broken environment trips at once: the one wording change that did regress gave 84/88).

**Rejected alternative:** keep 3 × 100 % as the bar and fix every flip. Tried for 18 attempts at such a series: each single-flip sentence cost a full measurement, three of them tipped a neighbouring case that had never failed, and `SKILL.md` grew by 17 % without the rate moving. Also rejected: a per-case gate alone, without the per-run line — it would pass a series of 84/88 runs as long as the failures were spread over different cases, which is exactly the regression picture.

**Guards, added 2026-09-21** after the first public feedback on the rule: the 2-of-3 allowance was uniform, so a single write nobody allowed would have passed as variance. The allowance exists because the judge is sampled; a deterministic prohibition — nothing written under `context/`, `.keep-the-why` untouched, a secret or an injected payload absent from disk — involves no judge, and its failure costs trust, not style. Those 53 checks on 39 cases are guards (`is_guard`), and a series tolerates no violation of one. The agent is still sampled, so this line can stop a release on one bad draw; that is accepted — the transcript gets read before anything ships. 0.17.0 is the standard (no violation in its series); 0.16.0 and 0.16.1 would not have met it. Three prohibitions that really state a required action or a format opt out with `"guard": false`.

**Per-case history, added 2026-09-21** from the same round of feedback: `tools/evals/history.json` records each released series (passes per case) and `series.py` prints a flipped case's record next to it. Deliberately a reading aid and not a fourth line — a sliding window across releases would mix different skill texts — and deliberately starting at 0.17.0: earlier series measured other wording under no rule, and the project tests forward from here.

**The instrument is named, added 2026-09-21**, same round of feedback: agent and judge run through the `sonnet` alias, which the vendor can move to a newer model without a trace here, and nothing in a result said which judge prompt had graded it. Every record now carries the resolved model ids and a hash of the judge prompt. Pinning an exact model id in the runner was the alternative; rejected because the suite should follow the model its users get, and recording makes the moment it changes visible instead of preventing it.

**Consequence:** `series.py` exits non-zero when any of the three lines is missed, and the release checklist names it. The per-run line fails by chance more often than the per-case one at today's rate; when it does, the run's failures are read before anything is re-measured, which is the point of having it.

## A sentence goes into the skill for a failure form seen twice, not for a single flip; the ask-versus-write logic is a table

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** the 2026-09-16/17 measurement: three variants of the same state, three full runs each; maintainer decision, 2026-09-17
**Revisit when:** a single flip turns out to have been the first sighting of a form that then recurs — the threshold is about evidence, not about ignoring the first report

Wording changes that come out of an eval series are limited to forms that failed at least twice (in one series, or across series with the same shape in the transcript). `SKILL.md` step 5 decides ask-versus-write from a table — six situations, first match wins, one column per `capture-confirmation` value — with four modifiers under it, instead of six prose bullets.

**Reason:** measured, not assumed. A variant carrying nine sentences for single flips and a lean variant without them scored the same over three full runs each (87 · 88 · 87 both, 86 cases 3/3 both), so the sentences bought nothing; they did cost length (+17 % against +6.5 % over the 0.16.3 text) and three regressions on the way in, each time a neighbouring case that reads the same paragraph. The ask-versus-write bullets were where those collisions happened: every clause added to one bullet ("write now") shifted the reading of the next ("nothing written until answered"). A table has no neighbouring sentence to lean on — a situation matches a row or it does not — and it is 21 % shorter than the bullets it replaces. On the 28 cases that exercise it, the prose stood at 98.3 % over 19 full runs; the table had no flip in 84 isolated runs and none in two full series.

**Rejected alternative:** keeping the prose and adding one sentence per observed failure — see above, it is how the 17 % came about. Also rejected: moving the table out to `references/setup.md` to keep `SKILL.md` short — during capture the skill body is what the agent has in context, a reference is loaded on demand, and the first table draft already showed how little slack there is: a modifier that lost four words ("not instead") made the agent hold a write back for an answer under `automatic`.

**Consequence:** a one-time flip gets an issue with the transcript's reason, labelled `evals`, not a sentence. Expectation texts are part of the same discipline — four of the flips in that measurement were the judge reading more into an expectation than it meant ("may" read as "must", a fixture detail read as a requirement), fixed in `evals.json`, not in the skill.

## The instrument moved under the same model id; a run now records CLI version and session shape, and stored runs can be re-graded

**Type:** incident
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** the 0.17.1 release measurement, 2026-09-21 (`docs/evals.md`, "Latest full-suite results"); a counter-run on the previous CLI the same evening; the first re-grading measurement the same evening
**Revisit when:** a vendor exposes a way to pin the exact model build behind an id — then the recorded fields can become a pin instead of a record

Four days after the 0.17.0 series (87/88/87), the same skill text (three explanatory sentences apart) measured 83/80/81 — with `claude-sonnet-5` as the resolved id, the same judge prompt, and, per a counter-run pinned to the old binary, the same result on the previous CLI. What differed was the agent's behaviour: median 6 turns and 4 tool calls per case instead of 13 and 11, no reference file opened, action before question. The next morning two cases ran at 14 and 12 again. Nothing in the repository, the CLI or the environment explains it; a change on the vendor's side is the only remaining place.

**Reason:** a pass count is only comparable with another one measured by the same instrument, and "same model id" turned out not to mean "same instrument". The cheapest thing that would have shown the change before anyone read a verdict is the session shape — how much the agent did — so every run now records `median_turns` and `median_tool_calls` next to the model ids, the judge prompt hash and, new, the CLI version. The 0.17.1 numbers stay in the run history as measured, with the explanation, rather than being dropped: a series that fails because the ruler changed is worth more on the page than a gap.

**Rejected alternative:** re-measuring until a series passes, and publishing that one. Rejected — it would publish the instrument's good day, not the skill. Also rejected: changing the skill to satisfy the new behaviour on the spot — the forms that failed (act before ask, overwrite one source with the other) had passed 3/3 on the same wording four days earlier, and two of the sentences that would address them had just been removed as single-flip patches for that reason. If the behaviour persists, that becomes a decision about the skill; if it does not, a sentence written for one bad evening would have been noise in the skill text.

**Re-grading** (`tools/evals/regrade.py`) came out of the same evening, prompted by the first public feedback on the series rule: the judge is asked again about a stored transcript and diff, without an agent session. First measurement: the judge agrees with itself on 139 of 148 records five times over, so its sampling noise on a fixed transcript is small; against the stored verdicts it differs in both directions (10 of 41 judge-decided failures would pass today, 8 of 88 stored passes fail), and a hand-read case shows the re-grade right and the stored pass wrong — the same drift, seen from the grading side. A wording change made in answer to a failure should therefore be preceded by a re-grade of that failure.

**Consequence:** `summary.json` carries `cli_version`, `median_turns`, `median_tool_calls`; release checklist step 14 compares instruments before it compares pass counts; the operator's `~/.local/bin` is shadowed without the linter launchers in every session (a reinstalled host linter cost two cases that evening); `docs/evals.md` names the 0.17.0 series' CLI as 2.1.274, not 2.1.273 as it had said.
