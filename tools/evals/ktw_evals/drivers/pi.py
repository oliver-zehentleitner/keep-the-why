"""Pi (`pi`, earendil-works/pi-mono)."""

import json
import os
import subprocess

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_pi(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
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
        error = f"pi exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
    return {"events": events, "error": error}


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
                if (
                    isinstance(block, dict)
                    and block.get("type") == "text"
                    and block.get("text", "").strip()
                ):
                    out.append(f"[assistant]\n{block['text'].strip()}")
        elif t == "tool_execution_start":
            inp = json.dumps(ev.get("args", {}), ensure_ascii=False)
            if len(inp) > 1500:
                inp = inp[:1500] + "…(truncated)"
            out.append(f"[tool call] {ev.get('toolName')}: {inp}")
        elif t == "tool_execution_end":
            result = ev.get("result")
            result = (
                json.dumps(result, ensure_ascii=False)
                if isinstance(result, (dict, list))
                else str(result)
            )
            if len(result) > MAX_TOOL_RESULT_CHARS:
                result = result[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            prefix = "[tool error]" if ev.get("isError") else "[tool result]"
            out.append(f"{prefix} {result}")
        elif t == "agent_end":
            out.append("[session ended]")
    return _cap("\n\n".join(out))
