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
   skill package is copied into the driver's install path (see "Drivers"
   below) the way a real project-scoped install would place it.
2. **Run the agent.** The case prompt runs non-interactively in that project
   via whichever CLI `--driver` selects, with the full transcript (including
   tool calls) captured, plus the resulting working-tree diff — what the
   agent actually wrote matters as much as what it said.
3. **Judge.** A second, independent Claude call (always Claude, regardless of
   `--driver`, so grading criteria stay constant) grades transcript + diff
   against the case's `expected_behavior` and returns a structured verdict
   (`pass`/`fail`, score, reasoning, violations). Because the session is
   non-interactive, ending the turn with a question counts as fully correct
   wherever the expected behavior involves asking the user something.

Results land in `results/<timestamp>-<driver>/` (gitignored): one JSON per
case plus `summary.json` and `summary.md`.

## Drivers

`--driver` selects which agentic coding CLI runs the skill under test:

| Driver | CLI | Skill discovery |
|---|---|---|
| `claude` (default) | [Claude Code](https://claude.com/claude-code) (`claude`) | Native — installed at `.claude/skills/keep-the-why`, the CLI decides for itself from the `SKILL.md` description whether to load it. This is what the activation-reliability cases actually test. |
| `cline` | [Cline](https://cline.bot) (`cline`) | Explicit — see below |
| `codex` | [Codex CLI](https://github.com/openai/codex) (`codex`) | Explicit — see below |
| `kimi` | [Kimi Code](https://github.com/MoonshotAI/kimi-code) (`kimi`) | Explicit — see below |
| `opencode` | [opencode](https://opencode.ai) (`opencode`) | Explicit — see below |
| `pi` | [Pi](https://pi.dev) (`pi`) | Explicit — see below |

`cline`, `codex`, `kimi`, `opencode`, and `pi` don't get native-discovery
treatment: whether they'd find the skill on their own is a Claude-Code-specific
question, already covered by the `claude` driver's activation cases. Instead
the skill is installed at a plain `skills/keep-the-why/` path and the case
prompt is prefixed with an explicit instruction to read its `SKILL.md` and
follow it. This is what makes any tool-use-capable CLI usable here without
needing its own skill-discovery convention, and what lets `--model` point at a
model that has no notion of "skills" at all (a local Ollama model, or any
model via OpenRouter). What's under test with these drivers is
instruction-following given the skill, not discovery.

**Verification status:** all five non-`claude` drivers have been run
end-to-end against real installs (local Ollama and/or OpenRouter) and their
results published to [the agent & model
matrix](https://keepthewhy.com/agent-matrix/). Two real bugs were only found
this way, not from the docs: `opencode` didn't treat the fixture directory as
its project root without an explicit `--dir` flag (it silently operated on
this repo's real working directory instead), and `codex exec`'s default
sandbox/approval mode denied every write attempt with no one to approve it in
a non-interactive session, making every case look like "correctly didn't
touch the file" when it had structurally been unable to — both fixed, see
`CHANGELOG.md`. Re-check `render_transcript_*` against a fresh raw transcript
if a driver's CLI version changes noticeably.

## Usage

```bash
# everything (70 cases; expect a long run and real API usage)
python3 tools/evals/run.py --all

# a subset
python3 tools/evals/run.py --cases continuous-capture-basic,chestertons-fence-guard

# knobs
python3 tools/evals/run.py --all --parallel 4 --model sonnet --judge-model sonnet

# a different driver — model syntax is driver-specific
python3 tools/evals/run.py --all --driver pi --model ollama/qwen3.8:27b --parallel 1
python3 tools/evals/run.py --all --driver opencode --model openrouter/qwen/qwen3.8-27b
python3 tools/evals/run.py --all --driver cline --model openrouter/moonshotai/kimi-k3
python3 tools/evals/run.py --all --driver codex --model openrouter/x-ai/grok-4.6
python3 tools/evals/run.py --all --driver kimi --model openrouter/z-ai/glm-5.3
```

Requires the selected driver's CLI on `PATH` with working credentials/model
config: for `pi`, a local Ollama or OpenRouter model needs a matching entry in
`~/.pi/agent/models.json`; for `opencode`, in `opencode.json`; for `kimi`, via
`kimi provider`; for `cline`, via `cline auth`; for `codex`, a
`[model_providers.<id>]` block in `~/.codex/config.toml`. Exit code is
non-zero if any case fails or errors.

## Matrix runs

`--matrix` runs every driver × model combination in
[`matrix-config.json`](matrix-config.json) (or an override) instead of a
single `--driver`/`--model` run — this is what produces the results on the
[agent & model matrix](https://keepthewhy.com/agent-matrix/):

```bash
# the full standard matrix (5 drivers x 8 models = 40 combinations)
python3 tools/evals/run.py --cases chestertons-fence-guard --matrix

# a subset, and how many combinations run at once
python3 tools/evals/run.py --cases chestertons-fence-guard --matrix \
  --matrix-drivers pi,cline --matrix-models openrouter/qwen/qwen3.8-27b,openrouter/z-ai/glm-5.3 \
  --matrix-parallel 2
```

Each combination is an ordinary run under the hood (same `execute_pass`, same
per-case resumability), just many of them at once — a re-run against the same
`--results-dir` only retries combinations that didn't fully resolve last
time, same as re-running a single-driver command. Prints and saves a
ready-to-paste `docs/agent-matrix.md`-style table
(`<results-dir>/matrix-summary.md` and `.json`) — that page's prose sections
are hand-curated and this doesn't touch them, so pasting rows in is still a
manual step. Exit code is non-zero if anything failed or didn't resolve,
which is what makes this safe to run unattended (e.g. a scheduled GitHub
Actions job) — env-var credentials only, no interactive confirmation
anywhere in the chain.

Growing the matrix (a new model, a new driver once it's been verified
end-to-end like the others) is a one-line edit to `matrix-config.json`, not a
code change.

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

This section applies to the `claude` driver only — the detection is a match
against Claude Code's own plain-text limit message, so it simply won't fire
for `pi`/`opencode` runs.

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

## Ongoing status

What's currently being improved, what's working, what isn't yet, and how to help (including running this suite against an agent other than Claude Code): [issue #131](https://github.com/oliver-zehentleitner/keep-the-why/issues/131), kept current as a living status page.

## Known limitations

- One run per case per driver — no flakiness statistics yet. Tracked as an
  idea in the issue tracker.
- Non-interactive: multi-turn flows (a full wizard dialogue, a confirmation
  answered with "yes") can only be tested up to the agent's first stopping
  point.
- The judge is always Claude, including when the agent under test is a
  different vendor's model via `pi`/`opencode` — consistent grading, but not
  an independent judge in the fullest sense.
