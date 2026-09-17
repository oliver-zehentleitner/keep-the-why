#!/usr/bin/env python3
"""Judge a series of full runs: `series.py <results-dir> <results-dir> <results-dir>`.

Exit code 0 when both the per-case gate and the per-run limit hold, 1
otherwise. See `ktw_evals/series.py` for what the two mean and why a release
is measured this way rather than by a clean pass count.
"""

import argparse
import sys

from ktw_evals.series import judge_series, load_run, render


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
    )
    print(render(result))
    return 0 if result["gate_ok"] and result["run_limit_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
