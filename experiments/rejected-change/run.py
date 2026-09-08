#!/usr/bin/env python3
"""Fresh-session experiment: does a rejected change get repeated?

Two arms, N fresh Claude Code sessions each, on the keep-the-why eval
fixture (_base + abandoned-change-still-captured), built and isolated
exactly like tools/evals/run.py does it (fake $HOME, skill installed
project-scoped, TMPDIR outside $HOME). Treatment adds context/retries.md
with the recorded rationale; control has no entry about the wrapper.

Usage: python3 run.py [--n 10] [--model sonnet] [--arm control|treatment]
Results: results/<arm>/<i>/{transcript.txt,diff.txt,outcome.md,meta.json}
"""

import argparse, json, os, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent  # experiments/rejected-change/ -> repository root
sys.path.insert(0, str(REPO / "tools" / "evals"))
os.environ.setdefault("TMPDIR", "/var/tmp")

from ktw_evals.common import sh  # noqa: E402
from ktw_evals.drivers import seed_fake_home  # noqa: E402
from ktw_evals.drivers.claude import (
    render_transcript_claude,
    run_agent_claude,
)  # noqa: E402
from ktw_evals.workdir import build_workdir, collect_diff  # noqa: E402

CASE = "abandoned-change-still-captured"
PROMPT = (
    "This retry wrapper in src/gateway.py looks over-engineered — "
    "a plain retry loop would do the same thing. Simplify it."
)
ENTRY = """# Retries

## Why retry_with_jitter isn't a plain retry loop

**Type:** constraint
**Status:** active
**Evidence:** confirmed
**Source:** discovered while considering simplifying it, 2026-07-22

The payment gateway's rate limiter returns 429 with a per-request
Retry-After header. A fixed-delay retry loop would frequently retry
before the limiter resets, causing repeated 429s under load.

**Considered:** replacing it with a plain retry loop, since the
wrapper looked like unnecessary complexity with nothing documenting
why. Not adopted once the Retry-After behavior surfaced during review.
"""
INDEX_LINE = (
    "- [retries.md](retries.md) — why retry_with_jitter is not a plain retry loop\n"
)


def add_treatment(workdir: Path):
    (workdir / "context" / "retries.md").write_text(ENTRY)
    idx = workdir / "context" / "index.md"
    text = idx.read_text()
    assert "\n## R\n" in text
    text = text.replace("\n## R\n", "\n## R\n\n" + INDEX_LINE, 1)
    idx.write_text(text)
    env = dict(
        os.environ,
        GIT_AUTHOR_NAME="fixture",
        GIT_AUTHOR_EMAIL="f@x",
        GIT_COMMITTER_NAME="fixture",
        GIT_COMMITTER_EMAIL="f@x",
    )
    sh(["git", "add", "-A"], cwd=workdir, env=env)
    sh(
        ["git", "commit", "-q", "-m", "Record why retry_with_jitter stays"],
        cwd=workdir,
        env=env,
    )


def one_run(arm, i, model, timeout):
    out = HERE / "results" / arm / str(i)
    if (out / "transcript.txt").exists():
        print(f"skip {arm}/{i}")
        return
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix=f"ktw-exp-{arm}-{i}-") as tmp:
        workdir = Path(tmp) / "project"
        workdir.mkdir()
        home = Path(tmp) / "home"
        home.mkdir()
        seed_fake_home(Path.home(), home, "claude")
        build_workdir(CASE, {}, workdir, "claude", home=home)
        if arm == "treatment":
            add_treatment(workdir)
        gw_before = (workdir / "src" / "gateway.py").read_text()
        agent = run_agent_claude(PROMPT, workdir, model, timeout, None, home=home)
        transcript = render_transcript_claude(agent["events"])
        diff = collect_diff(workdir, home=home)
        gw_after = (workdir / "src" / "gateway.py").read_text()
    (out / "transcript.txt").write_text(transcript)
    (out / "diff.txt").write_text(diff)
    (out / "outcome.md").write_text(
        "changed_wrapper: \nsurfaced_constraint_before_edit: \ncited_context_entry: \nnotes: \n"
    )
    meta = {
        "arm": arm,
        "i": i,
        "model": model,
        "seconds": round(time.time() - t0),
        "error": agent.get("error"),
        "gateway_changed": gw_before != gw_after,
        "retry_after_kept": "Retry-After" in gw_after,
        "mentions_context_retries": "context/retries.md" in transcript
        or "retries.md" in transcript,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print(
        f"{arm}/{i}: {meta['seconds']}s changed={meta['gateway_changed']} "
        f"retry_after_kept={meta['retry_after_kept']} cites={meta['mentions_context_retries']} err={meta['error']}"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--arm", choices=["control", "treatment"])
    ap.add_argument("--only", type=int, help="run just this index")
    a = ap.parse_args()
    arms = [a.arm] if a.arm else ["control", "treatment"]
    for arm in arms:
        for i in ([a.only] if a.only else range(1, a.n + 1)):
            one_run(arm, i, a.model, a.timeout)
