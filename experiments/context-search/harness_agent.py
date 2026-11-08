"""The agent runs: Claude Code answers the questions on a dataset, once per variant, and every session is measured.

Variants:

- B, the baseline: the project as Maity's repository has it, with the Keep the Why skill installed where Claude
  Code finds it (`.claude/skills/keep-the-why/`), today's wording, and its start path: an `AGENTS.md` section that
  has the agent load the skill first (autostart.md, path 2) and a `CLAUDE.md` that imports it. No search tool: the
  skill's way is the index, then the topics, but in the pilot the agent grepped the topics instead.
- B-index: B, with the line Maity's own `AGENTS.md` has above the section, "Why it is built this way:
  `context/index.md`": the documented path, index first.
- F-bm25: B, plus `ktw` on PATH (ktw_proto.py: index, find, show, graph; `find` ranks by BM25) and a short note
  added to the project's CLAUDE.md that says the command exists and how to call it, nothing about what to search for.
- F-hybrid: F-bm25 with `find` ranking by BM25 and static embeddings fused (KTW_RANK=hybrid), the model cached
  beforehand and loaded offline.

Every session runs in a fresh copy of the dataset (without its ids.json, which maps copies to originals) as a git
repository, in a fake home that holds only Claude Code's login, with `--setting-sources project,local`: no
user-level instructions, memory or skills reach it. The prompt is the same for every variant: the question, and
an answer in one or two sentences naming the Id of the entry (every Id, for a list).

Per session: the Ids the answer names, in order (exact@1: the first is an expected one; for a list, recall and
precision); the total context at the answer (the last assistant turn's input, cache-read and cache-creation
tokens); tool calls by tool and `ktw` subcommand; turns; wall time; cost; the model and CLI version; whether the
skill was loaded and the index read. Results go to one JSON file per session, so a stopped series resumes where it
stopped, and a session that hit the account's usage limit is not counted and stops the series.

    python harness_agent.py DATA_DIR OUT_DIR --plan pilot|grid|core|opus [--model claude-sonnet-5-5]
                            [--runs N] [--max-cost USD] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "tools" / "evals"))
import harness_offline as H  # noqa: E402
from ktw_evals.common import SKILL_DIR, cli_version  # noqa: E402
from ktw_evals.drivers import SKILL_INSTALL_REL  # noqa: E402
from ktw_evals.drivers.claude import run_agent_claude  # noqa: E402
from ktw_evals.judge import session_usage  # noqa: E402

UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
VARIANTS = ("B", "B-index", "F-bm25", "F-hybrid")
# the line Maity's own AGENTS.md has, and the path the documentation describes: the index first, then the topic
INDEX_POINTER = "- Why it is built this way: `context/index.md`\n\n"
PROMPT_TAIL = (
    "\n\nAnswer in one or two sentences, and give the Id of the entry that answers it "
    "(for a list: every Id)."
)
NOTE = """# Searching this project's context

`ktw` is installed: a search over the Keep the Why entries of this project and its family.

- `ktw find TEXT` ranks entries for TEXT, one line each: `id · type/status · title · file:lines`.
- `ktw find --type T` / `--status S` / `--member M` filters (with or without TEXT); `-n` sets how many.
- `ktw show ID...` prints entries; `ktw graph ID` shows their See and Superseded-by links in both directions.
- `ktw index` lists every entry, one line each.
"""
PERSONAL = """<!-- keep-the-why:personal -->
- capture-mode: explicit-only
- confirmation-flow: sequential
- update-check: no
- consistency-check: no
<!-- /keep-the-why:personal -->
"""
AUTOSTART = re.search(
    r"^```markdown\n(.*?)^```",
    (SKILL_DIR / "references" / "autostart.md").read_text(encoding="utf-8"),
    re.M | re.S,
).group(1)
LIMIT = re.compile(
    r"usage limit|rate limit|session limit|limit reached|resets at", re.I
)


def subset(plan: str) -> list[tuple[str, str]]:
    """(set, question id) pairs for a plan."""
    s = json.loads((HERE / "agent-subset.json").read_text(encoding="utf-8"))
    if plan == "pilot":
        return [(ds, q) for ds in ("x1", "x10", "registry") for q in s["pilot"]]
    if plan in ("core", "opus"):
        return [("x10", q) for q in s["maity_text"]]
    return [(ds, q) for ds, groups in s["sets"].items() for g in groups for q in s[g]]


def tool_dir(home: Path, rank: str) -> Path:
    """`ktw` in the fake home: a copy of the prototype, the loader and the linter's package, so the session sees no
    path into this repository (where the questions are)."""
    lib = home / ".local" / "share" / "ktw"
    lib.mkdir(parents=True, exist_ok=True)
    for f in ("ktw_proto.py", "harness_offline.py"):
        shutil.copy2(HERE / f, lib / f)
    shutil.copytree(REPO / "lint" / "ktw_lint", lib / "ktw_lint", dirs_exist_ok=True)
    bin_ = home / ".local" / "bin"
    bin_.mkdir(parents=True, exist_ok=True)
    hf = os.environ.get("HF_HOME", str(Path.home() / ".cache" / "huggingface"))
    (bin_ / "ktw").write_text(
        "#!/bin/sh\n"
        f'KTW_RANK={rank} KTW_CACHE="$HOME/.cache/keep-the-why" HF_HOME="{hf}" HF_HUB_OFFLINE=1 '
        f'PYTHONPATH="{lib}" exec "{sys.executable}" "{lib}/ktw_proto.py" '
        '"$(git rev-parse --show-toplevel 2>/dev/null || pwd)" "$@"\n',
        encoding="utf-8",
    )
    (bin_ / "ktw").chmod(0o755)
    return bin_


def workdir(data: Path, ds: str, variant: str, root: Path) -> tuple[Path, Path]:
    w, home = root / "project", root / "home"
    shutil.copytree(data / ds, w, ignore=shutil.ignore_patterns(".git", "ids.json"))
    home.mkdir()
    for rel in (".claude/.credentials.json", ".claude.json"):
        src = Path.home() / rel
        if src.exists():
            (home / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, home / rel)
    cfg = (w / ".keep-the-why").read_text(encoding="utf-8")
    m = re.search(r"^\s*-\s*id:\s*(\S+)", cfg, re.M)
    if m:
        (home / ".keep-the-why").mkdir()
        (home / ".keep-the-why" / f"{m.group(1)}.md").write_text(
            PERSONAL, encoding="utf-8"
        )
    # the project's start path, as Maity's own repository has it (autostart.md, path 2): an AGENTS.md section that
    # tells the agent to load the skill first, and a CLAUDE.md that imports it; without one the skill is not loaded
    # for a plain question (pilot, 2026-11-08), and the baseline would not be the skill's way
    pointer = INDEX_POINTER if variant == "B-index" else ""
    (w / "AGENTS.md").write_text("# Agents\n\n" + pointer + AUTOSTART, encoding="utf-8")
    claude_md = "@AGENTS.md\n"
    if variant.startswith("F"):
        tool_dir(home, "hybrid" if variant == "F-hybrid" else "bm25")
        claude_md += "\n" + NOTE
    (w / "CLAUDE.md").write_text(claude_md, encoding="utf-8")
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "Dataset",
        "GIT_AUTHOR_EMAIL": "dataset@example.invalid",
        "GIT_COMMITTER_NAME": "Dataset",
        "GIT_COMMITTER_EMAIL": "dataset@example.invalid",
    }
    for cmd in (
        ["git", "init", "-q", "-b", "main"],
        ["git", "add", "-A"],
        ["git", "commit", "-qm", "context"],
    ):
        subprocess.run(cmd, cwd=w, env=env, check=True, capture_output=True)
    skill = w / SKILL_INSTALL_REL["claude"]
    skill.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL_DIR, skill)
    with open(w / ".git" / "info" / "exclude", "a", encoding="utf-8") as f:
        f.write(f"/{SKILL_INSTALL_REL['claude']}/\n")
    return w, home


def measure(events: list, expected: list[str], wall: float) -> dict:
    calls, ktw, turns_ctx, trace = {}, {}, [], []
    skill_loaded = index_read = False
    answer = ""
    for ev in events:
        if ev.get("type") == "assistant":
            msg = ev.get("message") or {}
            u = msg.get("usage") or {}
            turns_ctx.append(
                (u.get("input_tokens") or 0)
                + (u.get("cache_read_input_tokens") or 0)
                + (u.get("cache_creation_input_tokens") or 0)
            )
            for b in msg.get("content") or []:
                if b.get("type") != "tool_use":
                    continue
                name, inp = b.get("name"), b.get("input") or {}
                calls[name] = calls.get(name, 0) + 1
                # what the agent did, step by step: the tool and its main argument, capped
                arg = (
                    inp.get("command")
                    or inp.get("file_path")
                    or inp.get("pattern")
                    or inp.get("skill")
                    or ""
                )
                trace.append(f"{name}: {str(arg)[:200]}")
                text = json.dumps(inp)
                if (
                    name == "Skill"
                    and "keep-the-why" in text
                    or "skills/keep-the-why/SKILL.md" in text
                ):
                    skill_loaded = True
                if "context/index.md" in text:
                    index_read = True
                if name == "Bash":
                    for sub in re.findall(
                        r"(?:^|[;&|]\s*)ktw\s+(\w+)", inp.get("command", "")
                    ):
                        ktw[sub] = ktw.get(sub, 0) + 1
        if ev.get("type") == "result":
            answer = ev.get("result") or ""
    named = list(dict.fromkeys(UUID.findall(answer.lower())))
    want = set(expected)
    hit = [i for i in named if i in want]
    return {
        "answer": answer,
        "named": named,
        "exact1": bool(named) and named[0] in want,
        "recall": len(hit) / len(want) if want else None,
        "precision": len(hit) / len(named) if named else 0.0,
        "context_at_answer": turns_ctx[-1] if turns_ctx else None,
        "context_per_turn_sum": sum(turns_ctx),
        "turns": len(turns_ctx),
        "tool_calls": calls,
        "trace": trace,
        "ktw_calls": ktw,
        "skill_loaded": skill_loaded,
        "index_read": index_read,
        "wall_seconds": round(wall, 1),
    }


def summarize(out: Path) -> str:
    """One table per set: per variant, exact@1 (sessions with the first named Id right), list recall, and the
    medians of the context at the answer, turns, tool calls, wall time and cost; then the start path's checks.
    """
    import statistics as S

    rows = [
        json.loads(p.read_text(encoding="utf-8")) for p in sorted(out.glob("*.json"))
    ]
    med = lambda xs: round(S.median(xs), 1) if xs else None  # noqa: E731
    lines = [
        f"{len(rows)} sessions, {sum(r['usage'].get('total_cost_usd') or 0 for r in rows):.2f} USD; "
        f"models {sorted({r['model'] for r in rows})}, CLI {sorted({r['cli'] for r in rows})}",
        "",
        "| set | variant | sessions | exact@1 | list recall | context at answer | turns | tool calls | wall s | USD |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for ds in dict.fromkeys(r["set"] for r in rows):
        for v in VARIANTS:
            rs = [r for r in rows if r["set"] == ds and r["variant"] == v]
            if not rs:
                continue
            lists = [r["recall"] for r in rs if len(r["expected"]) > 1]
            lines.append(
                f"| {ds} | {v} | {len(rs)} | {sum(r['exact1'] for r in rs)}/{len(rs)} | "
                f"{'—' if not lists else f'{S.mean(lists):.2f}'} | {med([r['context_at_answer'] or 0 for r in rs])} | "
                f"{med([r['turns'] for r in rs])} | {med([sum(r['tool_calls'].values()) for r in rs])} | "
                f"{med([r['wall_seconds'] for r in rs])} | {med([r['usage'].get('total_cost_usd') or 0 for r in rs]):.3f} |"
            )
    lines += [
        "",
        f"Skill loaded: {sum(r['skill_loaded'] for r in rows)}/{len(rows)}; "
        f"context/index.md read: {sum(r['index_read'] for r in rows)}/{len(rows)}",
    ]
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("data", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--plan", choices=("pilot", "grid", "core", "opus"), required=True)
    ap.add_argument("--model", default="claude-sonnet-5-5")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument(
        "--max-cost",
        type=float,
        help="stop once the series' cost reaches this many USD",
    )
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--variants", default=",".join(VARIANTS))
    ap.add_argument(
        "--summarize",
        action="store_true",
        help="write OUT_DIR/summary.md from its sessions and stop",
    )
    ap.add_argument("--only", help="comma-separated set:question pairs, e.g. x1:q05")
    ap.add_argument(
        "--dry-run", action="store_true", help="build one workdir per variant and stop"
    )
    a = ap.parse_args(argv)
    if a.summarize:
        text = summarize(a.out)
        (a.out / "summary.md").write_text(text + "\n", encoding="utf-8")
        print(text)
        return 0
    questions = {q["id"]: q for q in H.load_questions(H.QUESTION_FILES)}
    a.out.mkdir(parents=True, exist_ok=True)
    version = cli_version("claude")
    spent = sum(
        json.loads(p.read_text(encoding="utf-8")).get("usage", {}).get("total_cost_usd")
        or 0
        for p in a.out.glob("*.json")
    )
    base = Path(os.environ.get("TMPDIR", "/var/tmp"))
    only = set(a.only.split(",")) if a.only else None
    for ds, qid in subset(a.plan):
        if only and f"{ds}:{qid}" not in only:
            continue
        q = questions[qid]
        data = H.load(a.data / ds)
        expected = H.expected_in(q, data)
        for variant in a.variants.split(","):
            for run in range(1, a.runs + 1):
                key = f"{a.plan}-{ds}-{qid}-{variant}-{a.model}-{run}"
                dest = a.out / f"{key}.json"
                if dest.exists():
                    continue
                if a.max_cost is not None and spent >= a.max_cost:
                    print(f"cost cap reached: {spent:.2f} USD", flush=True)
                    return 3
                with tempfile.TemporaryDirectory(dir=base, prefix="ktw-agent-") as tmp:
                    w, home = workdir(a.data, ds, variant, Path(tmp))
                    if a.dry_run:
                        print(key, w, sorted(p.name for p in w.iterdir()), flush=True)
                        if variant == VARIANTS[-1]:
                            return 0
                        continue
                    t0 = time.monotonic()
                    res = run_agent_claude(
                        q["question"] + PROMPT_TAIL, w, a.model, a.timeout, home=home
                    )
                    wall = time.monotonic() - t0
                events = res.get("events") or []
                usage = session_usage(events)
                m = measure(events, expected, wall)
                if LIMIT.search(res.get("error") or "") or (
                    not events and LIMIT.search(res.get("raw") or "")
                ):
                    print(f"usage limit at {key}; not counted, stopping", flush=True)
                    return 4
                row = {
                    "key": key,
                    "plan": a.plan,
                    "set": ds,
                    "question": qid,
                    "kind": q["kind"],
                    "variant": variant,
                    "run": run,
                    "model": a.model,
                    "cli": version,
                    "expected": expected,
                    "error": res.get("error"),
                    "usage": usage,
                    **m,
                }
                dest.write_text(json.dumps(row, indent=1), encoding="utf-8")
                spent += usage.get("total_cost_usd") or 0
                print(
                    f"{key}: exact1={m['exact1']} ctx={m['context_at_answer']} turns={m['turns']} "
                    f"tools={sum(m['tool_calls'].values())} cost={usage.get('total_cost_usd')} "
                    f"skill={m['skill_loaded']} index={m['index_read']} {m['wall_seconds']}s",
                    flush=True,
                )
    return 0


if __name__ == "__main__":
    sys.exit(main())
