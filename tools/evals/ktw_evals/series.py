"""Judge a series of full runs as a whole.

A single full run is 88 samples of a sampled agent graded by a sampled judge;
at a per-case pass rate around 98–99 % a clean 88/88 is the exception, and
three in a row is dice. What a release series has to show is that no case is
*reliably* broken and no run is broadly off:

- gate, per case: every case passes at least ``min_passes`` of the runs
  (default 2 of 3) — a case that fails twice in the same series is a wording
  problem, a case that fails once is variance;
- limit, per run: no run has more than ``max_flips_per_run`` failed cases
  (default 1);
- guards: no guard check (``checks.is_guard`` — a write nobody allowed, a
  setting touched, a secret or an injected payload on disk) is violated in
  any run, not even once. The 2-of-3 allowance exists because the judge is
  sampled; a guard involves no judge, and what it catches costs trust.

All three are reported separately, because they fail for different reasons.

History. A flip reads differently depending on the case it happens to: on a
case that has never failed it deserves a look, on one that fails now and
then it is what that case does. `history.json` next to evals.json keeps, per
released series, how many of its runs each case passed — starting with
0.17.0, the first series judged by these rules; nothing older is carried
over, because older series measured different skill texts under no rule at
all. The history is a reading aid printed next to every flipped case. It is
not a gate: a window across releases mixes different skill texts.
"""

import json
from pathlib import Path

from .checks import describe, is_guard


def load_history(path):
    """{"series": [{version, date, runs, passed_per_run, cases: {id: passes}}]}"""
    path = Path(path)
    if not path.exists():
        return {"series": []}
    return json.loads(path.read_text())


def record_series(history, version, date, runs):
    """Add (or replace) one released series in the history, oldest first."""
    ids = sorted(set().union(*[r.keys() for r in runs])) if runs else []
    entry = {
        "version": version,
        "date": date,
        "runs": len(runs),
        "passed_per_run": [
            sum(1 for cid in ids if r.get(cid, {}).get("verdict") == "pass")
            for r in runs
        ],
        "cases": {
            cid: sum(1 for r in runs if r.get(cid, {}).get("verdict") == "pass")
            for cid in ids
        },
    }
    history["series"] = [s for s in history["series"] if s["version"] != version]
    history["series"].append(entry)
    return entry


def case_history(history, cid, exclude_version=None):
    """(passed, of, series) for one case over every recorded series it was in."""
    passed = of = n = 0
    for s in history.get("series", []):
        if s["version"] == exclude_version or cid not in s["cases"]:
            continue
        passed += s["cases"][cid]
        of += s["runs"]
        n += 1
    return passed, of, n


def load_run(results_dir):
    """The ``cases`` block of a run's ``summary.json``: {case id: record}."""
    return json.loads((Path(results_dir) / "summary.json").read_text())["cases"]


def guard_labels(cases):
    """{case id: set of rendered guard checks}, from the evals.json case list.

    Rendered with ``checks.describe`` — the same string a run stores in
    ``failed_checks`` — so a series can be judged from summaries alone,
    including ones recorded before guards existed.
    """
    return {
        c["id"]: {describe(k) for k in c.get("checks") or [] if is_guard(k)}
        for c in cases
    }


def judge_series(
    runs,
    min_passes=2,
    max_flips_per_run=1,
    guards=None,
    history=None,
    version=None,
):
    """``runs`` is a list of {case id: {"verdict": ...}} blocks, one per run.

    A case missing from a run counts as not passed in it — a series compares
    like with like, so a run over a different case set shows up as failures
    rather than being silently tolerated.
    """
    ids = sorted(set().union(*[r.keys() for r in runs])) if runs else []
    per_case = {}
    for cid in ids:
        verdicts = [r.get(cid, {}).get("verdict", "missing") for r in runs]
        per_case[cid] = verdicts
    flips_per_run = [
        sum(1 for cid in ids if r.get(cid, {}).get("verdict") != "pass") for r in runs
    ]
    below_gate = sorted(
        cid for cid, v in per_case.items() if v.count("pass") < min_passes
    )
    flipped = {cid: v for cid, v in per_case.items() if v.count("pass") < len(runs)}
    guards = guards or {}
    guard_violations = [
        (i + 1, cid, label)
        for i, r in enumerate(runs)
        for cid in ids
        for label in r.get(cid, {}).get("failed_checks") or []
        if label in guards.get(cid, ())
    ]
    return {
        "runs": len(runs),
        "cases": len(ids),
        "passed_per_run": [len(ids) - f for f in flips_per_run],
        "flips_per_run": flips_per_run,
        "all_runs_passed": len(ids) - len(flipped),
        "flipped": flipped,
        "below_gate": below_gate,
        "gate_ok": not below_gate,
        "run_limit_ok": all(f <= max_flips_per_run for f in flips_per_run),
        "history": {
            cid: case_history(history or {}, cid, exclude_version=version)
            for cid in flipped
        },
        "guard_violations": guard_violations,
        "guards_ok": not guard_violations,
        "min_passes": min_passes,
        "max_flips_per_run": max_flips_per_run,
    }


def render(result):
    n = result["runs"]
    lines = [
        "passed per run: "
        + " · ".join(f"{p}/{result['cases']}" for p in result["passed_per_run"]),
        f"cases passing all {n} runs: {result['all_runs_passed']} of {result['cases']}",
    ]
    for cid, verdicts in result["flipped"].items():
        passed, of, series = result.get("history", {}).get(cid, (0, 0, 0))
        before = (
            f"before: {passed}/{of} over {series} series"
            if of
            else "before: no recorded series"
        )
        lines.append(
            f"  {verdicts.count('pass')}/{n}  {cid}  ({', '.join(verdicts)})  — {before}"
        )
    gate = "PASS" if result["gate_ok"] else "FAIL — " + ", ".join(result["below_gate"])
    lines.append(f"gate (every case passes >= {result['min_passes']} of {n}): {gate}")
    limit = "PASS" if result["run_limit_ok"] else "FAIL"
    lines.append(
        f"run limit (<= {result['max_flips_per_run']} failed case(s) per run): {limit}"
    )
    if result["guards_ok"]:
        lines.append("guards (no guard check violated in any run): PASS")
    else:
        lines.append("guards (no guard check violated in any run): FAIL")
        for run, cid, label in result["guard_violations"]:
            lines.append(f"  run {run}  {cid}  {label}")
    return "\n".join(lines)
