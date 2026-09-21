#!/usr/bin/env python3
"""Re-grade stored runs with the judge only: `regrade.py <results-dir>... --out DIR`.

Separates the judge changing its mind from the agent doing something
different — see `ktw_evals/regrade.py`. Resumable: a record already re-graded
`--times` times in `--out` is skipped.
"""

import argparse
import json
import sys
from pathlib import Path

from ktw_evals.cases import load_cases
from ktw_evals.regrade import render, run, summarize


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("results_dirs", nargs="+", help="results dirs of stored runs")
    ap.add_argument("--out", required=True, help="where the re-grades are kept")
    ap.add_argument(
        "--select",
        choices=("fails", "passes", "all"),
        default="fails",
        help="which stored records to re-grade (default: fails)",
    )
    ap.add_argument("--times", type=int, default=5, help="re-grades per record")
    ap.add_argument("--judge-model", default="sonnet")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--parallel", type=int, default=4)
    ap.add_argument(
        "--changed-since",
        default="",
        help="comma-separated case ids whose expectation text changed after "
        "some of these records were graded; listed in the summary",
    )
    ap.add_argument(
        "--summary-only",
        action="store_true",
        help="no judge calls: summarize what is already in --out",
    )
    args = ap.parse_args()
    cases_by_id = {c["id"]: c for c in load_cases(None)}
    out = Path(args.out)
    if args.summary_only:
        results = [
            json.loads(f.read_text())
            for f in sorted(out.glob("*.json"))
            if f.name != "summary.json"
        ]
    else:
        results = run(
            args.results_dirs,
            out,
            cases_by_id,
            args.select,
            args.times,
            args.judge_model,
            args.timeout,
            args.parallel,
            log=lambda m: print(m, flush=True),
        )
    summary = summarize(results, [c for c in args.changed_since.split(",") if c])
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    print(render(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
