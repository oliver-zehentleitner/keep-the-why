"""Materializing a case's throwaway project (and fake $HOME), and collecting
what the agent changed in it afterwards."""

import os
import re
import shutil
from pathlib import Path

from .common import (
    BASE_FIXTURE,
    FIXTURES_DIR,
    MAX_DIFF_CHARS,
    SKILL_DIR,
    sh,
    skill_version,
)
from .drivers import SKILL_INSTALL_REL


def copy_tree(src: Path, dst: Path):
    for item in src.rglob("*"):
        if item.name == "case.json" and item.parent == src:
            continue
        rel = item.relative_to(src)
        # A case fixture's own home/ subtree is overlaid separately onto the
        # fake $HOME (see build_workdir) — never into the project dir itself,
        # regardless of which of the two this particular copy_tree call is for.
        if rel.parts and rel.parts[0] == "home" and src.name != "home":
            continue
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


DEFAULT_PERSONAL_CONFIG = """<!-- keep-the-why:personal -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: no
- consistency-check: no
<!-- /keep-the-why:personal -->
"""


def build_workdir(case_id, cfg, workdir: Path, driver, home: Path = None):
    if cfg.get("base") != "none" and BASE_FIXTURE.exists():
        copy_tree(BASE_FIXTURE, workdir)
    case_fixture = FIXTURES_DIR / case_id
    if case_fixture.exists():
        copy_tree(case_fixture, workdir)
    for rel in cfg.get("remove", []):
        target = workdir / rel
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    # Fixtures that mean "a project at the *current* schema" carry a
    # {{SKILL_VERSION}} placeholder instead of a hardcoded version, so they
    # don't all go stale (and start triggering migration prompts mid-eval)
    # on every release. Deliberately old pins (0.2.0, 0.9.9, ...) stay literal.
    version = skill_version()
    substitutable = list(workdir.rglob("*.md"))
    keep_the_why_file = workdir / ".keep-the-why"
    if keep_the_why_file.exists():
        substitutable.append(keep_the_why_file)
    for f in substitutable:
        text = f.read_text()
        if "{{SKILL_VERSION}}" in text:
            f.write_text(text.replace("{{SKILL_VERSION}}", version))

    # Keep the Why's personal config lives outside the project entirely, at
    # ~/.keep-the-why/<id>.md — seed the default here, in the fake $HOME this
    # case run uses, the same role _base/AGENTS.local.md used to play before
    # personal config moved out of the project. A case that wants a fresh,
    # never-configured developer sets "personal": "none" in case.json instead
    # of removing an in-project file. A case needing a *specific* personal
    # file (an invalid or missing field, or a ~/.keep-the-why/config policy)
    # provides its own fixtures/<case-id>/home/ directory, overlaid after —
    # skipped entirely for a driver with no home to seed (home=None), and for
    # a project without a `.keep-the-why` at all (empty-project/wizard cases).
    if (
        home is not None
        and keep_the_why_file.exists()
        and cfg.get("personal") != "none"
    ):
        id_match = re.search(
            r"^\s*-\s*id:\s*(\S+)", keep_the_why_file.read_text(), re.MULTILINE
        )
        if id_match:
            personal_dir = home / ".keep-the-why"
            personal_dir.mkdir(parents=True, exist_ok=True)
            (personal_dir / f"{id_match.group(1)}.md").write_text(
                DEFAULT_PERSONAL_CONFIG
            )
    if home is not None:
        home_fixture = FIXTURES_DIR / case_id / "home"
        if home_fixture.exists():
            copy_tree(home_fixture, home)
        # Snapshot whatever ~/.keep-the-why/ holds *before* the agent runs, so
        # the disk section handed to the judge can say which personal files
        # were seeded by the fixture and left untouched versus written by the
        # agent. Without this, a judge reading "here is ~/.keep-the-why/<id>.md
        # with capture-mode: proactive" has no way to tell a fixture seed from
        # an agent write — and has failed a case on exactly that misreading.
        # Kept outside ~/.keep-the-why/ itself so the skill never sees it.
        snapshot_dir = home / ".ktw-eval-seed-snapshot"
        personal_dir = home / ".keep-the-why"
        if snapshot_dir.exists():
            shutil.rmtree(snapshot_dir)
        if personal_dir.is_dir():
            copy_tree(personal_dir, snapshot_dir)

    git_env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "Eval Fixture",
        "GIT_AUTHOR_EMAIL": "fixture@example.com",
        "GIT_COMMITTER_NAME": "Eval Fixture",
        "GIT_COMMITTER_EMAIL": "fixture@example.com",
    }
    sh(["git", "init", "-q", "-b", "main"], cwd=workdir, env=git_env)
    sh(["git", "add", "-A"], cwd=workdir, env=git_env)
    sh(
        ["git", "commit", "-q", "-m", "Initial commit", "--allow-empty"],
        cwd=workdir,
        env=git_env,
    )

    for commit in cfg.get("commits", []):
        for rel, content in commit.get("files", {}).items():
            p = workdir / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        env = dict(git_env)
        if commit.get("author"):
            name, _, email = commit["author"].partition(" <")
            env["GIT_AUTHOR_NAME"] = name
            env["GIT_AUTHOR_EMAIL"] = email.rstrip(">") or "fixture@example.com"
        if commit.get("date"):
            env["GIT_AUTHOR_DATE"] = commit["date"]
            env["GIT_COMMITTER_DATE"] = commit["date"]
        sh(["git", "add", "-A"], cwd=workdir, env=env)
        sh(
            ["git", "commit", "-q", "--allow-empty", "-m", commit["message"]],
            cwd=workdir,
            env=env,
        )

    # Install the skill the way a project-scoped install would: a real,
    # untracked copy (keeps the skill out of the repo the agent analyzes)
    # at the driver's install path.
    # A case may pin the install path for every driver (case.json
    # "skill_install") — the Path 2 activation cases do, because the
    # project's own instruction names `.claude/skills/keep-the-why/SKILL.md`
    # and the test is whether the agent follows *that*, not a driver default.
    skill_rel = cfg.get("skill_install") or SKILL_INSTALL_REL[driver]
    skill_target = workdir / skill_rel
    skill_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL_DIR, skill_target)
    (workdir / ".git" / "info").mkdir(exist_ok=True)
    with open(workdir / ".git" / "info" / "exclude", "a") as f:
        f.write(f"/{skill_rel}/\n")


def collect_diff(workdir, home=None):
    """What the agent actually changed on disk: status, diff, new files."""
    status = sh(["git", "status", "--porcelain"], cwd=workdir).stdout
    diff = sh(["git", "diff"], cwd=workdir).stdout
    parts = [f"# git status --porcelain\n{status or '(clean)'}"]
    if diff.strip():
        parts.append(f"# git diff (tracked files)\n{diff}")
    for line in status.splitlines():
        if line.startswith("??"):
            rel = line[3:].strip()
            p = workdir / rel
            if p.is_file():
                try:
                    content = p.read_text()
                except (UnicodeDecodeError, OSError):
                    content = "(binary or unreadable)"
                if len(content) > 4000:
                    content = content[:4000] + "…(truncated)"
                parts.append(f"# new file: {rel}\n{content}")
    # Keep the Why's personal config lives outside the project entirely, at
    # ~/.keep-the-why/ — not git-tracked, so status/diff above never sees it.
    # build_workdir snapshots the seeded state into ~/.ktw-eval-seed-snapshot/
    # so each file can be labeled as fixture-seeded-and-unchanged, changed, or
    # newly created by the agent — the judge must not mistake a seed for a
    # write. Files the agent deleted are listed too.
    if home is not None:
        personal_dir = home / ".keep-the-why"
        snapshot_dir = home / ".ktw-eval-seed-snapshot"
        seeded = {}
        if snapshot_dir.is_dir():
            for p in sorted(snapshot_dir.rglob("*")):
                if p.is_file():
                    try:
                        seeded[str(p.relative_to(snapshot_dir))] = p.read_text()
                    except (UnicodeDecodeError, OSError):
                        seeded[str(p.relative_to(snapshot_dir))] = None
        seen = set()
        if personal_dir.is_dir():
            for p in sorted(personal_dir.rglob("*")):
                if p.is_file():
                    rel = str(p.relative_to(personal_dir))
                    seen.add(rel)
                    try:
                        content = p.read_text()
                    except (UnicodeDecodeError, OSError):
                        content = "(binary or unreadable)"
                    if rel in seeded and seeded[rel] == content:
                        label = (
                            "SEEDED BY THE FIXTURE BEFORE THE RUN, UNCHANGED — "
                            "the agent did not write this"
                        )
                    elif rel in seeded:
                        label = "seeded by the fixture, MODIFIED by the agent during the run"
                    else:
                        label = "did not exist before the run — CREATED by the agent"
                    if len(content) > 4000:
                        content = content[:4000] + "…(truncated)"
                    parts.append(
                        f"# ~/.keep-the-why/{rel} "
                        f"(personal config, outside the project; {label})\n{content}"
                    )
        for rel in seeded:
            if rel not in seen:
                parts.append(
                    f"# ~/.keep-the-why/{rel} (personal config, outside the project; "
                    f"seeded by the fixture, DELETED by the agent during the run)"
                )
    text = "\n\n".join(parts)
    if len(text) > MAX_DIFF_CHARS:
        text = text[:MAX_DIFF_CHARS] + "\n…(diff truncated)"
    return text
