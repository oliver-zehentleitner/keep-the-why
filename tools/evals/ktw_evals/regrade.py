"""Re-grade stored runs: the judge again, the agent not.

A failed case is two samples deep — a sampled agent, then a sampled judge —
and a verdict alone doesn't say which of the two drew badly. Every result
record keeps the transcript and the disk changes the judge saw, so the judge
can be asked again about the *same* frozen behaviour, several times:

- five times "fail" on a stored failure: the agent did something wrong;
- a mix of "pass" and "fail" on the same record: the judge is unstable on
  this case, and the thing to fix is the expectation text, not the skill.

The numbers this yields are the judge's self-agreement — overall, on stored
passes, on stored failures — and the list of cases it wobbles on. Without
them, a wording change made in response to a failure may be a fix for noise.

Re-grading uses the case's *current* `expected_behavior` from evals.json, the
instrument as it is today. A record graded under an older expectation text
may therefore legitimately come out differently; `changed_since` marks the
cases to read with that in mind.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .judge import judge


def select_records(results_dirs, mode, cases_by_id):
    """(results dir, case id, record) for every stored record `mode` wants.

    fails   every record whose stored verdict is "fail"
    passes  every record whose stored verdict is "pass"
    all     both
    """
    picked = []
    for d in results_dirs:
        d = Path(d)
        for f in sorted(d.glob("*.json")):
            if f.name.startswith("summary"):
                continue
            rec = json.loads(f.read_text())
            if rec.get("id") not in cases_by_id:
                continue
            verdict = rec.get("verdict")
            if verdict not in ("pass", "fail"):
                continue
            if mode == "all" or (mode == "fails") == (verdict == "fail"):
                picked.append((d, rec["id"], rec))
    return picked


def original_judge_verdict(rec):
    """What the judge itself said at the time, where that is known.

    With --judge-always the judge's own verdict sits in `judge_verdict` even
    when a deterministic check decided the case; without it, the final
    verdict is the judge's only when no check failed.
    """
    if rec.get("judge_verdict") in ("pass", "fail"):
        return rec["judge_verdict"]
    if rec.get("checks_passed") is False:
        return None
    return rec.get("verdict")


def regrade_record(case, rec, times, model, timeout, retry_sleep, max_wait_s):
    """`times` fresh judge verdicts on one stored record.

    A judge error (timeout, unparseable output, an expired login) is not a
    verdict: it is retried after `retry_sleep` seconds until `max_wait_s` is
    used up, so an unattended night run survives an outage.
    """
    out, waited = [], 0
    while len(out) < times:
        v = judge(case, rec.get("transcript"), rec.get("disk_changes"), model, timeout)
        if v.get("verdict") in ("pass", "fail"):
            out.append({"verdict": v["verdict"], "score": v.get("score")})
            continue
        if waited >= max_wait_s:
            out.append({"verdict": "error", "score": None})
            continue
        time.sleep(retry_sleep)
        waited += retry_sleep
    return out


def run(
    results_dirs,
    out_dir,
    cases_by_id,
    mode,
    times,
    model,
    timeout,
    parallel,
    retry_sleep=60,
    max_wait_s=6 * 3600,
    log=print,
):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = select_records(results_dirs, mode, cases_by_id)
    log(f"{len(todo)} record(s) x {times} re-grade(s) -> {out_dir}")

    def work(item):
        d, cid, rec = item
        target = out_dir / f"{d.name}__{cid}.json"
        if target.exists():
            done = json.loads(target.read_text())
            if len(done.get("regrades", [])) >= times:
                return done
        regrades = regrade_record(
            cases_by_id[cid], rec, times, model, timeout, retry_sleep, max_wait_s
        )
        result = {
            "id": cid,
            "source": d.name,
            "stored_verdict": rec.get("verdict"),
            "stored_judge_verdict": original_judge_verdict(rec),
            "checks_passed": rec.get("checks_passed"),
            "regrades": regrades,
        }
        target.write_text(json.dumps(result, indent=2))
        log(
            f"  {d.name}  {cid}  stored judge: {result['stored_judge_verdict']}"
            f"  now: {' '.join(r['verdict'] for r in regrades)}"
        )
        return result

    with ThreadPoolExecutor(max_workers=parallel) as pool:
        results = list(pool.map(work, todo))
    return results


def summarize(results, changed_since=()):
    """Self-agreement of the judge over the re-graded records."""

    def verdicts(r):
        return [g["verdict"] for g in r["regrades"] if g["verdict"] in ("pass", "fail")]

    graded = [r for r in results if verdicts(r)]
    unanimous = [r for r in graded if len(set(verdicts(r))) == 1]
    split = [r for r in graded if len(set(verdicts(r))) > 1]

    def agreement(rs):
        pairs = [
            (r["stored_judge_verdict"], v)
            for r in rs
            if r["stored_judge_verdict"] in ("pass", "fail")
            for v in verdicts(r)
        ]
        return (sum(a == b for a, b in pairs), len(pairs))

    stored_pass = [r for r in graded if r["stored_judge_verdict"] == "pass"]
    stored_fail = [r for r in graded if r["stored_judge_verdict"] == "fail"]
    overturned = [
        r for r in stored_fail if verdicts(r).count("pass") > verdicts(r).count("fail")
    ]
    wobbly = {}
    for r in split:
        wobbly.setdefault(r["id"], []).append(
            f"{r['source']}: stored {r['stored_judge_verdict']}, now "
            + " ".join(verdicts(r))
        )
    return {
        "records": len(graded),
        "regrades": sum(len(verdicts(r)) for r in graded),
        "errors": sum(
            1 for r in results for g in r["regrades"] if g["verdict"] == "error"
        ),
        "unanimous_records": len(unanimous),
        "split_records": len(split),
        "agreement_with_stored_pass": agreement(stored_pass),
        "agreement_with_stored_fail": agreement(stored_fail),
        "stored_failures_overturned_by_majority": sorted(
            f"{r['source']}  {r['id']}" for r in overturned
        ),
        "wobbly_cases": wobbly,
        "changed_since": sorted(set(changed_since) & {r["id"] for r in graded}),
    }


def render(summary):
    def pct(pair):
        n, of = pair
        return f"{n}/{of}" + (f" ({100 * n / of:.1f} %)" if of else "")

    lines = [
        f"records re-graded: {summary['records']}  "
        f"(re-grades: {summary['regrades']}, judge errors: {summary['errors']})",
        f"judge unanimous with itself: {summary['unanimous_records']} records, "
        f"split: {summary['split_records']}",
        "re-grades agreeing with the stored judge verdict — "
        f"on stored passes: {pct(summary['agreement_with_stored_pass'])}, "
        f"on stored failures: {pct(summary['agreement_with_stored_fail'])}",
    ]
    if summary["stored_failures_overturned_by_majority"]:
        lines.append("stored failures a majority of re-grades would have passed:")
        lines += [f"  {x}" for x in summary["stored_failures_overturned_by_majority"]]
    if summary["wobbly_cases"]:
        lines.append("cases the judge is split on (same record, different verdicts):")
        for cid, notes in sorted(summary["wobbly_cases"].items()):
            lines.append(f"  {cid}")
            lines += [f"    {n}" for n in notes]
    if summary["changed_since"]:
        lines.append(
            "expectation text changed since some of these records were graded: "
            + ", ".join(summary["changed_since"])
        )
    return "\n".join(lines)
