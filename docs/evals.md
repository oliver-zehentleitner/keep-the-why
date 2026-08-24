# Evals

The skill ships 70 eval cases (`tools/evals/evals.json`): a
prompt paired with an expected behavior, including negative cases where the
skill should *not* activate or should stay minimal. A local runner in
[`tools/evals/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/tools/evals)
executes them for real: each case gets a materialized fixture project with the
skill installed, a fresh non-interactive Claude Code session runs the prompt,
and an LLM judge grades the transcript plus the actual file changes against
the expected behavior.

## Latest full-suite results

**56 of 70 passed** — run 2026-08-25, skill 0.9.0, Claude Code CLI 2.1.241,
agent and judge both Claude Sonnet 5 (`claude-sonnet-5`). No errors; every
case produced a graded verdict. Previous full run: 59/67, skill 0.6.2,
2026-07-31.

One clear improvement first: `negative-conflicting-sources` — the case that
had failed in both prior runs (code said 3 retries, the architecture doc said
5; the agent needs to record both and flag the conflict rather than declaring
one authoritative) — now passes cleanly.

The 14 failures cluster into two categories, and the split between them
shifted a lot since the last run:

**1. Activation gaps (11 of 14 failures).** In every one of these, the Skill
tool itself was never invoked — no `[tool call] Skill` in the transcript at
all — even though every affected fixture's `SessionStart` hook explicitly
instructed loading the skill before other work. This is the same activation
limitation already documented in ["Composition with other
skills"](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/skills/keep-the-why/SKILL.md)
and tracked in [issue #138](https://github.com/oliver-zehentleitner/keep-the-why/issues/138)
— a Skill activates when the conversation matches its description, and
nothing guarantees that for a low-signal prompt. What's new this run: the
hook instruction alone isn't sufficient either. Some of the 11 did nothing
skill-related at all (`init-declined-not-reasked`,
`update-check-cannot-run-surfaced-once`, `update-check-repeat-failure-no-reask`,
`source-reference-never-does-not-ask`,
`recheck-after-other-skill-concludes-mid-conversation`) — the model just
answered the prompt directly or asked an unrelated generic question. Others
read `AGENTS.md`/`context/` directly and approximated the right behavior
without ever running the formal workflow (`context-schema-missing-backfilled`,
`significant-correction-is-not-a-decision`,
`capture-mode-proactive-with-confirm-always`,
`confirm-always-clear-case-still-asks-permission`,
`agents-local-gitignore-not-covered`,
`ambiguous-worth-capturing-asks-instead-of-guessing`) — closer, but each still
missed at least one documented step (a `.gitignore` entry, a deterministic
backfill rule, a `confirm-always` permission gate, a `CHANGELOG.md` entry).

**2. Recognizes but doesn't act (3 cases).** The skill loaded, correctly
identified what needed to be written — then asked or deferred instead of
writing it. This is the pattern already flagged as still-open in
[issue #131](https://github.com/oliver-zehentleitner/keep-the-why/issues/131)
("a first fix helped but didn't eliminate the pattern; a follow-up attempt
made one case worse instead of better") — this run reconfirms it, not with
one case but with all three skill-active failures:

- `capture-confirmation-automatic-unclear-evidence`: config sets
  `capture-confirmation: automatic`; the agent asked whether the constant was
  picked for a specific reason instead of writing the entry with an honest
  `Evidence: unknown`/`inferred`, as the rule requires.
- `embedded-procedure-not-why-content`: correctly found both right
  destinations (`context/` for the limitation, `CONTRIBUTING.md` for the
  workaround procedure) but wrote neither, ending the turn on an unrelated
  question about rejected alternatives instead.
- `open-question-gets-status-open-not-unknown`: correctly found the
  undocumented branch and correctly avoided inventing a rationale for it, but
  asked the user whether to write it up instead of recording
  `Status: open` / `Evidence: unknown` itself, as the case calls for.

## Caveats, stated plainly

- One run per case: single-run verdicts are subject to normal model variance.
  `ambiguous-worth-capturing-asks-instead-of-guessing` is a demonstrated case
  of this — it has now failed in both directions across different runs
  (over-eager write, then silent skip), which is exactly the borderline
  behavior it's designed to probe. No flakiness statistics yet.
- The judge is an LLM from the same vendor as the agent under test. Verdicts
  were designed to require citing concrete transcript/diff evidence, but an
  independent judge would be stronger.
- This page covers Claude Code + Claude Sonnet 5 only, one run per case.
  Cross-agent/cross-model spot checks (Cline, Codex CLI, Kimi Code, opencode,
  Pi, each against up to 9 models) live separately on the
  [agent & model matrix](https://keepthewhy.com/agent-matrix/) — one case per
  combination there, not this full 70-case suite.
- A full `--all` run can take much longer in wall-clock time than its actual
  compute would suggest if it hits the account's own session/spend limit
  mid-run — this run took about 6 hours end-to-end, the large majority of it
  spent asleep between retries on 4 rate-limited cases, not doing work. See
  `tools/evals/README.md`'s "Resilience to the account's own session/spend
  limits" section.
- This run's checkout predates the 0.9.1/0.9.2 releases by a few commits.
  Diffed against current `main`: both releases changed only tooling (new eval
  drivers, a runner bug fix for a driver-error-masking edge case that doesn't
  occur in any of these 70 transcripts — every one ends cleanly with
  `subtype=success`) and doc/version-number text, not `SKILL.md` or
  `references/` rule content. These numbers are the current behavioral
  picture even though they're labeled skill 0.9.0.

## Reproducing

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git
cd keep-the-why
python3 tools/evals/run.py --all
```

Requires the Claude Code CLI with working credentials; see
[`tools/evals/README.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/tools/evals/README.md)
for how fixtures, the agent adapter, and the judge work.
