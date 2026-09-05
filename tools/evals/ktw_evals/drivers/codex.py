"""Codex CLI (`codex`, openai/codex)."""

import json
import os
import subprocess
import sys

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_codex(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    # -C/--cd is required, same lesson as opencode's --dir. --skip-git-repo-check:
    # without it codex refuses to run in a directory it hasn't been told to
    # trust, even a fresh fixture repo. --json: newline-delimited "item"/"turn"
    # event stream, see render_transcript_codex.
    #
    # --approve-for-me is NOT optional, verified the hard way: codex exec's
    # default sandbox/approval (workspace-write, on-request) has no one to
    # answer an approval request in a non-interactive session, so every write
    # attempt was silently denied — every eval case looked like "the agent
    # correctly didn't touch the file" when the truth was it structurally
    # couldn't, regardless of what it actually decided. --approve-for-me
    # routes approval requests through automatic review instead, so real
    # writes go through. --dangerously-bypass-approvals-and-sandbox would
    # also work but is broader than needed, and this session's own
    # permission layer rejects that flag outright.
    # model_reasoning_effort=medium: also not optional for some OpenRouter
    # models (verified: google/gemini-3.1-pro-preview and x-ai/grok-4.6 both
    # 400'd with "Reasoning is mandatory for this endpoint and cannot be
    # disabled" without it — codex doesn't recognize either model, so its
    # fallback metadata omits reasoning entirely unless told otherwise).
    # Harmless to set unconditionally for models that don't require it.
    provider, _, model_id = model.partition("/")
    cmd = [
        "codex",
        "exec",
        "--json",
        "-C",
        str(cwd),
        "--skip-git-repo-check",
        "--approve-for-me",
        "-c",
        f"model_provider={provider}",
        "-c",
        "model_reasoning_effort=medium",
        "-m",
        model_id,
        prompt,
    ]
    if disallowed_tools:
        print(
            f"  NOTE: codex driver has no documented tool-deny flag — "
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
        error = f"codex exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
    return {"events": events, "error": error}


def render_transcript_codex(events):
    """Flatten codex's --json item/turn event stream (item.completed, item.type)."""
    out = []
    for ev in events:
        t = ev.get("type")
        if t != "item.completed":
            if t == "turn.completed":
                out.append("[session ended]")
            continue
        item = ev.get("item") or {}
        it = item.get("type")
        if it == "agent_message":
            text = (item.get("text") or "").strip()
            if text:
                out.append(f"[assistant]\n{text}")
        elif it == "command_execution":
            cmd = item.get("command", "")
            out.append(f"[tool call] bash: {cmd}")
            output = str(item.get("aggregated_output", ""))
            if len(output) > MAX_TOOL_RESULT_CHARS:
                output = output[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            out.append(f"[tool result] {output}")
        elif it in ("file_change", "mcp_tool_call"):
            out.append(
                f"[tool call] {it}: {json.dumps(item, ensure_ascii=False)[:1500]}"
            )
        elif it == "error":
            out.append(f"[error] {item.get('message')}")
    return _cap("\n\n".join(out))
