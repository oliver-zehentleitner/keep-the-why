#!/usr/bin/env python3
"""Local eval runner for the keep-the-why skill.

For each case in skills/keep-the-why/evals/evals.json:
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

pi, opencode, and kimi don't get native-discovery treatment: we don't test
whether they'd find the skill on their own (that's a Claude-Code-specific
question, already covered by the claude driver's activation cases). Instead
the skill is installed at a plain skills/keep-the-why/ path and the case
prompt is prefixed with an explicit instruction to read its SKILL.md and
follow it — this is what makes any tool-use-capable CLI usable here without
needing its own skill-discovery convention, and it's what lets --model point
at a model that has no notion of "skills" at all (a local Ollama model, or
any model via OpenRouter). What's under test with these three drivers is
instruction-following given the skill, not discovery. Verified live: on a
machine that also has a global keep-the-why install (e.g. this one, via
Claude Code's own skill), both pi and opencode initially resolved "read
SKILL.md" to that global copy instead of the fixture-local one — the prompt
wording now says the RELATIVE path explicitly and tells the agent not to use
any other install it may know about; re-verified fixed for pi, watch for it
on new drivers too.

NOTE: the pi, opencode, and kimi drivers (command flags, JSON event schema)
were built from each project's own docs/live testing — pi and kimi verified
against real transcripts (local Ollama and OpenRouter), opencode verified
against OpenRouter. Re-check render_transcript_* against a fresh raw
transcript if a driver's CLI version changes noticeably.

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
tries again later, picking up only what's still unresolved. It will not sit
there hammering the API once the wall is hit, and it will not silently give
up and leave a truncated result set either. (The rate-limit detection is
Claude-account-specific; it simply won't fire for the other drivers.)
"""

import argparse
import concurrent.futures
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parent.parent
SKILL_DIR = REPO_ROOT / "skills" / "keep-the-why"
EVALS_JSON = SKILL_DIR / "evals" / "evals.json"
FIXTURES_DIR = TOOL_DIR / "fixtures"
BASE_FIXTURE = FIXTURES_DIR / "_base"

MAX_DIFF_CHARS = 30_000
MAX_TRANSCRIPT_CHARS = 60_000
MAX_TOOL_RESULT_CHARS = 400

# Where the skill gets copied into each throwaway fixture project, per
# driver. claude keeps the pre-existing .claude/skills/ location so the
# activation-reliability cases (native discovery) don't change behavior;
# pi/opencode get a plain, easy-to-reference path since we tell them about it
# explicitly instead of relying on discovery (see module docstring).
SKILL_INSTALL_REL = {
    "claude": ".claude/skills/keep-the-why",
    "pi": "skills/keep-the-why",
    "opencode": "skills/keep-the-why",
    "kimi": "skills/keep-the-why",
}

# Whether the case prompt gets prefixed with an explicit "read SKILL.md and
# follow it" instruction. False only for claude, where discovery itself is
# part of what's under test.
EXPLICIT_LOAD = {"claude": False, "pi": True, "opencode": True, "kimi": True}

DRIVER_LABELS = {"claude": "Claude Code", "pi": "Pi", "opencode": "opencode", "kimi": "Kimi Code"}

# Matches the CLI's own plain-text account-limit messages (observed so far:
# "You've hit your session limit · resets ..." and "You've hit your monthly
# spend limit.") — these are normal, successful responses as far as the CLI
# is concerned (exit 0, real turns), not exceptions, so this has to be caught
# by content, not by return code. Deliberately anchored on "hit your ... limit"
# (first-person, about the account itself) rather than a bare "rate limit" or
# "usage limit" substring, which could otherwise false-positive on legitimate
# fixture content that discusses a gateway's own rate limiter.
RATE_LIMIT_RE = re.compile(r"hit your [\w ]{0,25}\blimit\b", re.IGNORECASE)


def sh(args, cwd=None, check=True, env=None, timeout=None, input_=None):
    return subprocess.run(
        args, cwd=cwd, check=check, env=env, timeout=timeout,
        capture_output=True, text=True, input=input_,
    )


def load_cases(selected):
    cases = json.loads(EVALS_JSON.read_text())
    by_id = {c["id"]: c for c in cases}
    if selected:
        missing = [c for c in selected if c not in by_id]
        if missing:
            sys.exit(f"unknown case id(s): {', '.join(missing)}")
        return [by_id[c] for c in selected]
    return cases


def read_case_config(case_id):
    """Optional per-case config: fixtures/<id>/case.json.

    Supported keys:
      base: "none" to skip the _base overlay (default: use _base)
      remove: [paths] to delete after overlay (e.g. drop AGENTS.local.md)
      commits: [{"message": str, "files": {path: content}, "author": str,
                 "date": str}] — extra commits after the initial one
      disallowed_tools: [tool names] passed to claude --disallowedTools
                        (e.g. deny WebFetch to simulate no web access)
    """
    p = FIXTURES_DIR / case_id / "case.json"
    if p.exists():
        return json.loads(p.read_text())
    return {}


def copy_tree(src: Path, dst: Path):
    for item in src.rglob("*"):
        if item.name == "case.json" and item.parent == src:
            continue
        rel = item.relative_to(src)
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def build_workdir(case_id, cfg, workdir: Path, driver):
    if cfg.get("base") != "none" and BASE_FIXTURE.exists():
        copy_tree(BASE_FIXTURE, workdir)
    case_fixture = FIXTURES_DIR / case_id
    if case_fixture.exists():
        copy_tree(case_fixture, workdir)
    for rel in cfg.get("remove", []):
        target = workdir / rel
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    # Fixtures that mean "a project at the *current* schema" carry a
    # {{SKILL_VERSION}} placeholder instead of a hardcoded version, so they
    # don't all go stale (and start triggering migration prompts mid-eval)
    # on every release. Deliberately old pins (0.2.0, 0.9.9, ...) stay literal.
    version = re.search(r'version: "([^"]+)"', (SKILL_DIR / "SKILL.md").read_text()).group(1)
    for md in workdir.rglob("*.md"):
        text = md.read_text()
        if "{{SKILL_VERSION}}" in text:
            md.write_text(text.replace("{{SKILL_VERSION}}", version))

    git_env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "Eval Fixture", "GIT_AUTHOR_EMAIL": "fixture@example.com",
        "GIT_COMMITTER_NAME": "Eval Fixture", "GIT_COMMITTER_EMAIL": "fixture@example.com",
    }
    sh(["git", "init", "-q", "-b", "main"], cwd=workdir, env=git_env)
    sh(["git", "add", "-A"], cwd=workdir, env=git_env)
    sh(["git", "commit", "-q", "-m", "Initial commit", "--allow-empty"], cwd=workdir, env=git_env)

    for commit in cfg.get("commits", []):
        for rel, content in commit.get("files", {}).items():
            p = workdir / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        env = dict(git_env)
        if commit.get("author"):
            name, _, email = commit["author"].partition(" <")
            env["GIT_AUTHOR_NAME"] = name
            env["GIT_AUTHOR_EMAIL"] = email.rstrip(">") or "fixture@example.com"
        if commit.get("date"):
            env["GIT_AUTHOR_DATE"] = commit["date"]
            env["GIT_COMMITTER_DATE"] = commit["date"]
        sh(["git", "add", "-A"], cwd=workdir, env=env)
        sh(["git", "commit", "-q", "--allow-empty", "-m", commit["message"]], cwd=workdir, env=env)

    # Install the skill the way a project-scoped install would: a real,
    # untracked copy (keeps the skill out of the repo the agent analyzes)
    # at the driver's install path.
    skill_rel = SKILL_INSTALL_REL[driver]
    skill_target = workdir / skill_rel
    skill_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL_DIR, skill_target)
    (workdir / ".git" / "info").mkdir(exist_ok=True)
    with open(workdir / ".git" / "info" / "exclude", "a") as f:
        f.write(f"/{skill_rel}/\n")


def build_prompt(case_prompt, driver):
    """Case prompt as actually sent to the agent for this driver.

    Unchanged for claude (discovery is part of what's under test there). For
    drivers without native skill discovery, prefix an explicit pointer to the
    installed SKILL.md — see module docstring "Drivers" section for why.
    """
    if not EXPLICIT_LOAD[driver]:
        return case_prompt
    skill_rel = SKILL_INSTALL_REL[driver]
    return (
        f"Before doing anything else, read the file at the RELATIVE path "
        f"./{skill_rel}/SKILL.md, inside the current working directory of "
        f"this session (do not use any other 'keep-the-why' skill you may "
        f"already know about or have installed globally elsewhere on this "
        f"machine — only the copy at that exact relative path is the one "
        f"under test here). Follow its instructions for the rest of this "
        f"session — including any of its references/*.md files it points "
        f"you to for the situation at hand.\n\n{case_prompt}"
    )


def _cap(text, limit=MAX_TRANSCRIPT_CHARS):
    if len(text) > limit:
        return text[:limit] + "\n…(transcript truncated)"
    return text


def run_agent_claude(prompt, cwd, model, timeout, disallowed_tools=None):
    cmd = [
        "claude", "-p", prompt,
        "--model", model,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        "--max-turns", "40",
        # Only project-level settings: the run must see the fixture project's
        # skill and config, not this machine's user-level CLAUDE.md, memory,
        # or personal skills — those would contaminate the scenario.
        "--setting-sources", "project,local",
    ]
    if disallowed_tools:
        cmd += ["--disallowedTools", ",".join(disallowed_tools)]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    try:
        proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        return {"events": [], "error": f"timeout after {timeout}s",
                "raw": (e.stdout or "")[:MAX_TRANSCRIPT_CHARS]}
    events = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    error = None
    if proc.returncode != 0 and not events:
        error = f"claude exited {proc.returncode}: {proc.stderr[:2000]}"
    return {"events": events, "error": error}


def run_agent_pi(prompt, cwd, model, timeout, disallowed_tools=None):
    # --approve: trust project-local files for this run, no interactive
    # prompt (pi's equivalent of --dangerously-skip-permissions).
    # --mode json: newline-delimited JSON event stream, documented at
    # pi.dev/docs/latest/json — see render_transcript_pi for the event types
    # consumed here. Flag names/positions verified against pi's own docs as
    # of this writing, NOT yet against a real install (see module docstring).
    cmd = ["pi", "--mode", "json", "--approve", "--model", model, prompt]
    if disallowed_tools:
        cmd += ["--exclude-tools", ",".join(disallowed_tools)]
    env = dict(os.environ)
    try:
        proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        return {"events": [], "error": f"timeout after {timeout}s",
                "raw": (e.stdout or "")[:MAX_TRANSCRIPT_CHARS]}
    events = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    error = None
    if proc.returncode != 0 and not events:
        error = f"pi exited {proc.returncode}: {proc.stderr[:2000]}"
    return {"events": events, "error": error}


def run_agent_opencode(prompt, cwd, model, timeout, disallowed_tools=None):
    # --auto: auto-approve permissions (opencode's equivalent of
    # --dangerously-skip-permissions). --format json: JSONL event stream, see
    # render_transcript_opencode. No documented per-run tool-deny flag as of
    # this writing, so disallowed_tools is only logged, not enforced — see
    # module docstring for the verification caveat.
    #
    # --dir is NOT optional here, verified the hard way: opencode does not
    # treat the subprocess's OS-level cwd as its project root on its own —
    # without an explicit --dir it operated on this very repo's real working
    # directory instead of the isolated fixture (read real SKILL.md/AGENTS.md
    # files, and in one run actually wrote a context/ entry into this repo,
    # promptly reverted). cwd= below is kept anyway as defense in depth.
    cmd = ["opencode", "run", prompt, "--format", "json", "--model", model,
           "--dir", str(cwd), "--auto"]
    if disallowed_tools:
        print(f"  NOTE: opencode driver has no documented tool-deny flag — "
              f"case's disallowed_tools {disallowed_tools} not enforced.",
              file=sys.stderr)
    env = dict(os.environ)
    try:
        proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        return {"events": [], "error": f"timeout after {timeout}s",
                "raw": (e.stdout or "")[:MAX_TRANSCRIPT_CHARS]}
    events = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    error = None
    if proc.returncode != 0 and not events:
        error = f"opencode exited {proc.returncode}: {proc.stderr[:2000]}"
    return {"events": events, "error": error}


def run_agent_kimi(prompt, cwd, model, timeout, disallowed_tools=None):
    # -p is inherently non-interactive/autonomous (cannot be combined with
    # -y/--auto — the CLI rejects that). --output-format stream-json: one
    # OpenAI-chat-style JSON object per line, see render_transcript_kimi.
    cmd = ["kimi", "-p", prompt, "-m", model, "--output-format", "stream-json"]
    if disallowed_tools:
        print(f"  NOTE: kimi driver has no documented tool-deny flag — "
              f"case's disallowed_tools {disallowed_tools} not enforced.",
              file=sys.stderr)
    env = dict(os.environ)
    try:
        proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        return {"events": [], "error": f"timeout after {timeout}s",
                "raw": (e.stdout or "")[:MAX_TRANSCRIPT_CHARS]}
    events = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    error = None
    if proc.returncode != 0 and not events:
        error = f"kimi exited {proc.returncode}: {proc.stderr[:2000]}"
    return {"events": events, "error": error}


AGENT_RUNNERS = {
    "claude": run_agent_claude,
    "pi": run_agent_pi,
    "opencode": run_agent_opencode,
    "kimi": run_agent_kimi,
}


def render_transcript_claude(events):
    """Flatten stream-json events into a readable transcript for the judge."""
    out = []
    for ev in events:
        t = ev.get("type")
        if t == "assistant":
            for block in ev.get("message", {}).get("content", []):
                if block.get("type") == "text" and block.get("text", "").strip():
                    out.append(f"[assistant]\n{block['text'].strip()}")
                elif block.get("type") == "tool_use":
                    inp = json.dumps(block.get("input", {}), ensure_ascii=False)
                    if len(inp) > 1500:
                        inp = inp[:1500] + "…(truncated)"
                    out.append(f"[tool call] {block.get('name')}: {inp}")
        elif t == "user":
            for block in ev.get("message", {}).get("content", []):
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    content = block.get("content")
                    if isinstance(content, list):
                        content = " ".join(
                            c.get("text", "") for c in content if isinstance(c, dict)
                        )
                    content = str(content)
                    if len(content) > MAX_TOOL_RESULT_CHARS:
                        content = content[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
                    out.append(f"[tool result] {content}")
        elif t == "result":
            out.append(f"[session ended] subtype={ev.get('subtype')} turns={ev.get('num_turns')}")
    return _cap("\n\n".join(out))


def render_transcript_pi(events):
    """Flatten pi's --mode json event stream (pi.dev/docs/latest/json)."""
    out = []
    for ev in events:
        t = ev.get("type")
        if t == "message_end":
            msg = ev.get("message") or {}
            if msg.get("role") != "assistant":
                continue
            for block in msg.get("content", []) or []:
                if isinstance(block, dict) and block.get("type") == "text" \
                        and block.get("text", "").strip():
                    out.append(f"[assistant]\n{block['text'].strip()}")
        elif t == "tool_execution_start":
            inp = json.dumps(ev.get("args", {}), ensure_ascii=False)
            if len(inp) > 1500:
                inp = inp[:1500] + "…(truncated)"
            out.append(f"[tool call] {ev.get('toolName')}: {inp}")
        elif t == "tool_execution_end":
            result = ev.get("result")
            result = json.dumps(result, ensure_ascii=False) if isinstance(result, (dict, list)) else str(result)
            if len(result) > MAX_TOOL_RESULT_CHARS:
                result = result[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            prefix = "[tool error]" if ev.get("isError") else "[tool result]"
            out.append(f"{prefix} {result}")
        elif t == "agent_end":
            out.append("[session ended]")
    return _cap("\n\n".join(out))


def render_transcript_opencode(events):
    """Flatten opencode's `run --format json` event stream."""
    out = []
    for ev in events:
        t = ev.get("type")
        part = ev.get("part") or {}
        if t == "text":
            text = (part.get("text") or "").strip()
            if text:
                out.append(f"[assistant]\n{text}")
        elif t == "tool_use":
            state = part.get("state") or {}
            inp = json.dumps(state.get("input", {}), ensure_ascii=False)
            if len(inp) > 1500:
                inp = inp[:1500] + "…(truncated)"
            out.append(f"[tool call] {part.get('tool')}: {inp}")
            output = str(state.get("output", ""))
            if len(output) > MAX_TOOL_RESULT_CHARS:
                output = output[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            out.append(f"[tool result] {output}")
        elif t == "step_finish":
            out.append(f"[session ended] reason={part.get('reason')}")
        elif t == "error":
            out.append(f"[error] {json.dumps(ev, ensure_ascii=False)[:500]}")
    return _cap("\n\n".join(out))


def render_transcript_kimi(events):
    """Flatten kimi's --output-format stream-json output (OpenAI-chat-style roles)."""
    out = []
    for ev in events:
        role = ev.get("role")
        if role == "assistant":
            content = (ev.get("content") or "").strip()
            if content:
                out.append(f"[assistant]\n{content}")
            for tc in ev.get("tool_calls") or []:
                fn = tc.get("function", {}) or {}
                args = fn.get("arguments", "")
                if len(args) > 1500:
                    args = args[:1500] + "…(truncated)"
                out.append(f"[tool call] {fn.get('name')}: {args}")
        elif role == "tool":
            content = str(ev.get("content", ""))
            if len(content) > MAX_TOOL_RESULT_CHARS:
                content = content[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            out.append(f"[tool result] {content}")
        elif role == "meta" and ev.get("type") == "session.resume_hint":
            out.append("[session ended]")
    return _cap("\n\n".join(out))


TRANSCRIPT_RENDERERS = {
    "claude": render_transcript_claude,
    "pi": render_transcript_pi,
    "opencode": render_transcript_opencode,
    "kimi": render_transcript_kimi,
}


def collect_diff(workdir):
    """What the agent actually changed on disk: status, diff, new files."""
    status = sh(["git", "status", "--porcelain"], cwd=workdir).stdout
    diff = sh(["git", "diff"], cwd=workdir).stdout
    parts = [f"# git status --porcelain\n{status or '(clean)'}"]
    if diff.strip():
        parts.append(f"# git diff (tracked files)\n{diff}")
    for line in status.splitlines():
        if line.startswith("??"):
            rel = line[3:].strip()
            p = workdir / rel
            if p.is_file():
                try:
                    content = p.read_text()
                except (UnicodeDecodeError, OSError):
                    content = "(binary or unreadable)"
                if len(content) > 4000:
                    content = content[:4000] + "…(truncated)"
                parts.append(f"# new file: {rel}\n{content}")
    text = "\n\n".join(parts)
    if len(text) > MAX_DIFF_CHARS:
        text = text[:MAX_DIFF_CHARS] + "\n…(diff truncated)"
    return text


JUDGE_PROMPT = """You are grading one automated eval case for an agent skill \
called "keep-the-why" (it preserves the reasoning behind a codebase in \
context/ files). You get the test prompt, the expected behavior, the agent's \
transcript, and what the agent actually changed on disk.

Grade ONLY against the expected behavior. Rules:
- The session was non-interactive: the agent could not receive answers. If \
the expected behavior involves asking the user something, ending the turn \
with that question (without doing the thing that required permission first) \
counts as fully correct.
- What the agent wrote to disk matters as much as what it said. An agent \
that claims restraint but wrote the file anyway fails; an agent that asks \
first and writes nothing passes the asking-related expectations.
- Judge behavior, not eloquence. Extra reasonable work beyond the expected \
behavior is not a failure unless the expected behavior explicitly forbids it.
- Be strict about the core of the expectation, lenient about wording.

Do not use any tools — everything needed is in this prompt. Return ONLY a \
JSON object, no markdown fences, with exactly these keys:
{"verdict": "pass" or "fail",
 "score": 0-10 (10 = fully matches expected behavior),
 "reasoning": "2-5 sentences citing concrete evidence from transcript/diff",
 "violations": ["short bullet per expectation not met", ...]}

## Test prompt given to the agent
{PROMPT}

## Expected behavior
{EXPECTED}

## Agent transcript
{TRANSCRIPT}

## Changes the agent made on disk
{DIFF}
"""


def judge(case, transcript, diff, model, timeout):
    prompt = (JUDGE_PROMPT
              .replace("{PROMPT}", case["prompt"])
              .replace("{EXPECTED}", case["expected_behavior"])
              .replace("{TRANSCRIPT}", transcript or "(empty transcript)")
              .replace("{DIFF}", diff or "(no changes)"))
    cmd = ["claude", "-p", prompt, "--model", model, "--output-format", "json",
           "--max-turns", "4"]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    last_error = None
    for _attempt in range(2):
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, env=env,
                                  timeout=timeout, cwd=tempfile.gettempdir())
        except subprocess.TimeoutExpired:
            last_error = "judge timeout"
            continue
        try:
            data = json.loads(proc.stdout)
            if isinstance(data, list):  # newer CLIs emit the event list here
                result = next((ev.get("result", "") for ev in data
                               if isinstance(ev, dict) and ev.get("type") == "result"), "")
            else:
                result = data.get("result", "")
            match = re.search(r"\{.*\}", result, re.DOTALL)
            verdict = json.loads(match.group(0))
            if verdict.get("verdict") not in ("pass", "fail"):
                raise ValueError(f"bad verdict value: {verdict.get('verdict')!r}")
            return verdict
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            last_error = f"unparseable judge output ({e}): {proc.stdout[:1000]}"
    return {"verdict": "error", "reasoning": last_error}


def rate_limit_sentinel(results_dir):
    return results_dir / ".rate_limited"


def run_case(case, args, results_dir):
    case_id = case["id"]
    sentinel = rate_limit_sentinel(results_dir)
    if sentinel.exists():
        # Another case in this same pass already hit the account's own
        # session/usage limit — every further attempt would just hit the same
        # wall at real API cost. Skip outright, no workdir, no API call.
        record = {
            "id": case_id, "verdict": "rate_limited", "score": None,
            "reasoning": "Skipped: an earlier case in this pass hit the account's session/usage limit.",
            "violations": [], "agent_model": args.model, "judge_model": args.judge_model,
            "driver": args.driver,
            "started": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "duration_s": 0, "transcript": "", "disk_changes": "",
        }
        (results_dir / f"{case_id}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False))
        print(f"  skip   {case_id}  (rate-limited earlier in this pass)", flush=True)
        return record

    cfg = read_case_config(case_id)
    started = datetime.datetime.now(datetime.timezone.utc)
    with tempfile.TemporaryDirectory(prefix=f"ktw-eval-{case_id}-") as tmp:
        workdir = Path(tmp) / "project"
        workdir.mkdir()
        build_workdir(case_id, cfg, workdir, args.driver)
        prompt = build_prompt(case["prompt"], args.driver)
        agent = AGENT_RUNNERS[args.driver](prompt, workdir, args.model, args.timeout,
                                           cfg.get("disallowed_tools"))
        transcript = TRANSCRIPT_RENDERERS[args.driver](agent["events"])
        diff = collect_diff(workdir)
    if agent.get("error"):
        verdict = {"verdict": "error", "reasoning": agent["error"]}
    elif RATE_LIMIT_RE.search(transcript):
        # A real, successful CLI response that just says the account is out
        # of quota. Don't spend a second API call having the judge grade it —
        # there's nothing to grade — and stop the rest of this pass early.
        sentinel.touch()
        verdict = {"verdict": "rate_limited",
                   "reasoning": "Agent response indicated the account's session/usage limit was hit."}
    else:
        verdict = judge(case, transcript, diff, args.judge_model, args.timeout)
    record = {
        "id": case_id,
        "verdict": verdict.get("verdict"),
        "score": verdict.get("score"),
        "reasoning": verdict.get("reasoning"),
        "violations": verdict.get("violations", []),
        "agent_model": args.model,
        "judge_model": args.judge_model,
        "driver": args.driver,
        "started": started.isoformat(),
        "duration_s": round((datetime.datetime.now(datetime.timezone.utc) - started).total_seconds()),
        "transcript": transcript,
        "disk_changes": diff,
    }
    (results_dir / f"{case_id}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False))
    print(f"  {record['verdict']:<5}  {case_id}  ({record['duration_s']}s)", flush=True)
    return record


def load_resolved(case_id, results_dir):
    """A previously stored pass/fail verdict for this case, if there is one.

    Resolved means final: nothing further will change it by re-running.
    error/rate_limited are deliberately NOT resolved — those are exactly the
    outcomes a retry is supposed to replace with a real verdict. A stored
    pass/fail whose transcript is actually just an account-limit message
    (possible from a run predating this check, or a judge that scored a
    limit artifact instead of recognizing it) is treated as unresolved too —
    self-healing rather than permanently locking in a contaminated result.
    """
    p = results_dir / f"{case_id}.json"
    if not p.exists():
        return None
    try:
        record = json.loads(p.read_text())
    except json.JSONDecodeError:
        return None
    if record.get("verdict") not in ("pass", "fail"):
        return None
    if RATE_LIMIT_RE.search(record.get("transcript") or ""):
        return None
    return record


def execute_pass(cases, args, results_dir):
    """Run every not-yet-resolved case once; return (records, all_resolved)."""
    sentinel = rate_limit_sentinel(results_dir)
    sentinel.unlink(missing_ok=True)  # start this pass without a stale marker

    resolved, pending = [], []
    for c in cases:
        prior = load_resolved(c["id"], results_dir)
        (resolved if prior else pending).append(prior or c)

    if resolved:
        print(f"{len(resolved)} case(s) already resolved (pass/fail) — skipping", flush=True)
    print(f"Running {len(pending)} case(s) → {results_dir}", flush=True)

    fresh = []
    if pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as pool:
            futures = {pool.submit(run_case, c, args, results_dir): c for c in pending}
            for fut in concurrent.futures.as_completed(futures):
                fresh.append(fut.result())

    order = {c["id"]: i for i, c in enumerate(cases)}
    records = sorted(resolved + fresh, key=lambda r: order[r["id"]])
    summary = write_summary(records, results_dir, args)
    all_resolved = all(r["verdict"] in ("pass", "fail") for r in records)
    return records, summary, all_resolved


def write_summary(records, results_dir, args):
    skill_version = re.search(r'version: "([^"]+)"', (SKILL_DIR / "SKILL.md").read_text()).group(1)
    passed = [r for r in records if r["verdict"] == "pass"]
    failed = [r for r in records if r["verdict"] == "fail"]
    errored = [r for r in records if r["verdict"] not in ("pass", "fail")]
    summary = {
        "skill_version": skill_version,
        "driver": args.driver,
        "agent_model": args.model,
        "judge_model": args.judge_model,
        "date": datetime.date.today().isoformat(),
        "total": len(records),
        "passed": len(passed),
        "failed": len(failed),
        "errors": len(errored),
        "cases": {r["id"]: {"verdict": r["verdict"], "score": r.get("score")} for r in records},
    }
    (results_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    lines = [
        f"# Eval run — {summary['date']}",
        "",
        f"Skill {skill_version} · agent: {DRIVER_LABELS[args.driver]} (model `{args.model}`) · judge: `{args.judge_model}`",
        "",
        f"**{len(passed)}/{len(records)} passed** ({len(failed)} failed, {len(errored)} errors)",
        "",
    ]
    if failed or errored:
        lines.append("| Case | Verdict | Score | Notes |")
        lines.append("|---|---|---|---|")
        for r in failed + errored:
            note = (r.get("reasoning") or "").replace("\n", " ")[:200]
            lines.append(f"| {r['id']} | {r['verdict']} | {r.get('score', '—')} | {note} |")
    (results_dir / "summary.md").write_text("\n".join(lines) + "\n")
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="run every case")
    group.add_argument("--cases", help="comma-separated case ids")
    ap.add_argument("--driver", choices=sorted(AGENT_RUNNERS), default="claude",
                    help="agentic CLI to run the skill under test with (default: claude); "
                         "see module docstring for what pi/opencode do differently")
    ap.add_argument("--model", default="sonnet",
                    help="agent-under-test model, syntax is driver-specific "
                         "(default: sonnet; e.g. --driver pi --model ollama/qwen3:8b)")
    ap.add_argument("--judge-model", default="sonnet",
                    help="judge model (default: sonnet; always run via the claude driver, "
                         "regardless of --driver, so grading stays consistent)")
    ap.add_argument("--parallel", type=int, default=3, help="concurrent cases (default: 3)")
    ap.add_argument("--timeout", type=int, default=900, help="per-run timeout in seconds")
    ap.add_argument("--results-dir", help="output dir (default: tools/evals/results/<timestamp>-<driver>)")
    ap.add_argument("--retry-until-complete", action="store_true",
                    help="on a rate-limited/incomplete pass, sleep and retry only the "
                         "unresolved cases, until every case has a pass/fail verdict or "
                         "--max-wait-hours is exceeded")
    ap.add_argument("--retry-interval", type=int, default=600,
                    help="seconds to sleep between retry passes (default: 600)")
    ap.add_argument("--max-wait-hours", type=float, default=10,
                    help="give up retrying after this many hours total (default: 10)")
    args = ap.parse_args()

    cases = load_cases(args.cases.split(",") if args.cases else None)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    results_dir = Path(args.results_dir) if args.results_dir else TOOL_DIR / "results" / f"{stamp}-{args.driver}"
    results_dir.mkdir(parents=True, exist_ok=True)

    deadline = time.monotonic() + args.max_wait_hours * 3600
    attempt = 0
    while True:
        attempt += 1
        now = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{now}] pass {attempt}" + (" (retry)" if attempt > 1 else ""), flush=True)
        records, summary, all_resolved = execute_pass(cases, args, results_dir)

        if all_resolved or not args.retry_until_complete:
            print(f"\n{summary['passed']}/{summary['total']} passed "
                  f"({summary['failed']} failed, {summary['errors']} errors) — see {results_dir}/summary.md",
                  flush=True)
            if not all_resolved:
                print(f"NOTE: {summary['errors']} case(s) still unresolved (error/rate_limited) — "
                      f"re-run the same command (same --results-dir) to retry just those, "
                      f"or add --retry-until-complete.", flush=True)
            sys.exit(0 if summary["failed"] == 0 and summary["errors"] == 0 else 1)

        remaining = summary["errors"]
        if time.monotonic() >= deadline:
            print(f"\n[{now}] --max-wait-hours ({args.max_wait_hours}h) exceeded with "
                  f"{remaining} case(s) still unresolved — giving up for now. "
                  f"Re-run the same command against {results_dir} later to pick up where this left off.",
                  flush=True)
            sys.exit(4)

        print(f"[{now}] {remaining} case(s) still unresolved (likely rate-limited) — "
              f"sleeping {args.retry_interval}s before retrying", flush=True)
        time.sleep(args.retry_interval)


if __name__ == "__main__":
    main()
