# Eval runner

Runs the skill's eval cases (`skills/keep-the-why/evals/evals.json`) against a
real agent and grades the results. This is a development tool for this
repository — deliberately **not** part of the installable skill package, which
ships instructions only, no executable code.

## How it works

For each case:

1. **Materialize a throwaway project.** A temp directory gets the shared
   `fixtures/_base/` project (a small order-processing service with Keep the
   Why already set up), overlaid with the case's own `fixtures/<case-id>/`
   directory if one exists. The result is `git init`ed and committed, and the
   skill package is copied into `.claude/skills/keep-the-why` the way a real
   project-scoped install would place it.
2. **Run the agent.** `claude -p "<case prompt>"` runs non-interactively in
   that project, with the full transcript (including tool calls) captured via
   `--output-format stream-json`, plus the resulting working-tree diff — what
   the agent actually wrote matters as much as what it said.
3. **Judge.** A second, independent `claude -p` call grades transcript + diff
   against the case's `expected_behavior` and returns a structured verdict
   (`pass`/`fail`, score, reasoning, violations). Because the session is
   non-interactive, ending the turn with a question counts as fully correct
   wherever the expected behavior involves asking the user something.

Results land in `results/<timestamp>/` (gitignored): one JSON per case plus
`summary.json` and `summary.md`.

## Usage

```bash
# everything (67 cases; expect a long run and real API usage)
python3 tools/evals/run.py --all

# a subset
python3 tools/evals/run.py --cases continuous-capture-basic,chestertons-fence-guard

# knobs
python3 tools/evals/run.py --all --parallel 4 --model sonnet --judge-model sonnet
```

Requires the [Claude Code CLI](https://claude.com/claude-code) (`claude`) on
`PATH` with working credentials. Exit code is non-zero if any case fails or
errors.

## Fixtures

- `fixtures/_base/` — the default project every case starts from: completed
  Keep the Why setup (`AGENTS.md` config block at the current schema,
  `AGENTS.local.md` personal block with timers off), a small `context/`, and a
  few source files. Setup is deliberately complete so cases test the behavior
  under test, not the init wizard — wizard cases override this.
- `fixtures/<case-id>/` — files overlaid on top of `_base` for that case
  (e.g. a different `AGENTS.md` with an invalid setting, a `context/` entry
  containing an injection attempt, source code with the oddity the prompt
  refers to).
- `fixtures/<case-id>/case.json` — optional per-case config:
  - `"base": "none"` — start from an empty directory instead of `_base`
    (first-activation/wizard cases)
  - `"remove": [paths]` — delete paths after overlay (e.g. drop
    `AGENTS.local.md` to simulate a new developer)
  - `"commits": [{"message", "files", "author", "date"}]` — extra commits
    after the initial one, for cases where git history is part of the
    evidence (legacy analysis, injection in a commit message)
  - `"disallowed_tools": [names]` — passed to `--disallowedTools` (e.g. deny
    `WebFetch`/`WebSearch` to simulate a session without web access)

Six cases intentionally have no fixture directory and run on `_base` as-is;
their prompts carry the whole scenario.

## Resilience to the account's own session/spend limits

`run.py` shells out to `claude -p` under your own logged-in account, so a
large run can hit that account's session or monthly spend limit mid-run —
this shows up as a normal, successful CLI response whose text just says so
(e.g. "You've hit your session limit · resets ..."), not as an error exit
code, so it has to be detected by content.

When that happens: the runner marks the case `rate_limited` (no judge call
wasted grading a limit message), and every other case still queued in that
pass is skipped immediately without touching the API. Re-running the exact
same command against the same `--results-dir` is always safe and cheap:
any case with a stored `pass`/`fail` verdict is skipped outright, so only
what's still unresolved gets attempted again. A stored `pass`/`fail` whose
transcript turns out to actually be a limit message (e.g. from a run
predating this check) is treated as unresolved too, not trusted.

For a run that should survive account limits unattended, add
`--retry-until-complete` (sleeps `--retry-interval` seconds, default 600,
and retries only the unresolved cases, up to `--max-wait-hours`, default
10) instead of babysitting it.

## Interpreting results

The judge is an LLM: treat a `fail` as a lead to read, not a verdict to
trust blindly — open the case's JSON in `results/<timestamp>/` and read the
transcript and reasoning before acting on it. Single runs are also subject to
normal model variance; re-run a surprising case before concluding anything.

## Known limitations

- One agent (Claude Code) and one run per case — no cross-agent matrix, no
  flakiness statistics. Both are tracked as ideas in the issue tracker.
- Non-interactive: multi-turn flows (a full wizard dialogue, a confirmation
  answered with "yes") can only be tested up to the agent's first stopping
  point.
- The judge shares a vendor with the agent under test; an independent judge
  would be stronger.
