#!/usr/bin/env python3
"""Judge a series of full runs: `series.py <results-dir> <results-dir> <results-dir>`.

Exit code 0 when the per-case gate, the per-run limit and the guards all
hold, 1 otherwise. See `ktw_evals/series.py` for what the two mean and why a release
is measured this way rather than by a clean pass count.
"""

import argparse
import sys

from ktw_evals.cases import load_cases
from ktw_evals.series import guard_labels, judge_series, load_run, render


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("results_dirs", nargs="+", help="one results dir per full run")
    ap.add_argument("--min-passes", type=int, default=2)
    ap.add_argument("--max-flips-per-run", type=int, default=1)
    args = ap.parse_args()
    result = judge_series(
        [load_run(d) for d in args.results_dirs],
        min_passes=args.min_passes,
        max_flips_per_run=args.max_flips_per_run,
        guards=guard_labels(load_cases(None)),
    )
    print(render(result))
    ok = result["gate_ok"] and result["run_limit_ok"] and result["guards_ok"]
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
