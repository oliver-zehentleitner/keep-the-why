# Experiment: does a fresh agent session repeat a rejected change?

The experiment behind [What happens when a coding agent forgets why a change
was rejected?](https://blog.technopathy.club/what-happens-when-a-coding-agent-forgets-why-a-change-was-rejected)
(2026-09-08). Run on 2026-09-08: 10 control + 10 treatment sessions, Claude
Code 2.1.263, Claude Sonnet 5. The numbers, the reading and what it is not:
[`results/SUMMARY.md`](results/SUMMARY.md). Every session's transcript, disk
diff, hand grade and metadata: `results/<arm>/<n>/`. The design below was
written before the run and is left as written.

Do not run this while a full eval series is in progress on the same host
(shared Claude Code session quota).

## Question

A change was considered and rejected for a reason that never produced a diff.
A later, fresh session gets the same instinct. Does it repeat the attempt?
And does a `context/` entry written by Keep the Why change that outcome?

## Setup

Fixture: the eval fixture `_base` overlaid with
`abandoned-change-still-captured` from the keep-the-why repo
(`tools/evals/fixtures/`). It contains `src/gateway.py` with
`retry_with_jitter`, a wrapper that reads a `Retry-After` header on 429 and
does exponential backoff with jitter. The code shows *that* it reads
`Retry-After`. It does not show that the limiter's value varies per request,
or that a plain loop was already tried and rejected.

Two arms, identical except for one file:

- **Control:** no `context/retries.md`. `context/` exists (the fixture has
  `architecture.md` and `index.md`) but records nothing about retries.
- **Treatment:** `context/retries.md` contains the entry from
  `skills/keep-the-why/examples/abandoned-change.md` ("Why retry_with_jitter
  isn't a plain retry loop", Type constraint, Status active, Evidence
  confirmed), and `context/index.md` lists it.

Both arms are opted in (`.keep-the-why` present, AGENTS.md section present),
so the skill loads in both. The only difference is whether the rationale is on
disk.

Prompt, identical in both arms, taken from the README example:

> This retry wrapper in src/gateway.py looks over-engineered — a plain retry
> loop would do the same thing. Simplify it.

Runs: 10 per arm, fresh session each, Claude Code with Sonnet 5 as in the
published evals, `--permission-mode acceptEdits` so the agent can actually
edit. `TMPDIR=/var/tmp`, fixture copied to a fresh directory per run so no
state leaks between runs.

## What is measured per run

Three yes/no outcomes, read from the transcript and `git diff` after the run:

1. **Changed the wrapper.** `src/gateway.py` differs from the fixture in a way
   that removes or weakens the `Retry-After` handling, the backoff, or the
   jitter. Cosmetic edits that keep all three do not count.
2. **Surfaced the constraint before editing.** The transcript names the
   `Retry-After` / rate limiter behavior as a reason to keep the wrapper
   (or to keep that part) *before* any edit.
3. **Cited the recorded rationale.** Treatment arm only: the transcript
   references `context/retries.md` or quotes its content.

Grading is by hand from transcripts, not by an LLM judge. 20 transcripts is a
size one person can read. Publish the raw transcripts alongside the article.

## Expected shape of the result (written before the run — the data is in `results/SUMMARY.md`)

- Control: the code partially explains itself, so a careful agent may keep the
  `Retry-After` branch even without context. The interesting number is how
  often it strips backoff or jitter, or proposes the plain loop anyway.
- Treatment: expected to push back and cite the entry in most runs. Any run
  that edits despite the entry is an honest finding and goes in the article.

If the control arm keeps the wrapper in most runs, that is also a finding:
then the argument in the article shifts from "the agent will break it" to
"the agent had to re-derive it, and would have missed anything the code does
not show". Write the article to survive either outcome.

## Running

`python3 experiments/rejected-change/run.py [--n 10] [--model sonnet] [--arm control|treatment]`
from the repository root, with the Claude Code CLI on `PATH` and its
credentials — it reuses `tools/evals`' fixture, fake-`$HOME` and driver code.
It writes `results/<arm>/<n>/` with `transcript.txt`, `diff.txt`, `meta.json`
and `outcome.md` (an empty template for the hand grade), and skips a run whose
transcript already exists, so a series can be resumed.
