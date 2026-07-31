#!/usr/bin/env python3
"""Local eval runner for the keep-the-why skill.

For each case in skills/keep-the-why/evals/evals.json:
  1. Materialize a throwaway git repo from tools/evals/fixtures/ (shared
     _base project, overlaid with the case's own fixture directory if one
     exists), and install the skill package into .claude/skills/.
  2. Run a real, fresh agent session (claude -p) with the case's prompt in
     that repo, capturing the full transcript and the resulting working-tree
     diff.
  3. Have a second, independent agent call (the judge) grade transcript +
     diff against the case's expected_behavior and return a structured
     verdict.

This is a development tool for this repository. It is deliberately NOT part
of the installable skill package (skills/keep-the-why/), which ships
instructions only — no executable code.

Usage:
  python3 tools/evals/run.py --all
  python3 tools/evals/run.py --cases continuous-capture-basic,chestertons-fence-guard
  python3 tools/evals/run.py --all --parallel 4 --model sonnet --judge-model sonnet

Results land in tools/evals/results/<timestamp>/ (gitignored): one JSON per
case plus summary.json and summary.md.
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


def build_workdir(case_id, cfg, workdir: Path):
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

    # Install the skill the way a project-scoped install would: a real copy
    # under .claude/skills/, untracked (simulates a personal/project install,
    # and keeps the skill out of the repo the agent analyzes).
    skill_target = workdir / ".claude" / "skills" / "keep-the-why"
    shutil.copytree(SKILL_DIR, skill_target)
    (workdir / ".git" / "info").mkdir(exist_ok=True)
    with open(workdir / ".git" / "info" / "exclude", "a") as f:
        f.write(".claude/\n")


def run_agent(prompt, cwd, model, timeout, disallowed_tools=None):
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


def render_transcript(events):
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
    text = "\n\n".join(out)
    if len(text) > MAX_TRANSCRIPT_CHARS:
        text = text[:MAX_TRANSCRIPT_CHARS] + "\n…(transcript truncated)"
    return text


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


def run_case(case, args, results_dir):
    case_id = case["id"]
    cfg = read_case_config(case_id)
    started = datetime.datetime.now(datetime.timezone.utc)
    with tempfile.TemporaryDirectory(prefix=f"ktw-eval-{case_id}-") as tmp:
        workdir = Path(tmp) / "project"
        workdir.mkdir()
        build_workdir(case_id, cfg, workdir)
        agent = run_agent(case["prompt"], workdir, args.model, args.timeout,
                          cfg.get("disallowed_tools"))
        transcript = render_transcript(agent["events"])
        diff = collect_diff(workdir)
    if agent.get("error"):
        verdict = {"verdict": "error", "reasoning": agent["error"]}
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
        "started": started.isoformat(),
        "duration_s": round((datetime.datetime.now(datetime.timezone.utc) - started).total_seconds()),
        "transcript": transcript,
        "disk_changes": diff,
    }
    (results_dir / f"{case_id}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False))
    print(f"  {record['verdict']:<5}  {case_id}  ({record['duration_s']}s)", flush=True)
    return record


def write_summary(records, results_dir, args):
    skill_version = re.search(r'version: "([^"]+)"', (SKILL_DIR / "SKILL.md").read_text()).group(1)
    passed = [r for r in records if r["verdict"] == "pass"]
    failed = [r for r in records if r["verdict"] == "fail"]
    errored = [r for r in records if r["verdict"] not in ("pass", "fail")]
    summary = {
        "skill_version": skill_version,
        "agent": "claude-code",
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
        f"Skill {skill_version} · agent: Claude Code (model `{args.model}`) · judge: `{args.judge_model}`",
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
    ap.add_argument("--model", default="sonnet", help="agent-under-test model (default: sonnet)")
    ap.add_argument("--judge-model", default="sonnet", help="judge model (default: sonnet)")
    ap.add_argument("--parallel", type=int, default=3, help="concurrent cases (default: 3)")
    ap.add_argument("--timeout", type=int, default=900, help="per-run timeout in seconds")
    ap.add_argument("--results-dir", help="output dir (default: tools/evals/results/<timestamp>)")
    args = ap.parse_args()

    cases = load_cases(args.cases.split(",") if args.cases else None)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    results_dir = Path(args.results_dir) if args.results_dir else TOOL_DIR / "results" / stamp
    results_dir.mkdir(parents=True, exist_ok=True)

    print(f"Running {len(cases)} case(s) → {results_dir}", flush=True)
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = {pool.submit(run_case, c, args, results_dir): c for c in cases}
        for fut in concurrent.futures.as_completed(futures):
            records.append(fut.result())

    order = {c["id"]: i for i, c in enumerate(cases)}
    records.sort(key=lambda r: order[r["id"]])
    summary = write_summary(records, results_dir, args)
    print(f"\n{summary['passed']}/{summary['total']} passed "
          f"({summary['failed']} failed, {summary['errors']} errors) — see {results_dir}/summary.md")
    sys.exit(0 if summary["failed"] == 0 and summary["errors"] == 0 else 1)


if __name__ == "__main__":
    main()
