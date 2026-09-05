#!/usr/bin/env python3
"""Local eval runner for the keep-the-why skill.

For each case in tools/evals/evals.json:
  1. Materialize a throwaway git repo from tools/evals/fixtures/ (shared
     _base project, overlaid with the case's own fixture directory if one
     exists), and install the skill package into the driver's install path.
  2. Run a real, fresh agent session with the case's prompt in that repo
     (via whichever CLI --driver selects), capturing the full transcript and
     the resulting working-tree diff.
  3. Have a second, independent Claude call (the judge — always Claude,
     regardless of --driver, so grading criteria stay constant across
     drivers) grade transcript + diff against the case's expected_behavior
     and return a structured verdict.

This is a development tool for this repository. It is deliberately NOT part
of the installable skill package (skills/keep-the-why/), which ships
instructions only — no executable code.

## Drivers

--driver selects which agentic coding CLI runs the skill under test:
  claude    Claude Code (`claude`). Native skill discovery: the skill is
            installed at .claude/skills/keep-the-why and the CLI decides for
            itself, from the SKILL.md description, whether to load it — this
            is what the activation-reliability eval cases actually test.
  pi        Pi (`pi`, earendil-works/pi-mono). Any model pi's own
            ~/.pi/agent/models.json knows about, including a local Ollama
            model or OpenRouter via a custom provider baseUrl.
  opencode  opencode (`opencode`, SST).
  kimi      Kimi Code (`kimi`, moonshotai). Models configured via
            `kimi provider` (~/.kimi-code/config.toml).
  cline     Cline (`cline`, cline-bot). Provider/model configured via
            `cline auth` (~/.cline/data/settings/providers.json).
  codex     Codex CLI (`codex`, openai/codex). Provider/model configured via
            [model_providers.<id>] blocks in ~/.codex/config.toml.
  hermes    Hermes Agent (`hermes`, NousResearch). Any OpenRouter model via
            --model/--provider. MUST be invoked as `hermes chat`, never the
            bare `hermes-agent` binary installed alongside it — see
            run_agent_hermes for why (a real, verified isolation bug).
  omp       oh-my-pi (`omp`, can1357/oh-my-pi). A fork of pi (see the `pi`
            driver above) rewritten as a "coding agent with the IDE wired
            in" — 31 built-in tools (LSP, debugger, AST edits, browser, ...)
            vs. pi's 4, and a ~40k-token system prompt vs. pi's minimal one,
            so this is a genuinely different harness under the same model,
            not a version bump of the pi driver. Any OpenRouter model via
            --model, no per-model registration needed (same as hermes).
            `--mode json`'s event schema was verified, live, to be identical
            to pi's for every event type render_transcript_omp consumes
            (message_end / tool_execution_start / tool_execution_end,
            including the isError flag / agent_end) — expected, since omp is
            a fork, but confirmed rather than assumed. --no-skills disables
            omp's own skill auto-discovery so it can't shadow the
            fixture-local SKILL.md with an unrelated global install (this
            host has one at ~/.pi/agent/skills/keep-the-why for the pi
            driver) — the same class of bug noted for pi/opencode below,
            headed off here before it could bite.

pi, opencode, kimi, cline, codex, omp, and hermes are handed the skill
explicitly instead: it's installed at a plain skills/keep-the-why/ path and
the case prompt is prefixed with an instruction to read that exact relative
SKILL.md and follow it.

Skill autoload is deliberately out of scope. There's no standardized
discovery mechanism across agents — ensuring the skill gets loaded is the
agent's job (the position references/autostart.md takes) — so grading each
vendor's loader here would only put a second, unrelated variable in front of
the behavior under test. Handing the skill over directly is also what lets
--model point at a model with no notion of "skills" at all (a local Ollama
model, or any model via OpenRouter), which is what every non-claude cell
actually runs on. What's under test with these drivers is the agent's harness
and context handling given the skill.

Verified live: on a machine that also has a global
keep-the-why install (e.g. this one, via Claude Code's own skill), both pi
and opencode initially resolved "read SKILL.md" to that global copy instead
of the fixture-local one — the prompt wording now says the RELATIVE path
explicitly and tells the agent not to use any other install it may know
about; re-verified fixed for pi, watch for it on new drivers too. Separately
(and more seriously): opencode did not treat the subprocess cwd as its
project root at all without an explicit --dir flag — it operated on this
repo's real directory until that was fixed (see git history). cline and
codex were both verified to respect their own -c/--cwd and -C/--cd flags
correctly before being trusted here. hermes is the most severe instance of
this class found so far: the bare `hermes-agent` binary (distinct from the
`hermes` CLI actually used here) ignores the launch directory entirely and
runs its terminal/file tools against the real $HOME — confirmed with a
canary file that a plain `ls` returned the operator's real home-directory
listing, not the fixture. `hermes chat --in DIR` (what run_agent_hermes
uses) was verified correct before being trusted: the exported session's
recorded cwd matches the fixture dir and tool output matches fixture
contents.

NOTE: the pi, opencode, kimi, cline, codex, omp, and hermes drivers (command
flags, JSON event schema) were built from each project's own docs/live
testing — pi and kimi verified against real transcripts (local Ollama and
OpenRouter), opencode, cline, codex, omp, and hermes verified against
OpenRouter. Re-check render_transcript_* against a fresh raw transcript if
a driver's CLI version changes noticeably.

Usage:
  python3 tools/evals/run.py --all
  python3 tools/evals/run.py --cases continuous-capture-basic,chestertons-fence-guard
  python3 tools/evals/run.py --all --parallel 4 --model sonnet --judge-model sonnet
  python3 tools/evals/run.py --all --driver pi --model ollama/qwen3:8b --parallel 1
  python3 tools/evals/run.py --all --driver opencode --model ollama/qwen3:8b
  python3 tools/evals/run.py --all --parallel 2 --results-dir tools/evals/results/foo \
      --retry-until-complete --retry-interval 600 --max-wait-hours 10

Results land in tools/evals/results/<timestamp>-<driver>/ (gitignored): one
JSON per case plus summary.json and summary.md.

Re-running against the same --results-dir is cheap and safe: any case that
already has a stored "pass" or "fail" verdict is skipped without touching the
API. This is what makes --retry-until-complete work — if the agent's own
account hits its session/usage limit mid-run (a real message in the
transcript, not a crash), the runner stops spending on further cases in that
pass, marks them "rate_limited", and (with --retry-until-complete) sleeps and
tries again later, picking up only what's still unresolved. Plain errors (a
safety-classifier refusal, a crash, a timeout) with no rate limit in play are
retried after the much shorter --error-retry-interval instead. It will not sit
there hammering the API once the wall is hit, and it will not silently give
up and leave a truncated result set either. (The rate-limit detection is
Claude-account-specific; it simply won't fire for the other drivers.)
"""

import argparse
import datetime
import sys
from pathlib import Path

from ktw_evals.cases import load_cases
from ktw_evals.common import TOOL_DIR
from ktw_evals.drivers import AGENT_RUNNERS
from ktw_evals.matrix import run_matrix
from ktw_evals.runner import run_until_resolved


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="run every case")
    group.add_argument("--cases", help="comma-separated case ids")
    ap.add_argument(
        "--driver",
        choices=sorted(AGENT_RUNNERS),
        default="claude",
        help="agentic CLI to run the skill under test with (default: claude); "
        "see module docstring for what pi/opencode do differently",
    )
    ap.add_argument(
        "--model",
        default="sonnet",
        help="agent-under-test model, syntax is driver-specific "
        "(default: sonnet; e.g. --driver pi --model ollama/qwen3:8b)",
    )
    ap.add_argument(
        "--judge-model",
        default="sonnet",
        help="judge model (default: sonnet; always run via the claude driver, "
        "regardless of --driver, so grading stays consistent)",
    )
    ap.add_argument(
        "--parallel", type=int, default=3, help="concurrent cases (default: 3)"
    )
    ap.add_argument(
        "--timeout", type=int, default=900, help="per-run timeout in seconds"
    )
    ap.add_argument(
        "--results-dir",
        help="output dir (default: tools/evals/results/<timestamp>-<driver>)",
    )
    ap.add_argument(
        "--retry-until-complete",
        action="store_true",
        help="on a rate-limited/incomplete pass, sleep and retry only the "
        "unresolved cases, until every case has a pass/fail verdict or "
        "--max-wait-hours is exceeded",
    )
    ap.add_argument(
        "--retry-interval",
        type=int,
        default=600,
        help="seconds to sleep before a retry pass when the account's "
        "session/usage limit was hit (default: 600) — those windows reset "
        "on an hours scale, polling faster is pure waste",
    )
    ap.add_argument(
        "--error-retry-interval",
        type=int,
        default=30,
        help="seconds to sleep before a retry pass when every unresolved case "
        "is a plain error — a safety-classifier refusal, a driver crash, a "
        "timeout — and nothing is rate-limited (default: 30). Such errors "
        "are retriable at once; the long --retry-interval only applies "
        "while a rate limit is in play",
    )
    ap.add_argument(
        "--max-wait-hours",
        type=float,
        default=10,
        help="give up retrying after this many hours total (default: 10)",
    )
    ap.add_argument(
        "--judge-always",
        action="store_true",
        help="call the judge even when a case already failed a deterministic "
        "check (default: skip it — the check settles the case). The judge's "
        "own verdict is then stored as judge_verdict next to the final one, "
        "which is how a judge blind spot gets found",
    )
    ap.add_argument(
        "--matrix",
        action="store_true",
        help="run every driver x model combination from "
        "tools/evals/matrix-config.json instead of a single "
        "--driver/--model run; --driver/--model are ignored "
        "in this mode. Prints a docs/agent-matrix.md-style "
        "table and exits non-zero if anything failed or "
        "didn't resolve — safe to run unattended (e.g. CI).",
    )
    ap.add_argument(
        "--matrix-drivers",
        help="comma-separated driver override for --matrix "
        "(default: the drivers list in matrix-config.json)",
    )
    ap.add_argument(
        "--matrix-models",
        help="comma-separated model override for --matrix, full "
        "--model strings (default: the models list in "
        "matrix-config.json)",
    )
    ap.add_argument(
        "--matrix-parallel",
        type=int,
        default=4,
        help="concurrent driver x model combinations for "
        "--matrix (default: 4) — separate from --parallel, "
        "which still controls concurrent cases within each "
        "combination",
    )
    args = ap.parse_args()

    cases = load_cases(args.cases.split(",") if args.cases else None)

    if args.matrix:
        sys.exit(run_matrix(cases, args))

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    results_dir = (
        Path(args.results_dir)
        if args.results_dir
        else TOOL_DIR / "results" / f"{stamp}-{args.driver}"
    )
    results_dir.mkdir(parents=True, exist_ok=True)
    sys.exit(run_until_resolved(cases, args, results_dir))


if __name__ == "__main__":
    main()
