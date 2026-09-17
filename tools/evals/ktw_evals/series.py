"""Judge a series of full runs as a whole.

A single full run is 88 samples of a sampled agent graded by a sampled judge;
at a per-case pass rate around 98–99 % a clean 88/88 is the exception, and
three in a row is dice. What a release series has to show is that no case is
*reliably* broken and no run is broadly off:

- gate, per case: every case passes at least ``min_passes`` of the runs
  (default 2 of 3) — a case that fails twice in the same series is a wording
  problem, a case that fails once is variance;
- limit, per run: no run has more than ``max_flips_per_run`` failed cases
  (default 1).

Both are reported separately, because they fail for different reasons.
"""

import json
from pathlib import Path


def load_run(results_dir):
    """The ``cases`` block of a run's ``summary.json``: {case id: record}."""
    return json.loads((Path(results_dir) / "summary.json").read_text())["cases"]


def judge_series(runs, min_passes=2, max_flips_per_run=1):
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
        lines.append(f"  {verdicts.count('pass')}/{n}  {cid}  ({', '.join(verdicts)})")
    gate = "PASS" if result["gate_ok"] else "FAIL — " + ", ".join(result["below_gate"])
    lines.append(f"gate (every case passes >= {result['min_passes']} of {n}): {gate}")
    limit = "PASS" if result["run_limit_ok"] else "FAIL"
    lines.append(
        f"run limit (<= {result['max_flips_per_run']} failed case(s) per run): {limit}"
    )
    return "\n".join(lines)
