"""Per-run results directory: the rate-limit sentinel, stored verdicts, and
the summary.json / summary.md written after every pass."""

import datetime
import json
import re

from .common import skill_version
from .drivers import DRIVER_LABELS, PERMISSION_BYPASS

# Matches the CLI's own plain-text account-limit messages (observed so far:
# "You've hit your session limit · resets ..." and "You've hit your monthly
# spend limit.") — these are normal, successful responses as far as the CLI
# is concerned (exit 0, real turns), not exceptions, so this has to be caught
# by content, not by return code. Deliberately anchored on "hit your ... limit"
# (first-person, about the account itself) rather than a bare "rate limit" or
# "usage limit" substring, which could otherwise false-positive on legitimate
# fixture content that discusses a gateway's own rate limiter.
RATE_LIMIT_RE = re.compile(r"hit your [\w ]{0,25}\blimit\b", re.IGNORECASE)


def rate_limit_sentinel(results_dir):
    return results_dir / ".rate_limited"


def load_resolved(case_id, results_dir):
    """A previously stored pass/fail verdict for this case, if there is one.

    Resolved means final: nothing further will change it by re-running.
    error/rate_limited are deliberately NOT resolved — those are exactly the
    outcomes a retry is supposed to replace with a real verdict. A stored
    pass/fail whose transcript is actually just an account-limit message
    (possible from a run predating this check, or a judge that scored a
    limit artifact instead of recognizing it) is treated as unresolved too —
    self-healing rather than permanently locking in a contaminated result.
    """
    p = results_dir / f"{case_id}.json"
    if not p.exists():
        return None
    try:
        record = json.loads(p.read_text())
    except json.JSONDecodeError:
        return None
    if record.get("verdict") not in ("pass", "fail"):
        return None
    if RATE_LIMIT_RE.search(record.get("transcript") or ""):
        return None
    return record


def write_summary(records, results_dir, args):
    version = skill_version()
    passed = [r for r in records if r["verdict"] == "pass"]
    failed = [r for r in records if r["verdict"] == "fail"]
    errored = [r for r in records if r["verdict"] not in ("pass", "fail")]
    restraint_counts = {}
    for r in records:
        cat = r.get("restraint_category")
        if cat:
            restraint_counts[cat] = restraint_counts.get(cat, 0) + 1
    # Four numbers that a single pass count runs together (docs/evals.md,
    # "What the numbers separate"): did the skill get loaded at all, did the
    # run complete, did the mechanical checks pass, did the judge pass it.
    graded = [r for r in records if r["verdict"] in ("pass", "fail")]
    completed = [r for r in graded if not r.get("ended_with_no_response")]
    with_checks = [r for r in graded if r.get("checks_passed") is not None]
    judged = [r for r in records if r.get("judge_verdict") in ("pass", "fail")]
    metrics = {
        "activation": {
            "loaded": sum(1 for r in graded if r.get("skill_loaded")),
            "of": len(graded),
        },
        "completion": {"completed": len(completed), "of": len(records)},
        "deterministic": {
            "passed": sum(1 for r in with_checks if r["checks_passed"]),
            "of": len(with_checks),
        },
        "judge": {
            "passed": sum(1 for r in judged if r["judge_verdict"] == "pass"),
            "of": len(judged),
        },
    }
    summary = {
        "skill_version": version,
        "driver": args.driver,
        "agent_model": args.model,
        "judge_model": args.judge_model,
        "permission_bypass": PERMISSION_BYPASS[args.driver],
        "date": datetime.date.today().isoformat(),
        "total": len(records),
        "passed": len(passed),
        "failed": len(failed),
        "errors": len(errored),
        "restraint_categories": restraint_counts,
        "metrics": metrics,
        "cases": {
            r["id"]: {
                "verdict": r["verdict"],
                "score": r.get("score"),
                "restraint_category": r.get("restraint_category"),
                "skill_loaded": r.get("skill_loaded"),
                "checks_passed": r.get("checks_passed"),
                "judge_verdict": r.get("judge_verdict"),
            }
            for r in records
        },
    }
    (results_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    lines = [
        f"# Eval run — {summary['date']}",
        "",
        f"Skill {version} · agent: {DRIVER_LABELS[args.driver]} (model `{args.model}`) · "
        f"judge: `{args.judge_model}` · permission bypass: `{PERMISSION_BYPASS[args.driver]}`",
        "",
        f"**{len(passed)}/{len(records)} passed** ({len(failed)} failed, {len(errored)} errors)",
        "",
        f"Skill loaded {metrics['activation']['loaded']}/{metrics['activation']['of']} · "
        f"completed {metrics['completion']['completed']}/{metrics['completion']['of']} · "
        f"deterministic checks {metrics['deterministic']['passed']}/{metrics['deterministic']['of']} · "
        f"judge pass {metrics['judge']['passed']}/{metrics['judge']['of']}",
        "",
    ]
    if restraint_counts:
        breakdown = ", ".join(
            f"{cat}: {n}" for cat, n in sorted(restraint_counts.items())
        )
        lines.append(
            f"Restraint categories (mechanical, not judge-scored): {breakdown}"
        )
        lines.append("")
    if failed or errored:
        lines.append("| Case | Verdict | Score | Notes |")
        lines.append("|---|---|---|---|")
        for r in failed + errored:
            note = (r.get("reasoning") or "").replace("\n", " ")[:200]
            lines.append(
                f"| {r['id']} | {r['verdict']} | {r.get('score', '—')} | {note} |"
            )
    (results_dir / "summary.md").write_text("\n".join(lines) + "\n")
    return summary
