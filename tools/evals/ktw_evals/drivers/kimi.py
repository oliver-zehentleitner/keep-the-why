"""Kimi Code (`kimi`, moonshotai)."""

import json
import os
import subprocess
import sys

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_kimi(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    # -p is inherently non-interactive/autonomous (cannot be combined with
    # -y/--auto — the CLI rejects that). --output-format stream-json: one
    # OpenAI-chat-style JSON object per line, see render_transcript_kimi.
    cmd = ["kimi", "-p", prompt, "-m", model, "--output-format", "stream-json"]
    if disallowed_tools:
        print(
            f"  NOTE: kimi driver has no documented tool-deny flag — "
            f"case's disallowed_tools {disallowed_tools} not enforced.",
            file=sys.stderr,
        )
    env = dict(os.environ)
    if home is not None:
        env["HOME"] = str(home)
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout
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
    error = None
    if proc.returncode != 0:
        error = f"kimi exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
    return {"events": events, "error": error}


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
