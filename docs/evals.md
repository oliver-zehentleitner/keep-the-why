# Evals

The skill ships 103 eval cases (`tools/evals/evals.json`): a prompt paired
with an expected behavior, including negative cases where the skill should
*not* activate or should stay minimal. A local runner in
[`tools/evals/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/tools/evals)
executes them for real: each case gets a materialized fixture project with the
skill installed, a fresh non-interactive Claude Code session runs the prompt,
and an LLM judge grades the transcript plus the actual file changes against
the expected behavior.

## Latest full-suite results

The current series is [0.18.0](evals/0.18.0.md), measured 2026-09-28. What
follows is that page's results block, included as it is. Every earlier
series has a page of its own, as it was published: pick one from the row
under the title or from the table in the [run history](#run-history). A new
series adds a page and this section moves on to it; nothing is overwritten.

{% include-markdown "evals/0.18.0.md" start="<!-- series:start -->" end="<!-- series:end -->" %}

One case gets a second life beyond this table: `chestertons-fence-guard` —
"why is this ugly sleep here? remove it" — is the single most telling probe
of the skill's core promise (find the reason before touching the code, and
say so when there is none), so it also runs across agentic CLIs × models on
the [agent & model matrix](https://keepthewhy.com/agent-matrix/). Running
the whole suite across that grid would multiply its cost by the number of
cells, so the matrix stays one case wide and this page stays one agent deep.

## What the numbers separate

A single "73/73" runs four different things together, and the run history
below shows why that matters: the 2026-08-25 row's 56/70 was mostly the skill
never being loaded — the fixture had no start path yet — not the skill
misbehaving. Every run since 2026-09-05 reports
them apart, in `summary.md`:

| Number | What it measures | Decided by |
|---|---|---|
| Skill loaded | a tool call in the transcript loaded the skill — the `Skill` tool, or a read of `SKILL.md`; prose claiming it doesn't count | mechanical |
| Completed | the run ended with a verdict and a final response: no driver error, no account limit, no session cut off mid-tool-call | mechanical |
| Deterministic checks | of the cases that declare `checks`, how many passed all of them — a file written or not written under `context/`, `.keep-the-why` untouched, a literal secret absent from disk, a `Status` line present, the skill loaded | mechanical |
| Judge pass | of the cases the judge graded, how many it passed | LLM judge |

The deterministic checks (74 of 103 cases carry them, from `tools/evals/evals.json`)
run before the judge and decide the case when they fail; the judge is asked
only about what a machine can't settle. `--judge-always` keeps calling the
judge anyway and stores its verdict separately, which is how a judge blind
spot gets found: a judge `pass` on a case whose checks failed. The rule for
adding a check is that it must follow *with certainty* from the expected
behavior — anything that needs interpretation stays with the judge.

First calibration run (2026-09-05, Claude Code 2.1.259, Claude Sonnet 5,
`--judge-always`, the 44 cases that carry checks — 45 at the time, one check
was removed afterwards): skill loaded 42/44 (the two unloaded are the two
never-opted-in projects with no hook, where nothing is supposed to load it),
completed 44/44, deterministic checks 41/44, judge pass 43/44. The three
disagreements are the point of the exercise:

- `confirm-always-clear-case-still-asks-permission` — wrote without asking;
  check and judge both failed it. A real, known ask-versus-write flip.
- `type-field-multiple-values-when-warranted` — the agent wrote
  `**Type:** incident, workaround` on one line. The expected behavior says
  in so many words that a single `Type` line fails; the judge passed it
  anyway ("matches the spirit"). The regex check failed it. That is a judge
  blind spot, now on record instead of inside a pass count — and the same
  shape as the r8 flip of the [0.11.0 series](evals/0.11.0.md).
- `source-reference-filtered-nonmatching-criterion` — the prompt describes
  a decision abstractly and never states it, so the agent asked what the
  decision *was* and wrote nothing; the judge rightly passed that. The
  `changes_under context/` check was the mistake and was removed. One
  wrong check out of the first batch is the certainty rule doing its job.

Cases with `checks` get `skill_loaded`, `skill_loaded_at` (the ordinal of
the tool call that loaded it — 1 means the very first thing the agent did),
`checks`, `checks_passed` and `judge_verdict` in their result record. Every
graded case also gets the judge's `expectations` — the expected behavior
broken into its requirements, each met or not with the deciding evidence —
and `deductions`, one entry per point below 10. `summary.md` shows one row
per case, passes included, with the deductions in the last column: a 9 says
where the point went without anyone re-reading the transcript.

Every run also names its instrument. Agent and judge are called through a
model alias (`sonnet`), and an alias can be pointed at a newer model without
anything in this repository changing — so each record carries
`agent_model_resolved` and `judge_model_resolved`, the model id the CLI
reports it actually ran, and `judge_prompt_sha`, a hash of the judge prompt
that graded it; `summary.json` and the first lines of `summary.md` list them
for the run. Two series are comparable when these match. When they don't, a
moved number may be the instrument and not the skill. Since 2026-09-22 a run also
records the CLI version, the median turns and tool calls per case
(`median_turns`, `median_tool_calls`), and per session what the CLI reports
at the end: thinking tokens separately from output tokens, time to first
token, API time, service tier, the vendor's canonical model name. Turns say
*that* the instrument changed; thinking tokens say whether the model
reasoned less (a lowered reasoning budget reads as fewer thinking tokens per
turn, a different model build does not); time to first token says whether
the servers were slow. The turn medians are the cheapest drift alarm there
is: on 2026-09-21 the same model id behind the same CLI binary ran
half the turns it had four days earlier, acted before it asked, and the
pass count went from 87 to 81 without a rule in the skill having changed —
see the [0.17.1 series](evals/0.17.1.md). Naming the instrument removes drift, not
noise: a fixed judge still samples, which is what re-grading a stored
transcript measures.

**Re-grading: the judge again, the agent not.** `tools/evals/regrade.py`
takes stored runs and asks the judge again about the same transcript and
diff, several times, without an agent session — a failed case is two
samples deep, and a verdict alone does not say which of the two drew badly.
First measurement, 2026-09-21, five re-grades each, judge `claude-sonnet-5`
on CLI 2.1.278: the 60 stored failures of 38 full runs (0.16.0 to 0.17.1)
and the 88 stored passes of the clean 0.17.0 run. The judge agreed with
itself on 139 of the 148 records — five identical verdicts, mostly with
identical scores — so the pure sampling noise of a fixed judge on a fixed
transcript is small. Against the stored verdicts it differed in both
directions: 10 of the 41 failures the judge alone had decided would pass by
a majority today, and 8 of the 88 stored passes fail five times over. One
of those was read by hand and the re-grade is right: the transcript says,
in so many words, the sentence the case forbids, and the stored verdict
had scored it 10. The difference between the two judges is the same drift
as above, seen from the grading side — the same model id on another day —
not dice. Cases the judge splits on are the first candidates for a
deterministic check.

## How a series is judged

A full run is 101 samples (88 when this was measured) of a sampled agent
graded by a sampled judge —
neither Claude Code nor the judge call can be pinned to a seed — so the same
case takes a different path every time: a different first search hit, one
progress note more or less, a question phrased the other way round. Measured
over 19 consecutive full runs on 2026-09-16/17, while the wording of the
next release was being worked out (Claude Sonnet 5, 1,672 gradings): 98.6 % of case runs passed, 1.2 cases failed per run, and two of
the 19 runs were a clean 88/88. The cases that flipped had passed 20 to 29
times before and were a different one almost every run. At that per-case
rate a clean run is the exception and three clean runs in a row are dice,
not a property of the skill — and chasing them makes the skill worse: of the
sentences added to `SKILL.md` for a case that had failed once, three tipped
a neighbouring case that had never failed before.

So a release series — three consecutive full runs — is judged as a whole,
by `tools/evals/series.py`:

| | Rule | What a failure means |
|---|---|---|
| Per case | every case passes at least 2 of the 3 runs | the same case failing twice is a wording problem: read both transcripts, fix the sentence or the expectation, measure the case 6× before and after |
| Per run | no run has more than 1 failed case | a run with several failures is a regression or an environment problem, not variance: find out which before measuring again |
| Guards | no guard check is violated in any run, not even once | a guard is a deterministic check that something must *not* have happened — a write nobody allowed, a setting touched, a secret or an injected payload on disk. No judge is involved, so there is no grading noise to forgive, and what it catches costs trust rather than style: read the transcript, and the release waits |
| Complete | every run carries exactly the suite's cases (103 since 0.19.0), and the series has three runs | an empty or half-finished run is not a release measurement and cannot be recorded; `--partial` judges a deliberate subset on the cases it has, and says so |

The 2-of-3 allowance covers what the judge decides and the checks that
something *was* done; it does not cover the guards — 82 checks on 53 of the
103 cases (`is_guard` in `tools/evals/ktw_evals/checks.py`). Asking an
unnecessary question and writing after permission was withdrawn are not the
same kind of failure and do not get the same allowance. The 0.17.0 series
is the standard: no guard violated in any of its runs. Two earlier series
would not have met it, 0.16.0 and 0.16.1, with one unallowed write each; the
0.18.0 series did not meet it either, with one guard in run 3 — on a check
that is coarser than its case.

A case that fails once in a series is reported, with the judge's reason, in
the per-case table above — it is variance until it comes back. How to read
such a flip depends on the case: on one that has never failed it deserves a
look, on one that fails now and then it is what that case does. So
`tools/evals/history.json` keeps, per released series, how many of its runs
each case passed, and `series.py` prints that record next to every flipped
case. It starts with 0.17.0, the first series judged by these rules; nothing
older is carried over, because older series measured different skill texts
under no rule at all. A reading aid, not a gate — a window across releases
mixes different skill texts. The pass
counts stay the headline because they are what the run history compares.
The rule is tied to today's models: as per-case reliability rises the same
two lines get harder to miss, not easier, and the numbers in the run history
will say when they can be tightened. And if you find a way to phrase this
skill so that the suite passes 100 % three times in a row without making
the cases easier, I would be glad to see that pull request.

## Run history

Every series at a glance. The version opens that series' page — results,
per-case table and caveats as they were published, and the runner's own
per-run summaries where they still exist:

<!-- series:index -->

A series page is the page of its day: the suite had fewer cases, the series
rule exists only since 0.17.0, and the instrument is named only since
0.17.1.

### Every measurement, with its notes

One row per measurement, newest first — the series above with what stood
out in each, and the runs in between that were not a release series. The
judge has so far always been the same model as the agent under test.

| Date | Skill | Agent | Model | Result | Note |
|---|---|---|---|---|---|
| 2026-09-28 | [0.18.0](evals/0.18.0.md) | Claude Code 2.1.282 | Claude Sonnet 5 | **100/101 · 100/101 · 98/101** | three consecutive full runs on the `v0.18.0` tag, `--judge-always`, host linter fenced out; skill loaded 99/100/100 (a never-opted-in fixture and one retried session, no genuine miss), completed 101 each, deterministic checks 71/71/69 of 71, judge pass 100/100/100; median 13 / 12 / 13 turns per case; thirteen cases added since 0.17.1 (project discovery and families, `canonical`, entry ids, `See`, the 0.18.0 migration); 97 cases 3/3; series rule: all three lines missed — one case 1 of 3 (the skill named on a never-opted-in project), three failed cases in run 3, one guard in run 3 (a check coarser than its case); measured on the tag after the release and recorded as it came out |
| 2026-09-22 | [0.17.1](evals/0.17.1.md) | Claude Code 2.1.278 | Claude Sonnet 5 | **87/88 · 87/88 · 88/88** | three consecutive full runs on the `v0.17.1` tag the morning after the row below, `--judge-always`, host linter fenced out; skill loaded 87/86/86 (never-opted-in fixtures and one refusal retry, no genuine miss), completed 88 each, deterministic checks 57/58/58, judge pass 87/87/88; median 11.5 / 12 / 12 turns per case, the instrument as in the 0.16.x–0.17.0 series; series rule passed — 86 cases 3/3, two one-time flips, guards held; run 2 resumed after a runner crash at 50 cases |
| 2026-09-21 | [0.17.1](evals/0.17.1.md) | Claude Code 2.1.278 | Claude Sonnet 5 | **83/88 · 80/88 · 81/88** | three consecutive full runs on the `v0.17.1` tag, `--judge-always`, pipx fence in place; skill loaded 86/86/87 (never-opted-in fixtures, no genuine miss), completed 88 each, deterministic checks 58/58/58, judge pass 83/80/81; series rule: per-case gate failed (five cases below 2 of 3), run limit failed, guards passed; the instrument had changed — median 6 turns / 4 tool calls per case against 13 / 11 four days earlier on the same model id, a counter-run on CLI 2.1.274 gave 83/88 the same way; two failures were a broken host linter, fenced out since. Not a measurement of the three sentences that changed; re-measured the next morning, row above |
| 2026-09-17 | [0.17.0](evals/0.17.0.md) | Claude Code 2.1.274 | Claude Sonnet 5 | **87/88 · 88/88 · 87/88** | three consecutive full runs of the 0.17.0 wording as merged in #430, before the version bump (the tag differs in version strings only), `--judge-always`, pipx fence in place; skill loaded 88/88/85 (never-opted-in fixtures and one refusal-retried session, no genuine miss), completed 88 each, deterministic checks 58/58/57, judge pass 87/88/87; first series judged by the series rule (every case 2 of 3, at most one failed case per run): passed; 86 cases 3/3; step 5 of the skill is a decision table since this release and its 28 cases went 3/3 |
| 2026-09-14 | [0.16.3](evals/0.16.3.md) | Claude Code 2.1.268 | Claude Sonnet 5 | **87/88 · 86/88 · 86/88** | three consecutive full runs on the `v0.16.3` tag, `--judge-always`, pipx fence in place, no linter on the host; skill loaded 87/87/86 (never-opted-in fixtures only, no genuine miss), completed 88 each, deterministic checks 58/58 in every run, judge pass 87/86/86; 84 cases passed all three runs; judge and checks agreed on all 264 gradings; no safety refusal; one two-time flip (missing `context-schema` backfilled with the installed version, copied from the example block, #424), three one-time flips |
| 2026-09-11 | [0.16.2](evals/0.16.2.md) | Claude Code 2.1.268 | Claude Sonnet 5 | **86/88 · 86/88 · 86/88** | three consecutive full runs on the `v0.16.2` tag, `--judge-always`, pipx fence in place, no linter on the host; skill loaded 87/88/86 (the gaps are never-opted-in fixtures, no genuine miss), completed 88 each, deterministic checks 58/58 in every run, judge pass 86/86/86; all eight 0.16.1 one-time flips went 3/3, no safety refusal, judge and checks agreed on all 264 gradings; one two-time flip (every candidate listed before the first question under `sequential`, #414), four one-time flips |
| 2026-09-10 | [0.16.1](evals/0.16.1.md) | Claude Code 2.1.268 | Claude Sonnet 5 | **84/88 · 86/88 · 84/88** | three consecutive full runs on the `v0.16.1` tag, `--judge-always`, pipx fence in place, no linter on the host; skill loaded 88/87/88, completed 88 each, deterministic checks 55/58/57 of 58, judge pass 86/86/85; the three 0.16.0 issues (#354–#356) went 3/3 each, no safety refusal in the series, no genuine activation miss, one two-time flip (the one-line `Type`, caught by the check, passed by the judge), eight one-time flips |
| 2026-09-09 | [0.16.0](evals/0.16.0.md) | Claude Code 2.1.266 | Claude Sonnet 5 | **86/87 · 84/87 · 81/87** | three consecutive full runs on the `v0.16.0` tag, `--judge-always`, pipx fence in place, no linter on the host; skill loaded 84/85/82, completed 87 each, deterministic checks 57/56/56 of 57, judge pass 86/84/81; two two-time flips (the one-at-a-time wizard answered with a list, the wrong feedback tracker), six one-time flips, three genuine activation misses in run 3 |
| 2026-09-08 | [0.15.0](evals/0.15.0.md) | Claude Code 2.1.263 | Claude Sonnet 5 | **83/87 · 83/87 · 82/87** | three consecutive full runs on the `v0.15.0` tag, `--judge-always`, pipx fence in place, no linter on the host; skill loaded 85/86/85, completed 87 each, deterministic checks 55/56/57 of 57, judge pass 84/83/82; the new one-list wizard default cost three presentation flips (two merged messages, one question-at-a-time), all with a clean tree |
| 2026-09-08 | 0.14.1 | Claude Code 2.1.263 | Claude Sonnet 5 | 84/87 | one full run on the `v0.14.1` tag, `--judge-always`, with the pipx fence (#325) in place and no linter on the host — skill loaded 85, completed 87, deterministic checks 57/57, judge pass 84; the three cases the release was cut for (#324) went 3/3 (9, 9, 10); the three failures were known one-time flips from the 0.14.0 series. Runs 2 and 3 were stopped at 65 of 87 cases (63 passed) when 0.15.0 was decided the same afternoon — that release gets the three-run measurement, so this row is one run, not a series |
| 2026-09-08 | [0.14.0](evals/0.14.0.md) | Claude Code 2.1.263 | Claude Sonnet 5 | **83/87 · 84/87 · 84/87** | three consecutive full runs on the `v0.14.0` tag, `--judge-always`; skill loaded 84/85/84, completed 87 each, deterministic checks 56/57/56 of 57, judge pass 83/84/84; two cases added for `local-lint`, and with the setting's default `ask`, 19/19/25 sessions per run linted their own write |
| 2026-09-07 | [0.13.3](evals/0.13.3.md) | Claude Code 2.1.263 | Claude Sonnet 5 | **82/85 · 79/85 · 81/85** | three consecutive full runs on the `v0.13.3` tag, `--judge-always`; skill loaded 82/80/84, completed 85 each, deterministic checks 54/54/53 of 55, judge pass 82/80/82; the two cases the release was cut for went 3/3 |
| 2026-09-07 | [0.13.2](evals/0.13.2.md) | Claude Code 2.1.263 | Claude Sonnet 5 | **81/85 · 83/85 · 77/85** | three consecutive full runs on the `v0.13.2` tag, `--judge-always`; skill loaded 82/81/83, completed 85 each, deterministic checks 53/54/53 of 55, judge pass 82/83/78; eight cases added since 0.12.0 (`pending-confirmation`, session mode, the index letter skeleton, the config-`id` escape) |
| 2026-09-06 | [0.12.0](evals/0.12.0.md) | Claude Code 2.1.261 | Claude Sonnet 5 | **73/77 · 74/77 · 74/77** | three consecutive full runs on the `v0.12.0` tag, `--judge-always`; skill loaded 75/75/74, completed 77 each, deterministic checks 44/44/46 of 47, judge pass 75/76/74 |
| 2026-09-05 | [0.11.0](evals/0.11.0.md) + the `personal-defaults` pointer | Claude Code 2.1.259 | Claude Sonnet 5 | 74/77 | first full run with deterministic checks and `--judge-always`; found the one-line `Type` judge blind spot and two agents treating a retrospective request as pre-authorization on a `confirm-always` project — the reason rule 8 gained its sentence in 0.12.0; one check was too strict (`context-schema` backfill) and was relaxed |
| 2026-09-03 | [0.11.0](evals/0.11.0.md) | Claude Code 2.1.258 / 2.1.259 | Claude Sonnet 5 | **73/73 · 72/74 · 71/74 · 73/74** | first run before case 74 existed; then three consecutive full runs on a clean host. Suite changed afterwards: `init: declined` retired (its two cases replaced/removed), `autostart-project-instruction-loads-skill` added |
| 2026-09-02 | 0.10.1 + compressed `SKILL.md` | Claude Code 2.1.258 | Claude Sonnet 5 | 62/73, 61/73 | the compression moved nothing — 64/72 before it; what was done about the eleven failures is on the [0.11.0 page](evals/0.11.0.md#how-the-suite-got-from-62-to-73) |
| 2026-08-31 | 0.9.2 + config relocation | Claude Code 2.1.251 | Claude Sonnet 5 | 64/72 | regression check for `.keep-the-why`, written up on the [0.9.0 page](evals/0.9.0.md#config-relocation-regression-check-2026-08-31) |
| 2026-08-25 | [0.9.0](evals/0.9.0.md) | Claude Code 2.1.241 | Claude Sonnet 5 | 56/70 | no start path in the fixture yet; 11 of 14 failures were the skill never being loaded — re-run with a project-scoped `SessionStart` hook ([`references/autostart.md`](https://keepthewhy.com/autostart/)): 10/10 of those loaded, 9/10 passed. Every run since carries that hook in the `_base` fixture |
| 2026-07-31 | [0.6.2](evals/0.6.2.md) | Claude Code | Claude Sonnet 5 | 59/67 | first full run |

## Caveats, stated plainly

What holds for every series. What was true of one series — its flips, its
refusals, its environment — is on that series' page, as it was stated then.

- **Three runs per case, and that is still a small sample.** Expect a flip
  or two on any given full run. "How a series is judged" above says how a
  series is read; each series page names its flips with the judge's reason,
  and `tools/evals/history.json` keeps the per-case record across series. A
  case that failed once is variance until it comes back.
- **The judge lets "recognizes but doesn't act" through.** A judge `pass`
  on a transcript in which the agent said the right thing and did not do
  it: twice in run 3 of the 0.18.0 series, in earlier series twice at most
  and often not at all — each series page counts them. The
  deterministic checks exist for that shape; 71 of 101 cases carry them, and
  only where the check follows with certainty from the expected behavior.
- **The instrument moves under the same model id.** A model alias, and the
  model behind an exact id, can behave differently from one week to the
  next without anything in this repository changing; the
  [0.17.1 series](evals/0.17.1.md) is the measured example. Every run now
  records what it can — model ids, CLI version, judge prompt hash, median
  turns and tool calls — and two series are compared only when those agree.
  A pass count without them is a number without a ruler.
- **The judge is an LLM from the same vendor as the agent under test.**
  Verdicts must cite concrete transcript/diff evidence; an independent judge
  would still be stronger. The deterministic checks above take the
  mechanically decidable part of 71 cases away from it entirely. A claim in
  a verdict's reasoning is not automatically grounded in what the judge was
  shown — check the raw transcript before repeating one.
- **Claude Code + Claude Sonnet 5 only.** Cross-agent/cross-model checks live
  on the [agent & model matrix](https://keepthewhy.com/agent-matrix/) — one
  case, `chestertons-fence-guard`, per combination.
- **Platform noise is filtered, not hidden.** `trust-model-hidden-unicode-instructions`
  (a directive hidden in zero-width characters) is sometimes refused outright
  by the model's own safety layer ([#178](https://github.com/oliver-zehentleitner/keep-the-why/issues/178)) —
  in some series not once, in others several times in a row, and now and
  then `trust-model-base64-payload-in-source-material` with it; each series
  page says how often. The runner records that as an `error`, not a verdict,
  and `--retry-until-complete` re-runs it — same for a session-limit reset
  or an expired login mid-run. Published numbers are from runs that ended
  with zero errors after those retries.
- **An earlier series is not this suite.** The pages behind the run history
  are kept as published: fewer cases, other wording, no series rule before
  0.17.0, an unnamed instrument before 0.17.1. A pass count from one of
  them compares with today's only as far as those agree.

## Reproducing

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git
cd keep-the-why
python3 tools/evals/run.py --all --retry-until-complete
```

Requires the Claude Code CLI with working credentials; see
[`tools/evals/README.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/tools/evals/README.md)
for how fixtures, the agent adapter, and the judge work. The per-case JSON a
run writes to `tools/evals/results/` carries the full transcript, the disk
diff and the judge's reasoning, and is not committed (the directory is
ignored). What is committed of a release series is its page,
`docs/evals/<version>.md`, and beside it under `docs/evals/runs/<version>/`
the `summary.md` the runner wrote for each run.
