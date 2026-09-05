"""opencode (`opencode`, SST)."""

import json
import os
import subprocess
import sys

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_opencode(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
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
    cmd = [
        "opencode",
        "run",
        prompt,
        "--format",
        "json",
        "--model",
        model,
        "--dir",
        str(cwd),
        "--auto",
    ]
    if disallowed_tools:
        print(
            f"  NOTE: opencode driver has no documented tool-deny flag — "
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
        error = (
            f"opencode exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
        )
    return {"events": events, "error": error}


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
