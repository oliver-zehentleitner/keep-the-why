"""Cline (`cline`, cline-bot)."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from ..common import MAX_TOOL_RESULT_CHARS, MAX_TRANSCRIPT_CHARS, _cap


def run_agent_cline(prompt, cwd, model, timeout, disallowed_tools=None, home=None):
    # cline takes provider and model as separate flags, unlike the other
    # drivers' combined "provider/model" --model string — split it here so
    # --model stays the same shape (e.g. openrouter/qwen/qwen3.8-27b) across
    # every driver at the run.py CLI level.
    provider, _, model_id = model.partition("/")
    # -c/--cwd: cline DOES respect this as its actual project root (verified
    # live against the real repo, unlike opencode — see run_agent_opencode).
    # --json: newline-delimited event stream, see render_transcript_cline.
    # --auto-approve true: explicit rather than relying on the documented
    # default, since a bare positional prompt is said to already imply it.
    #
    # --data-dir is NOT optional here, verified the hard way: cline runs a
    # persistent hub daemon (~/.cline/data by default) shared across every
    # invocation, not a clean one-shot subprocess like the other drivers. On
    # a slow model (a local Ollama run took long enough for OTHER eval cases'
    # fixture tmpdirs to be created and torn down in the meantime) the shared
    # daemon crashed outright — "CurrentWorkingDirectoryUnlinked" from Bun,
    # then "session not found" — because it still referenced a now-deleted
    # fixture cwd from elsewhere. The run silently produced a truncated
    # transcript with no error surfaced (see render_transcript_cline). An
    # isolated --data-dir per invocation avoids sharing that daemon at all.
    # Provider auth (settings/providers.json) lives under the data dir too,
    # so seed the fresh one from the default install's settings — everything
    # else (db/sessions/cache, the actual runtime state we're isolating
    # against) is left for cline to create clean.
    data_dir = tempfile.mkdtemp(prefix="ktw-cline-data-")
    default_settings = Path.home() / ".cline" / "data" / "settings"
    if default_settings.is_dir():
        shutil.copytree(default_settings, Path(data_dir) / "settings")
    cmd = [
        "cline",
        "--cwd",
        str(cwd),
        "--json",
        "-P",
        provider,
        "-m",
        model_id,
        "--auto-approve",
        "true",
        "--data-dir",
        data_dir,
        prompt,
    ]
    if disallowed_tools:
        print(
            f"  NOTE: cline driver has no documented tool-deny flag — "
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
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
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
        error = f"cline exited {proc.returncode}: {(proc.stderr or proc.stdout)[:2000]}"
    return {"events": events, "error": error}


def render_transcript_cline(events):
    """Flatten cline's --json event stream (agent_event/content_end, contentType text/tool).

    Also surfaces top-level "run_result"/finishReason=="error" and nested
    agent_event/type=="error" events explicitly — without this, a client-side
    failure (e.g. the underlying HTTP client's own request timeout firing
    against a slow-to-respond local model, well before our own --timeout)
    produced zero renderable events and an empty transcript, which the judge
    then graded as "the agent did nothing" (a fail) instead of a driver error.
    """
    out = []
    for ev in events:
        if ev.get("type") == "run_result" and ev.get("finishReason") == "error":
            out.append(f"[driver error] {ev.get('text') or 'run failed'}")
            continue
        e = ev.get("event") or {}
        t = e.get("type")
        if t == "content_end":
            ct = e.get("contentType")
            if ct == "text":
                text = (e.get("text") or "").strip()
                if text:
                    out.append(f"[assistant]\n{text}")
            elif ct == "tool":
                inp = json.dumps(e.get("input", {}), ensure_ascii=False)
                if len(inp) > 1500:
                    inp = inp[:1500] + "…(truncated)"
                out.append(f"[tool call] {e.get('toolName')}: {inp}")
                output = e.get("output")
                output = (
                    json.dumps(output, ensure_ascii=False)
                    if isinstance(output, (dict, list))
                    else str(output)
                )
                if len(output) > MAX_TOOL_RESULT_CHARS:
                    output = output[:MAX_TOOL_RESULT_CHARS] + "…(truncated)"
                out.append(f"[tool result] {output}")
        elif t == "error":
            err = e.get("error") or {}
            out.append(f"[driver error] {err.get('message') or err}")
        elif t == "done":
            out.append(f"[session ended] reason={e.get('reason')}")
    return _cap("\n\n".join(out))
