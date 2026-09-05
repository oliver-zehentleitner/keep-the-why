"""oh-my-pi (`omp`, can1357/oh-my-pi), a pi fork with a much larger harness — see run.py's docstring."""

import json
import os
import subprocess
import sys

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_omp(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    # --yolo: non-interactive approval bypass (omp's equivalent of
    # --dangerously-skip-permissions, per docs/approval-mode.md — without it,
    # writes sit on the client-side permission gate with nothing to answer
    # it, the same failure shape codex hit before --approve-for-me).
    # --mode json: newline-delimited JSON event stream. Verified live (not
    # just from docs) to emit the identical shape pi's --mode json does for
    # every event type render_transcript_omp consumes — expected of a pi
    # fork, confirmed rather than assumed; see module docstring.
    # --cwd: passed explicitly as defense in depth. A canary-file check
    # (temp dir with a marker file, run outside any real project) confirmed
    # omp already respects the subprocess's OS-level cwd correctly without
    # this flag — unlike opencode, which silently operated on this repo's
    # real directory until --dir was added (see module docstring) — but the
    # flag costs nothing and removes the dependency on that behavior holding
    # across future omp versions.
    # --no-session: don't persist a session record for this throwaway run.
    # --no-skills: disables omp's own skill auto-discovery. This host has an
    # unrelated global keep-the-why install at ~/.pi/agent/skills/keep-the-why
    # (for the pi driver) — without this flag, an ambiguous "read SKILL.md"
    # could resolve to that instead of the fixture-local copy the prompt
    # explicitly points at, the exact bug class pi and opencode hit before
    # their prompts were made to say the relative path explicitly.
    cmd = [
        "omp",
        "-p",
        "--mode",
        "json",
        "--yolo",
        "--model",
        model,
        "--cwd",
        str(cwd),
        "--no-session",
        "--no-skills",
        prompt,
    ]
    if disallowed_tools:
        print(
            f"  NOTE: omp driver has no documented per-tool deny flag (only "
            f"an allow-list via --tools) — case's disallowed_tools "
            f"{disallowed_tools} not enforced.",
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
        error = f"omp exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
    return {"events": events, "error": error}


def render_transcript_omp(events):
    """Flatten omp's --mode json event stream.

    Identical logic to render_transcript_pi: omp is a fork of pi and, for
    the event types this consumes, emits the same shape (verified live, see
    run_agent_omp).
    """
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
