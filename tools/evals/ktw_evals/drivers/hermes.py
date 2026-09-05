"""Hermes Agent (`hermes`, NousResearch). MUST be invoked as `hermes chat` — see run_agent_hermes."""

import json
import os
import re
import subprocess
import sys

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_hermes(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    # IMPORTANT: this is `hermes` (the full CLI), never `hermes-agent`
    # (the bare `run_agent.py` entry point installed alongside it). Verified
    # the hard way: invoked directly with no workspace registered,
    # `hermes-agent`'s terminal/file tools ignored the launch directory
    # entirely and operated against the real $HOME instead of the fixture
    # (a `ls` returned the operator's real home-directory listing) — the
    # same class of bug as opencode's missing --dir, but silently touching
    # a real machine instead of a throwaway repo. `hermes chat --in DIR`
    # does scope correctly (verified: the exported session's recorded `cwd`
    # matches the fixture dir, and tool output matches fixture contents).
    #
    # -t terminal,file: hermes's default toolset is far broader than a
    # coding-agent comparison needs (browser automation, image/video gen,
    # TTS, Discord/Slack/WhatsApp, computer use, ...) — scope it down to the
    # two toolsets equivalent to what the other drivers expose.
    # --yolo: non-interactive approval bypass. -Q: quiet mode — required so
    # stdout is just the final response text. The `session_id: ...` line
    # used below is NOT on stdout despite -Q's own help text implying it's
    # part of the "final response info" — verified with a raw, unpiped
    # capture that it's written to stderr instead. Search both.
    provider, _, model_id = model.partition("/")
    cmd = [
        "hermes",
        "chat",
        "-q",
        prompt,
        "--model",
        model_id,
        "--provider",
        provider,
        "-t",
        "terminal,file",
        "--in",
        str(cwd),
        "--yolo",
        "-Q",
        "--max-turns",
        "40",
    ]
    if disallowed_tools:
        print(
            f"  NOTE: hermes driver has no per-tool deny flag (only toolset-level "
            f"via -t) — case's disallowed_tools {disallowed_tools} not enforced.",
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
    m = re.search(
        r"^session_id:\s*(\S+)", proc.stdout + "\n" + proc.stderr, re.MULTILINE
    )
    if not m:
        return {
            "events": [],
            "error": f"hermes exited {proc.returncode}, no session_id "
            f"found in output: {(proc.stderr or proc.stdout)[:2000]}",
        }
    session_id = m.group(1)
    # The transcript (including tool calls) isn't in `hermes chat`'s own
    # stdout — it's pulled separately from hermes's session store, the same
    # store `hermes sessions browse`/`--resume` reads from.
    try:
        exp = subprocess.run(
            [
                "hermes",
                "sessions",
                "export",
                "-",
                "--session-id",
                session_id,
                "--format",
                "jsonl",
            ],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return {"events": [], "error": f"timeout exporting session {session_id}"}
    try:
        session_obj = json.loads(exp.stdout.strip())
    except json.JSONDecodeError:
        return {
            "events": [],
            "error": f"could not parse session export for "
            f"{session_id}: {exp.stderr[:2000]}",
        }
    return {"events": [session_obj], "error": None}


def render_transcript_hermes(events):
    """Flatten a single `hermes sessions export --format jsonl` session object
    (run_agent_hermes stashes it as the lone entry of `events`)."""
    if not events:
        return ""
    session = events[0]
    out = []
    for msg in session.get("messages", []):
        role = msg.get("role")
        if role == "assistant":
            content = (msg.get("content") or "").strip()
            if content:
                out.append(f"[assistant]\n{content}")
            for tc in msg.get("tool_calls") or []:
                fn = tc.get("function", {})
                args = fn.get("arguments", "")
                if len(args) > 1500:
                    args = args[:1500] + "…(truncated)"
                out.append(f"[tool call] {fn.get('name')}: {args}")
        elif role == "tool":
            content = str(msg.get("content") or "")
            if len(content) > MAX_TOOL_RESULT_CHARS:
                content = content[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
            out.append(f"[tool result] {content}")
    end_reason = session.get("end_reason")
    if end_reason:
        out.append(f"[session ended] reason={end_reason}")
    return _cap("\n\n".join(out))
