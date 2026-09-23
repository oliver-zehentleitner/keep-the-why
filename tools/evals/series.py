#!/usr/bin/env python3
"""Judge a series of full runs: `series.py <results-dir> <results-dir> <results-dir>`.

With `--version X.Y.Z --record` the series is also written into
`tools/evals/history.json` (commit it with the release measurement), so the
next series can print every flipped case's record next to it.

Exit code 0 when the per-case gate, the per-run limit, the guards and the
completeness check all hold, 1 otherwise. Completeness: every run carries
exactly the suite's cases (evals.json) and the series has three runs — an
empty or half-finished run is not a release measurement. `--partial` judges
whatever cases the runs contain instead, for a deliberate subset; a partial
series cannot be recorded. See `ktw_evals/series.py` for what the rules mean
and why a release is measured this way rather than by a clean pass count.
"""

import argparse
import datetime
import json
import sys
from pathlib import Path

from ktw_evals.cases import load_cases
from ktw_evals.series import (
    guard_labels,
    judge_series,
    load_history,
    load_run,
    record_series,
    render,
)

HISTORY_JSON = Path(__file__).resolve().parent / "history.json"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("results_dirs", nargs="+", help="one results dir per full run")
    ap.add_argument("--min-passes", type=int, default=2)
    ap.add_argument("--max-flips-per-run", type=int, default=1)
    ap.add_argument("--version", help="the release this series measures")
    ap.add_argument("--date", help="date of the series (default: today)")
    ap.add_argument(
        "--record",
        action="store_true",
        help="write the series into history.json (needs --version)",
    )
    ap.add_argument(
        "--expect-runs",
        type=int,
        default=3,
        help="how many full runs a release series has (default 3)",
    )
    ap.add_argument(
        "--partial",
        action="store_true",
        help="judge only the cases the runs contain — a deliberate subset, "
        "not a release measurement; cannot be combined with --record",
    )
    args = ap.parse_args()
    if args.record and not args.version:
        ap.error("--record needs --version")
    if args.record and args.partial:
        ap.error("--partial is not a release measurement and cannot be recorded")
    runs = [load_run(d) for d in args.results_dirs]
    history = load_history(HISTORY_JSON)
    cases = load_cases(None)
    result = judge_series(
        runs,
        min_passes=args.min_passes,
        max_flips_per_run=args.max_flips_per_run,
        guards=guard_labels(cases),
        history=history,
        version=args.version,
        expected_ids=None if args.partial else [c["id"] for c in cases],
        expected_runs=None if args.partial else args.expect_runs,
    )
    print(render(result))
    if args.record and not result["complete_ok"]:
        print("not recorded: the series is incomplete", file=sys.stderr)
        return 1
    if args.record:
        date = args.date or datetime.date.today().isoformat()
        record_series(history, args.version, date, runs)
        HISTORY_JSON.write_text(json.dumps(history, indent=1) + "\n")
        print(f"recorded {args.version} in {HISTORY_JSON.name}")
    ok = (
        result["gate_ok"]
        and result["run_limit_ok"]
        and result["guards_ok"]
        and result["complete_ok"]
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
