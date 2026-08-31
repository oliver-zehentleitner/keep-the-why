# Evals

The skill ships 72 eval cases (`tools/evals/evals.json`): a
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
all. This is the same activation limitation already documented in
["Composition with other
skills"](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/skills/keep-the-why/SKILL.md)
and tracked in [issue #138](https://github.com/oliver-zehentleitner/keep-the-why/issues/138)
— a Skill activates when the conversation matches its description, and
nothing guarantees that for a low-signal prompt; none of these 70 runs had a
`SessionStart` hook or any other activation aid configured, so this is the
plain, unmitigated version of that gap, not evidence about hooks one way or
the other. Some of the 11 did nothing skill-related at all
(`init-declined-not-reasked`,
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

## Activation-gap follow-up: a real SessionStart hook, tested

**Not a new full-suite run — a targeted re-test of the 11 activation-gap
failures above, done the same day (2026-08-25).** One of those 11
(`init-declined-not-reasked`) starts from an empty project with no
`AGENTS.md` at all, so there's no `keep-the-why:config` marker for a hook to
find — out of scope for this by construction. The other 10 were re-run
against the same fixtures plus one change: a project-scoped `SessionStart`
hook, checked into `tools/evals/fixtures/_base/.claude/settings.json` (not
the machine-level one a developer might have personally) — it greps
`AGENTS.md` for the `keep-the-why:config` marker and, if found, injects
"Load the keep-the-why skill now, before other work" as `additionalContext`
before the first turn.

**Result: 10/10 now invoke the Skill tool (was 0/10). 9/10 pass outright.**
The one holdout, `update-check-cannot-run-surfaced-once`, turned out to be
an unrelated fixture bug, not a skill or hook problem: its "simulate no web
access" setup denies `WebFetch`/`WebSearch` but not `Bash`, so the agent
reached the real GitHub API with `curl` and the simulated failure never
actually happened — the same bug affected `update-check-repeat-failure-no-reask`,
which had happened to still pass by coincidence (a real successful check is
also valid output for that case's expected behavior). Fixed both fixtures'
`case.json` to also deny `Bash(curl *)`/`Bash(wget *)`; re-run, both pass
cleanly for the right reason this time (curl denied, agent reports the
failure and asks/retries-quietly as expected). **Final: 10/10 pass.**

This hook is now the `_base` fixture's default, so every future full run
includes it — the 56/70 above remains the last true baseline *without* one.
The next full `--all` run (not done today) is what turns this from "10 of 11
formerly-failing cases, re-run in isolation" into a real before/after on the
whole suite. Writeup and the reusable hook snippet: `docs/autostart.md`
(planned, not published yet).

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
- **Correction, added after publishing this page:** the first version of this
  section claimed the activation-gap failures happened "despite an explicit
  `SessionStart` hook" telling the agent to load the skill. That was wrong —
  none of these fixtures configure any hook (the runner deliberately excludes
  user-level settings via `--setting-sources project,local`, and no fixture
  defines a project-level one), confirmed by grepping every raw transcript
  for hook-related content and finding none. The judge's `reasoning` field
  invented that detail — quoting a specific, plausible-sounding hook message
  — in 6 of the 14 failing cases, none of which actually appears anywhere in
  the real transcript it was grading. Since the judge is an LLM grading
  against a rubric, not a program checking assertions, a claim in its
  `reasoning` isn't automatically grounded in what it was shown; this is a
  concrete instance of that, found by cross-checking one specific claim
  against the raw transcript field rather than trusting the prose. Worth
  remembering when reading any verdict's reasoning text here or in the raw
  results.

## Reproducing

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git
cd keep-the-why
python3 tools/evals/run.py --all
```

Requires the Claude Code CLI with working credentials; see
[`tools/evals/README.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/tools/evals/README.md)
for how fixtures, the agent adapter, and the judge work.
