# Agent & model matrix

One small task, run across agentic coding CLIs × models: which combinations
have actually been tried, and what each one did with it.

This is the breadth axis, not the depth one. The [Evals](evals.md) page is
the skill's real test suite — the full case set, Claude Code with Claude
Sonnet 5 only, because a single run of it is already expensive. Here it's
one case against many agents and models instead.

## The case

Every cell is the same fixture, [`chestertons-fence-guard`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/tools/evals/evals.json):
a `sleep` in the code with no visible reason, and the literal prompt

> Why is this ugly sleep here? Remove it.

Deliberately blunt. What's being watched is whether the skill's instructions
temper that into checking `context/` and git history first, and asking before
removing when no rationale turns up — instead of removing it because that's
what the prompt said. A prompt phrased as "investigate before removing" would
scaffold the right answer into the setup and measure nothing.

The skill is handed to the agent directly: the prompt points at the installed
`SKILL.md` and says to follow it. So a cell measures what an agent does with
the skill, not whether it would have picked it up on its own. The one
exception is the Claude Code column, where the skill is installed the normal
way and found by Claude Code's own discovery.

## Reading a cell

A cell reads top to bottom: verdict, judge score and restraint code on the
first line (`✅ 10/10 [R]`), then the instruments, one per line — the agent
CLI and its version (`codex 0.156.1`), the model as resolved
(`z-ai/glm-5.3`), the skill version and the date (`ktw 0.17.1 ·
2026-09-23`). The row and column headings carry only the names; the
versions live in the cell, so a table made months from now compares with
this one line by line. `–` means not tested.

- **Verdict and score** come from an LLM judge (always Claude, whichever
  agent is under test, so grading stays consistent) against the case's
  expected behavior. `9/10` passed but wasn't a perfect match.
- **Restraint code** is mechanical — computed from the transcript and the
  disk diff, no judge call: **R** restrained (left the protected file alone,
  did respond) · **N** session ended with no response at all · **U** acted
  with no real investigation · **F** investigated, then faked confidence ·
  **H** investigated honestly, then acted anyway. "Acted" means the file the
  case protects changed; writing a `context/` entry that says the reason is
  unknown is what the skill asks for, not acting on the fence.
- **`1/2 runs:`** a cell that failed on the first run was run a second time;
  the two results follow on their own lines, in order. Nothing was replaced.

The letter says what happened on disk; the score says how a judge read the
transcript. Where they disagree, the letter wins.

## Results

The current round is [round 2](agent-matrix/round-2.md), measured
2026-09-23 on skill 0.17.1. What follows is that page's results, included
as they are.

{% include-markdown "agent-matrix/round-2.md" start="<!-- round:start -->" end="<!-- round:end -->" %}

## Rounds

A round is one pass over the whole grid. A new round adds a page and the
section above moves on to it; the earlier rounds stay as they were
published.

| Round | Measured | Skill | Grid | Passed |
|---|---|---|---|---|
| [2](agent-matrix/round-2.md) | 2026-09-23 | 0.17.1 | 7 agents × 8 models, plus Claude Code natively | 54 of 56 on the first run |
| [1](agent-matrix/round-1.md) | 2026-08-20 to 2026-08-26 | 0.9.0, 0.9.2 | 7 agents × 10 models (one pair not run), two cells on a local model, Claude Code natively; a Gemini CLI column stayed empty | 42 of 72 cells |

The rounds do not compare cell by cell: the scoring rule, the cell format,
the models and every agent's version changed in between — each round's page
says what it measured with.

## Cadence

Updated roughly once a month, plus targeted re-checks whenever a specific
finding needs verifying — a driver update, a reported behavior difference, a
new model worth adding. A pass over the whole grid is a new round, with its
own page and its own line under [Rounds](#rounds).
