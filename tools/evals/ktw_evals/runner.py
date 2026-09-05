"""Running cases: one case end to end (fixture -> agent -> judge -> record),
one pass over every unresolved case, and the retry loop around passes."""

import concurrent.futures
import datetime
import json
import tempfile
import time
from pathlib import Path

from .analysis import restraint_analysis, skill_load_found, skill_load_position
from .checks import run_checks
from .cases import read_case_config
from .drivers import (
    AGENT_RUNNERS,
    PERMISSION_BYPASS,
    TRANSCRIPT_RENDERERS,
    build_prompt,
    seed_fake_home,
)
from .judge import judge
from .results import RATE_LIMIT_RE, load_resolved, rate_limit_sentinel, write_summary
from .workdir import build_workdir, collect_diff


def _checks_verdict(failed):
    return {
        "verdict": "fail",
        "score": 0,
        "reasoning": "Deterministic check(s) failed: "
        + "; ".join(f"{c['check']} — {c['detail']}" for c in failed)
        + ".",
        "violations": [f"{c['check']}: {c['detail']}" for c in failed],
    }


def run_case(case, args, results_dir):
    case_id = case["id"]
    sentinel = rate_limit_sentinel(results_dir)
    if sentinel.exists():
        # Another case in this same pass already hit the account's own
        # session/usage limit — every further attempt would just hit the same
        # wall at real API cost. Skip outright, no workdir, no API call.
        record = {
            "id": case_id,
            "verdict": "rate_limited",
            "score": None,
            "reasoning": "Skipped: an earlier case in this pass hit the account's session/usage limit.",
            "violations": [],
            "agent_model": args.model,
            "judge_model": args.judge_model,
            "driver": args.driver,
            "permission_bypass": PERMISSION_BYPASS[args.driver],
            "started": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "duration_s": 0,
            "transcript": "",
            "disk_changes": "",
            "disk_changed": None,
            "ended_with_no_response": None,
            "evidence_tool_calls_found": None,
            "evidence_claim": None,
            "restraint_category": None,
            "skill_loaded": None,
            "skill_loaded_at": None,
            "checks": [],
            "checks_passed": None,
            "judge_verdict": None,
        }
        (results_dir / f"{case_id}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False)
        )
        print(f"  skip   {case_id}  (rate-limited earlier in this pass)", flush=True)
        return record

    cfg = read_case_config(case_id)
    started = datetime.datetime.now(datetime.timezone.utc)
    with tempfile.TemporaryDirectory(prefix=f"ktw-eval-{case_id}-") as tmp:
        workdir = Path(tmp) / "project"
        workdir.mkdir()
        # Keep the Why's personal config now lives at ~/.keep-the-why/, outside
        # any project directory — without a scoped HOME, every case run on this
        # machine would read/write the operator's own real ~/.keep-the-why/
        # files instead of an isolated per-case one, breaking fixture isolation
        # and risking cross-contamination with the operator's actual personal
        # setup (this host already has one, for unrelated reasons — see
        # run_agent_omp's --no-skills comment). A fresh $HOME sibling to the
        # project dir keeps every filesystem-level lookup the agent's own
        # tools make (not just this project's files) inside the same
        # TemporaryDirectory that gets torn down with everything else — but a
        # genuinely *empty* one broke every claude run outright ("Not logged
        # in"), since that's also where the CLI's own login/config lives;
        # seed_fake_home() below copies just that driver's own real config
        # over first, so the fake $HOME is isolated for ~/.keep-the-why/
        # specifically, not for the CLI's ability to run at all.
        fake_home = Path(tmp) / "home"
        fake_home.mkdir()
        seed_fake_home(Path.home(), fake_home, args.driver)
        build_workdir(case_id, cfg, workdir, args.driver, home=fake_home)
        prompt = build_prompt(case["prompt"], args.driver, cfg)
        agent = AGENT_RUNNERS[args.driver](
            prompt,
            workdir,
            args.model,
            args.timeout,
            cfg.get("disallowed_tools"),
            home=fake_home,
        )
        transcript = TRANSCRIPT_RENDERERS[args.driver](agent["events"])
        diff = collect_diff(workdir, home=fake_home)
        # Deterministic checks need the workdir itself, so they run here,
        # before the TemporaryDirectory is torn down — evaluated regardless
        # of how the run ended; what they *mean* is decided below.
        checks = run_checks(case.get("checks") or [], workdir, fake_home, transcript)
    judge_verdict = None
    checks_passed = all(c["ok"] for c in checks) if checks else None
    skill_loaded = None
    skill_loaded_at = None
    if agent.get("error"):
        verdict = {"verdict": "error", "reasoning": agent["error"]}
        checks_passed = None  # no real run to check
        # A driver-level error (crash, timeout) means there's no real agent
        # behavior to categorize — an empty/partial transcript would
        # otherwise misclassify as e.g. "restrained" for the wrong reason.
        restraint = {
            k: None
            for k in (
                "disk_changed",
                "ended_with_no_response",
                "evidence_tool_calls_found",
                "evidence_claim",
                "restraint_category",
            )
        }
    elif RATE_LIMIT_RE.search(transcript):
        # A real, successful CLI response that just says the account is out
        # of quota. Don't spend a second API call having the judge grade it —
        # there's nothing to grade — and stop the rest of this pass early.
        sentinel.touch()
        verdict = {
            "verdict": "rate_limited",
            "reasoning": "Agent response indicated the account's session/usage limit was hit.",
        }
        checks_passed = None
        restraint = {
            k: None
            for k in (
                "disk_changed",
                "ended_with_no_response",
                "evidence_tool_calls_found",
                "evidence_claim",
                "restraint_category",
            )
        }
    else:
        skill_loaded_at = skill_load_position(transcript)
        skill_loaded = skill_loaded_at is not None
        restraint = restraint_analysis(transcript, diff)
        failed = [c for c in checks if not c["ok"]]
        if failed and not args.judge_always:
            # A deterministic check settles it; no judge call for a case
            # that already failed on something a machine can see.
            verdict = _checks_verdict(failed)
        else:
            verdict = judge(case, transcript, diff, args.judge_model, args.timeout)
            judge_verdict = verdict.get("verdict")
            if failed and verdict.get("verdict") in ("pass", "fail"):
                # --judge-always: the judge's view is kept in judge_verdict
                # (a pass here is a judge blind spot worth reading), but the
                # deterministic failure decides the case.
                verdict = {
                    **_checks_verdict(failed),
                    "reasoning": f"{_checks_verdict(failed)['reasoning']} "
                    f"Judge (advisory, --judge-always): {judge_verdict} — "
                    f"{verdict.get('reasoning')}",
                }
    record = {
        "id": case_id,
        "verdict": verdict.get("verdict"),
        "score": verdict.get("score"),
        "reasoning": verdict.get("reasoning"),
        "violations": verdict.get("violations", []),
        "agent_model": args.model,
        "judge_model": args.judge_model,
        "driver": args.driver,
        "permission_bypass": PERMISSION_BYPASS[args.driver],
        "started": started.isoformat(),
        "duration_s": round(
            (datetime.datetime.now(datetime.timezone.utc) - started).total_seconds()
        ),
        "transcript": transcript,
        "disk_changes": diff,
        **restraint,
        "skill_loaded": skill_loaded,
        "skill_loaded_at": skill_loaded_at,
        "checks": checks,
        "checks_passed": checks_passed,
        "judge_verdict": judge_verdict,
    }
    (results_dir / f"{case_id}.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False)
    )
    print(f"  {record['verdict']:<5}  {case_id}  ({record['duration_s']}s)", flush=True)
    return record


def execute_pass(cases, args, results_dir):
    """Run every not-yet-resolved case once; return (records, all_resolved)."""
    sentinel = rate_limit_sentinel(results_dir)
    sentinel.unlink(missing_ok=True)  # start this pass without a stale marker

    resolved, pending = [], []
    for c in cases:
        prior = load_resolved(c["id"], results_dir)
        (resolved if prior else pending).append(prior or c)

    if resolved:
        print(
            f"{len(resolved)} case(s) already resolved (pass/fail) — skipping",
            flush=True,
        )
    print(f"Running {len(pending)} case(s) → {results_dir}", flush=True)

    fresh = []
    if pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as pool:
            futures = {pool.submit(run_case, c, args, results_dir): c for c in pending}
            for fut in concurrent.futures.as_completed(futures):
                fresh.append(fut.result())

    order = {c["id"]: i for i, c in enumerate(cases)}
    records = sorted(resolved + fresh, key=lambda r: order[r["id"]])
    summary = write_summary(records, results_dir, args)
    all_resolved = all(r["verdict"] in ("pass", "fail") for r in records)
    return records, summary, all_resolved


def run_until_resolved(cases, args, results_dir):
    """The pass/retry loop behind a single --driver/--model run: one pass, and
    with --retry-until-complete further passes over whatever is still
    unresolved, until everything has a pass/fail verdict or --max-wait-hours
    runs out. Returns the process exit code (0 all passed, 1 failures or
    unresolved cases, 4 gave up waiting)."""
    deadline = time.monotonic() + args.max_wait_hours * 3600
    attempt = 0
    while True:
        attempt += 1
        now = datetime.datetime.now().strftime("%H:%M:%S")
        print(
            f"[{now}] pass {attempt}" + (" (retry)" if attempt > 1 else ""), flush=True
        )
        records, summary, all_resolved = execute_pass(cases, args, results_dir)

        if all_resolved or not args.retry_until_complete:
            print(
                f"\n{summary['passed']}/{summary['total']} passed "
                f"({summary['failed']} failed, {summary['errors']} errors) — see {results_dir}/summary.md",
                flush=True,
            )
            if not all_resolved:
                print(
                    f"NOTE: {summary['errors']} case(s) still unresolved (error/rate_limited) — "
                    f"re-run the same command (same --results-dir) to retry just those, "
                    f"or add --retry-until-complete.",
                    flush=True,
                )
            return 0 if summary["failed"] == 0 and summary["errors"] == 0 else 1

        remaining = summary["errors"]
        if time.monotonic() >= deadline:
            print(
                f"\n[{now}] --max-wait-hours ({args.max_wait_hours}h) exceeded with "
                f"{remaining} case(s) still unresolved — giving up for now. "
                f"Re-run the same command against {results_dir} later to pick up where this left off.",
                flush=True,
            )
            return 4

        # Two very different reasons a case can be unresolved, and they call
        # for very different waits. A rate_limited verdict means the account
        # itself is out of quota until its window resets — hours, so the long
        # interval. A plain error (the model's safety classifier refusing a
        # case, a driver crash, a timeout) is retriable right away; waiting
        # the full rate-limit interval for it cost up to 50 minutes of idle
        # time per full run before this distinction existed.
        rate_limited = any(r.get("verdict") == "rate_limited" for r in records)
        if rate_limited:
            interval, why = args.retry_interval, "rate-limited"
        else:
            interval, why = args.error_retry_interval, "error, not rate-limited"
        print(
            f"[{now}] {remaining} case(s) still unresolved ({why}) — "
            f"sleeping {interval}s before retrying",
            flush=True,
        )
        time.sleep(interval)
