"""The LLM judge: always Claude, regardless of --driver, so grading criteria
stay constant across drivers."""

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

Do not use any tools — everything needed is in this prompt. Return ONLY a \
JSON object, no markdown fences, with exactly these keys:
{"verdict": "pass" or "fail",
 "score": 0-10 (10 = fully matches expected behavior),
 "reasoning": "2-5 sentences citing concrete evidence from transcript/diff",
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
            return verdict
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            last_error = f"unparseable judge output ({e}): {proc.stdout[:1000]}"
    return {"verdict": "error", "reasoning": last_error}
