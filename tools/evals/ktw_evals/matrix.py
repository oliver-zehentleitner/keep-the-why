"""--matrix: every driver x model combination, each an ordinary execute_pass,
plus the docs/agent-matrix.md-style table."""

import concurrent.futures
import copy
import datetime
import json
import sys
from pathlib import Path

from .analysis import RESTRAINT_CODES, RESTRAINT_LEGEND
from .cases import load_matrix_config
from .common import TOOL_DIR, skill_version
from .drivers import AGENT_RUNNERS, DRIVER_LABELS
from .runner import execute_pass


def _model_slug(model):
    """openrouter/z-ai/glm-5.3 -> z-ai-glm-5.3, for a results subdirectory name."""
    rest = model.split("/", 1)[1] if model.startswith("openrouter/") else model
    return rest.replace("/", "-")


def run_matrix(cases, args):
    """Run every driver x model combination in the matrix config (or the
    --matrix-drivers/--matrix-models override), and print a ready-to-paste
    docs/agent-matrix.md-style table. Each combination reuses execute_pass
    exactly as a normal single run would — same per-combination results
    directory, same resumability (a combination with only resolved cases on
    a re-run is skipped at the case level, same as any other --results-dir
    re-run), same exit-code convention. This is deliberately not a separate
    tool: the matrix is just many ordinary runs, so anything that makes a
    single run more correct (a driver fix, a new case) applies here for
    free, and the same command works unattended in CI.
    """
    config = load_matrix_config()
    drivers = (
        args.matrix_drivers.split(",") if args.matrix_drivers else config["drivers"]
    )
    unknown = [d for d in drivers if d not in AGENT_RUNNERS]
    if unknown:
        sys.exit(f"unknown driver(s) in matrix: {', '.join(unknown)}")

    if args.matrix_models:
        models = [{"id": m, "label": m} for m in args.matrix_models.split(",")]
    else:
        models = config["models"]

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    matrix_dir = (
        Path(args.results_dir)
        if args.results_dir
        else TOOL_DIR / "results" / f"{stamp}-matrix"
    )
    matrix_dir.mkdir(parents=True, exist_ok=True)

    combos = [
        (driver, model["id"], model["label"]) for driver in drivers for model in models
    ]
    print(
        f"Matrix: {len(drivers)} driver(s) x {len(models)} model(s) = "
        f"{len(combos)} combination(s) → {matrix_dir}",
        flush=True,
    )

    def run_one(driver, model_id):
        sub_args = copy.copy(args)
        sub_args.driver = driver
        sub_args.model = model_id
        sub_dir = matrix_dir / f"{driver}-{_model_slug(model_id)}"
        sub_dir.mkdir(parents=True, exist_ok=True)
        _records, summary, all_resolved = execute_pass(cases, sub_args, sub_dir)
        return driver, model_id, summary, all_resolved

    results = {}
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=args.matrix_parallel
    ) as pool:
        futures = [pool.submit(run_one, d, m) for d, m, _label in combos]
        for fut in concurrent.futures.as_completed(futures):
            driver, model_id, summary, all_resolved = fut.result()
            results[(driver, model_id)] = (summary, all_resolved)
            status = "resolved" if all_resolved else "UNRESOLVED"
            print(
                f"  [{status}] {driver} / {model_id}: "
                f"{summary['passed']}/{summary['total']} passed",
                flush=True,
            )

    version = skill_version()
    date = datetime.date.today().isoformat()

    def cell(driver, model_id):
        summary, all_resolved = results[(driver, model_id)]
        if summary["total"] == 0:
            return "–"
        # Single-case matrix runs (the common case) collapse to one verdict;
        # multi-case runs show an aggregate pass count instead of a score.
        if summary["total"] == 1:
            case = next(iter(summary["cases"].values()))
            verdict, score = case["verdict"], case.get("score")
            if verdict not in ("pass", "fail"):
                return f"⚠️ {verdict}"
            mark = "✅" if verdict == "pass" else "❌"
            score_part = f"{score}/10" if score is not None else verdict
            # restraint_category is mechanical (see restraint_analysis), not
            # judge-scored — shown as a bracketed code so a passing score
            # can't quietly hide e.g. the file having actually been deleted
            # (the real bug this caught on the old Cline column).
            category = case.get("restraint_category")
            code_part = (
                f" [{RESTRAINT_CODES[category]}]" if category in RESTRAINT_CODES else ""
            )
            return f"{mark} {score_part}{code_part} · v{version} · {date}"
        mark = (
            "✅"
            if all_resolved and summary["failed"] == 0
            else "❌" if all_resolved else "⚠️"
        )
        cats = [
            c.get("restraint_category")
            for c in summary["cases"].values()
            if c.get("restraint_category") in RESTRAINT_CODES
        ]
        breakdown = ""
        if cats:
            counts = {}
            for c in cats:
                counts[c] = counts.get(c, 0) + 1
            breakdown = (
                " ["
                + " ".join(
                    f"{RESTRAINT_CODES[c]}{n}" for c, n in sorted(counts.items())
                )
                + "]"
            )
        return f"{mark} {summary['passed']}/{summary['total']}{breakdown} · v{version} · {date}"

    lines = [
        f"# Matrix run — {date}",
        "",
        f"Skill {version} · judge: `{args.judge_model}` · "
        f"{len(drivers)} driver(s) × {len(models)} model(s)",
        "",
        f"Restraint codes (mechanical, not judge-scored): {RESTRAINT_LEGEND}",
        "",
        "| Model | " + " | ".join(DRIVER_LABELS[d] for d in drivers) + " |",
        "|---|" + "---|" * len(drivers),
    ]
    for model in models:
        row = [cell(d, model["id"]) for d in drivers]
        lines.append(f"| {model['label']} | " + " | ".join(row) + " |")
    table_md = "\n".join(lines) + "\n"

    (matrix_dir / "matrix-summary.md").write_text(table_md)
    (matrix_dir / "matrix-summary.json").write_text(
        json.dumps(
            {
                "skill_version": version,
                "date": date,
                "drivers": drivers,
                "models": [m["id"] for m in models],
                "results": {
                    f"{d}/{m}": {"summary": s, "resolved": r}
                    for (d, m), (s, r) in results.items()
                },
            },
            indent=2,
        )
    )

    print(
        f"\n{table_md}\nSaved to {matrix_dir}/matrix-summary.md — paste rows (and the "
        f"restraint-codes legend line) into docs/agent-matrix.md by hand (that page "
        f"also has hand-written prose this doesn't touch).",
        flush=True,
    )

    all_ok = all(r for _s, r in results.values()) and all(
        s["failed"] == 0 for s, _r in results.values()
    )
    return 0 if all_ok else 1
