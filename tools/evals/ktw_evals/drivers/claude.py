"""Claude Code (`claude`). Native skill discovery — see run.py's docstring."""

import json
import os
import subprocess

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap
from ..common import fake_home_env


def run_agent_claude(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    cmd = [
        "claude",
        "-p",
        prompt,
        "--model",
        model,
        "--output-format",
        "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        "--max-turns",
        "40",
        # Only project-level settings: the run must see the fixture project's
        # skill and config, not this machine's user-level CLAUDE.md, memory,
        # or personal skills — those would contaminate the scenario.
        "--setting-sources",
        "project,local",
    ]
    if disallowed_tools:
        cmd += ["--disallowedTools", ",".join(disallowed_tools)]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    if home is not None:
        fake_home_env(env, home)
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            env=env,
            capture_output=True,
            stdin=subprocess.DEVNULL,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        return {
            "events": [],
            "error": f"timeout after {timeout}s",
            "raw": (e.stdout or "")[:MAX_TRANSCRIPT_CHARS],
        }
    events = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    error, auth_failed = error_from_run(
        proc.returncode, events, proc.stdout, proc.stderr
    )
    return {"events": events, "error": error, "auth_failed": auth_failed}


def error_from_run(returncode, events, stdout, stderr):
    """(error message or None, auth_failed) for one CLI run.

    The message names what went wrong: the result event's text when the CLI
    reports one ("Not logged in · Please run /login"), else stderr, else the
    tail of stdout — not the head, which is the session's hook and init
    events and says nothing about the failure (it did, until 2026-09-28: a
    night of "claude exited 1: {hook_started…}" hid an expired login).
    `auth_failed` is the CLI's own structured signal, an event whose `error`
    is "authentication_failed", or the text saying so."""
    from ..results import AUTH_FAILURE_RE

    result = next((e for e in reversed(events) if e.get("type") == "result"), None)
    auth_failed = any(e.get("error") == "authentication_failed" for e in events)
    failed = returncode != 0 or bool(result and result.get("is_error"))
    if not failed:
        return None, False
    reason = (result or {}).get("result") if result else None
    if not reason:
        reason = (stderr or "").strip() or (stdout or "")[-2000:]
    reason = str(reason)[:2000]
    auth_failed = auth_failed or bool(AUTH_FAILURE_RE.search(reason))
    return f"claude exited {returncode}: {reason}", auth_failed


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
            out.append(
                f"[session ended] subtype={ev.get('subtype')} turns={ev.get('num_turns')}"
            )
    return _cap("\n\n".join(out))
