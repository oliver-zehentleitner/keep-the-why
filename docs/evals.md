# Evals

The skill ships 70 eval cases (`skills/keep-the-why/evals/evals.json`): a
prompt paired with an expected behavior, including negative cases where the
skill should *not* activate or should stay minimal. A local runner in
[`tools/evals/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/tools/evals)
executes them for real: each case gets a materialized fixture project with the
skill installed, a fresh non-interactive Claude Code session runs the prompt,
and an LLM judge grades the transcript plus the actual file changes against
the expected behavior.

## Latest full-suite results

**Stale as of this writing — a superseded snapshot, not the current state.**
The numbers below (59/67, skill 0.6.2) predate two rounds of `SKILL.md`
changes made since (a Core Rules tightening pass, then a fix for a
"recognizes the right action but asks/defers instead of doing it" pattern the
first full run surfaced — both verified against individual affected cases,
neither against a fresh full 67-case run). A new full run is planned as part
of the next release cycle; **for the current picture in the meantime, see the
living status issue: [oliver-zehentleitner/keep-the-why#131](https://github.com/oliver-zehentleitner/keep-the-why/issues/131).**
This page gets replaced with fresh numbers once that run completes — kept
here, unedited otherwise, so the methodology and the shape of the analysis
stay visible rather than disappearing while stale.

**59 of 67 passed** — run 2026-07-31, skill 0.6.2, Claude Code CLI 2.1.220,
agent and judge both Claude Sonnet 5 (`claude-sonnet-5`). No errors; every
case produced a graded verdict.

The 8 failures cluster into two honest categories, and both are more useful
than a polished 67/67 would be:

**1. Activation gaps (5 cases).** In all five, the skill was never invoked at
all: the session's user request was an ordinary small task (a quick question,
a one-line edit, an FYI remark), the model handled it directly, and the
skill's opportunistic behaviors — per-session timer checks, proactive capture,
re-checking after another workflow concludes — never ran because the skill
body never loaded. This is the same activation limitation already documented
in ["Composition with other
skills"](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/skills/keep-the-why/SKILL.md)
and `context/compatibility.md`: a Skill activates when the conversation
matches its description, and nothing guarantees that for low-signal prompts.
The evals now put a number on it instead of a caveat.

**2. Judgment misses with the skill active (3 cases).** The skill loaded,
followed its workflow — and still got the judgment call wrong:

- `negative-conflicting-sources` (failed in both runs we did): code said
  3 retries, the architecture doc said 5; instead of recording both and
  flagging the conflict as unresolved, the agent declared the code
  authoritative and rewrote the doc.
- `context-schema-missing-backfilled`: asked the user about a missing field
  that the documented rule says to backfill silently — over-asking is the
  milder failure direction, but still a miss.
- `ambiguous-worth-capturing-asks-instead-of-guessing`: the deliberately
  borderline case; the agent wrote an entry directly instead of asking the
  cheap yes/no question first. In an earlier run it failed in the opposite
  direction — genuinely on the line, which is what the case is for.

## Caveats, stated plainly

- One run per case: single-run verdicts are subject to normal model variance
  (one borderline case demonstrably flips between runs). No flakiness
  statistics yet.
- The judge is an LLM from the same vendor as the agent under test. Verdicts
  were designed to require citing concrete transcript/diff evidence, but an
  independent judge would be stronger.
- One agent, one model. Results for Codex CLI, Gemini CLI, and other
  Agent-Skills-capable tools don't exist yet — running the suite against
  another agent and publishing the outcome is exactly the contribution
  [`CONTRIBUTING.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/CONTRIBUTING.md)
  asks for.

## Reproducing

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git
cd keep-the-why
python3 tools/evals/run.py --all
```

Requires the Claude Code CLI with working credentials; see
[`tools/evals/README.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/tools/evals/README.md)
for how fixtures, the agent adapter, and the judge work.
