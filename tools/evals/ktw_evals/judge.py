"""The LLM judge: always Claude, regardless of --driver, so grading criteria
stay constant across drivers."""

import hashlib
import json
import os
import re
import subprocess
import tempfile

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
- Every specific factual claim in "reasoning" (a command run, a message \
shown, a file checked, a quoted detail) must be something you can point to \
verbatim in the transcript or diff below — a prior run of this judge \
fabricated a specific tool detail that appeared in none of the real \
transcripts it was grading (see docs/evals.md). If you're inferring rather \
than quoting, say so explicitly instead of stating it as observed fact.

- Break the expected behavior into its individual requirements first — \
typically three to eight: each thing the agent must do, must not do, or must \
say. Grade each one on its own, with the piece of transcript or diff that \
decides it. The verdict follows from the core requirements; the score from \
all of them.
- A score below 10 must be accounted for: one "deductions" entry per point \
withheld, naming the requirement it comes from and the evidence. A 10 has \
an empty list. A reader of a 9 must be able to see the missing point without \
re-reading the transcript.

Do not use any tools — everything needed is in this prompt. Return ONLY a \
JSON object, no markdown fences, with exactly these keys:
{"verdict": "pass" or "fail",
 "score": 0-10 (10 = fully matches expected behavior),
 "reasoning": "2-5 sentences citing concrete evidence from transcript/diff",
 "expectations": [{"expectation": "one requirement from the expected behavior, in a few words",
                   "met": true or false,
                   "evidence": "the transcript/diff detail that decides it, quoted or described"}, ...],
 "deductions": ["one entry per point below 10: requirement + evidence", ...],
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

# The instrument, named. A run records this next to the resolved judge model:
# a verdict is only comparable with another one graded by the same prompt and
# the same model, and an alias like "sonnet" says nothing about either.
JUDGE_PROMPT_SHA = hashlib.sha256(JUDGE_PROMPT.encode()).hexdigest()[:12]


USAGE_FIELDS = (
    "input_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
    "output_tokens",
    "thinking_tokens",
    "ttft_ms",
    "duration_api_ms",
    "total_cost_usd",
    "service_tier",
)


def session_usage(events):
    """What the session cost and how long the model took, from the CLI's
    `result` event: token counts (thinking tokens separately — the number
    that says whether the model reasoned less, not only whether it did
    less), time to first token and API time (a load signal), the service
    tier, and the model the vendor calls canonical. Every value None when
    there is no result event — a driver that doesn't emit one, a crashed run.

    Why: on 2026-09-21 the same model id did half the work per case for one
    evening. Turns and tool calls showed *that* the instrument had changed;
    thinking tokens would have shown *how* — a lowered reasoning budget
    reads as fewer thinking tokens per turn, a different model build does
    not — and ttft would have said whether the servers were under load."""
    out = {k: None for k in USAGE_FIELDS}
    out["canonical_model"] = None
    out["thinking_tokens_models"] = None  # "reported/total" when modelUsage exists
    for ev in events or []:
        if not (isinstance(ev, dict) and ev.get("type") == "result"):
            continue
        usage = ev.get("usage") or {}
        for k in (
            "input_tokens",
            "cache_read_input_tokens",
            "cache_creation_input_tokens",
            "output_tokens",
            "service_tier",
        ):
            out[k] = usage.get(k)
        out["thinking_tokens"] = (usage.get("output_tokens_details") or {}).get(
            "thinking_tokens"
        )
        for k in ("ttft_ms", "duration_api_ms", "total_cost_usd"):
            out[k] = ev.get(k)
        models = ev.get("modelUsage") or {}
        if out["thinking_tokens"] is None and models:
            # Sum what was reported; a model that reports no thinkingTokens
            # is not a model that thought for zero tokens. No report at all
            # stays None — missing telemetry must not read as a measured
            # zero, or the drift signal this field exists for is fiction.
            reported = [
                m["thinkingTokens"]
                for m in models.values()
                if isinstance(m, dict) and m.get("thinkingTokens") is not None
            ]
            out["thinking_tokens"] = sum(reported) if reported else None
            out["thinking_tokens_models"] = f"{len(reported)}/{len(models)}"
        canon = sorted(
            {
                m.get("canonicalModel")
                for m in models.values()
                if isinstance(m, dict) and m.get("canonicalModel")
            }
        )
        out["canonical_model"] = ", ".join(canon) if canon else None
        break
    return out


def resolved_model(events):
    """The model id the CLI actually ran, from its `system`/`init` event.

    `--model sonnet` is an alias the vendor may point somewhere else; the init
    event carries what it resolved to. None when there is no such event (a
    driver that doesn't emit one, an older CLI, a crashed run)."""
    for ev in events or []:
        if (
            isinstance(ev, dict)
            and ev.get("type") == "system"
            and ev.get("subtype") == "init"
            and ev.get("model")
        ):
            return ev["model"]
    return None


def judge(case, transcript, diff, model, timeout):
    prompt = (
        JUDGE_PROMPT.replace("{PROMPT}", case["prompt"])
        .replace("{EXPECTED}", case["expected_behavior"])
        .replace("{TRANSCRIPT}", transcript or "(empty transcript)")
        .replace("{DIFF}", diff or "(no changes)")
    )
    cmd = [
        "claude",
        "-p",
        prompt,
        "--model",
        model,
        "--output-format",
        "json",
        "--max-turns",
        "4",
    ]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    last_error = None
    for _attempt in range(2):
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                timeout=timeout,
                cwd=tempfile.gettempdir(),
            )
        except subprocess.TimeoutExpired:
            last_error = "judge timeout"
            continue
        try:
            data = json.loads(proc.stdout)
            model_resolved = resolved_model(data) if isinstance(data, list) else None
            if isinstance(data, list):  # newer CLIs emit the event list here
                result = next(
                    (
                        ev.get("result", "")
                        for ev in data
                        if isinstance(ev, dict) and ev.get("type") == "result"
                    ),
                    "",
                )
            else:
                result = data.get("result", "")
            match = re.search(r"\{.*\}", result, re.DOTALL)
            verdict = json.loads(match.group(0))
            if verdict.get("verdict") not in ("pass", "fail"):
                raise ValueError(f"bad verdict value: {verdict.get('verdict')!r}")
            # The granular fields are new; a judge that omits them (an older
            # cached prompt, a truncated answer) still yields a usable verdict.
            verdict.setdefault("expectations", [])
            verdict.setdefault("deductions", [])
            verdict.setdefault("violations", [])
            if not isinstance(verdict["expectations"], list):
                verdict["expectations"] = []
            verdict["judge_model_resolved"] = model_resolved
            return verdict
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            last_error = f"unparseable judge output ({e}): {proc.stdout[:1000]}"
    return {"verdict": "error", "reasoning": last_error}
