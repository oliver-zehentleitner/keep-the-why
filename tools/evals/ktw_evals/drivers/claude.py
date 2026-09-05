"""Claude Code (`claude`). Native skill discovery — see run.py's docstring."""

import json
import os
import subprocess

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


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
        error = (
            f"claude exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
        )
    return {"events": events, "error": error}


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
