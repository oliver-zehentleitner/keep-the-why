#!/usr/bin/env python3
"""Judge a series of full runs: `series.py <results-dir> <results-dir> <results-dir>`.

With `--version X.Y.Z --record` the series is also written into
`tools/evals/history.json` (commit it with the release measurement), so the
next series can print every flipped case's record next to it.

Exit code 0 when the per-case gate, the per-run limit and the guards all
hold, 1 otherwise. See `ktw_evals/series.py` for what the two mean and why a release
is measured this way rather than by a clean pass count.
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
    args = ap.parse_args()
    if args.record and not args.version:
        ap.error("--record needs --version")
    runs = [load_run(d) for d in args.results_dirs]
    history = load_history(HISTORY_JSON)
    result = judge_series(
        runs,
        min_passes=args.min_passes,
        max_flips_per_run=args.max_flips_per_run,
        guards=guard_labels(load_cases(None)),
        history=history,
        version=args.version,
    )
    print(render(result))
    if args.record:
        date = args.date or datetime.date.today().isoformat()
        record_series(history, args.version, date, runs)
        HISTORY_JSON.write_text(json.dumps(history, indent=1) + "\n")
        print(f"recorded {args.version} in {HISTORY_JSON.name}")
    ok = result["gate_ok"] and result["run_limit_ok"] and result["guards_ok"]
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
