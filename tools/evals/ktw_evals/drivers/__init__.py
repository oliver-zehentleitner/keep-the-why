"""Driver registry: which agentic CLI runs the skill under test, and the
per-driver tables the rest of the runner consults. One module per driver
(run_agent_* and render_transcript_*); the module docstring of
tools/evals/run.py explains what each driver does differently and why."""

import json
import shutil
from pathlib import Path

from .claude import render_transcript_claude, run_agent_claude
from .cline import render_transcript_cline, run_agent_cline
from .codex import render_transcript_codex, run_agent_codex
from .hermes import render_transcript_hermes, run_agent_hermes
from .kimi import render_transcript_kimi, run_agent_kimi
from .omp import render_transcript_omp, run_agent_omp
from .opencode import render_transcript_opencode, run_agent_opencode
from .pi import render_transcript_pi, run_agent_pi

# Where the skill gets copied into each throwaway fixture project, per
# driver. claude keeps the pre-existing .claude/skills/ location so the
# activation-reliability cases (native discovery) don't change behavior;
# pi/opencode get a plain, easy-to-reference path since we tell them about it
# explicitly instead of relying on discovery (see module docstring).
SKILL_INSTALL_REL = {
    "claude": ".claude/skills/keep-the-why",
    "pi": "skills/keep-the-why",
    "opencode": "skills/keep-the-why",
    "kimi": "skills/keep-the-why",
    "cline": "skills/keep-the-why",
    "codex": "skills/keep-the-why",
    "hermes": "skills/keep-the-why",
    "omp": "skills/keep-the-why",
}


# A driver's CLI needs its own real login/config from $HOME to run at all —
# a bare empty fake $HOME (see execute_pass) broke every claude run outright
# ("Not logged in - Please run /login"), since that's exactly where its
# credentials live. Copied into the fake $HOME before each run, verified
# present on this host as of this writing. Only "claude" has actually been
# exercised against this fix (this environment's own driver); the rest are
# the analogous, unverified-but-documented paths for each tool, based on
# what's actually on this machine, not guessed blind - confirm each before
# trusting a future run against it. cline isn't listed: its own auth already
# lives under an explicit --data-dir (see run_agent_cline), resolved via
# Path.home() in this script's own process, never the subprocess env this
# table feeds - unaffected by the fake $HOME either way. hermes and omp
# aren't listed either: both authenticate purely via the OPENROUTER_API_KEY
# env var, which isn't reset by overriding HOME, so there's no file to copy.
HOME_PRESERVE = {
    "claude": [".claude", ".claude.json"],
    "pi": [".pi"],
    "opencode": [".opencode", ".config/opencode"],
    "kimi": [".kimi-code"],
    "codex": [".codex"],
}


# The copy above is for the CLI's login, not for the operator's habits: a
# user-scoped SessionStart hook that loads keep-the-why (autostart path 1,
# references/autostart.md) would come along in .claude/settings.json and load
# the skill in exactly the cases that measure what happens without a hook -
# `autostart-project-instruction-loads-skill` and its control. Hooks a case
# wants are the fixture's own, project-scoped ones; the operator's are dropped
# from the copy, whatever they do. The real file is never touched.
HOME_STRIP_HOOKS = {
    "claude": [".claude/settings.json"],
}


# Files the CLI creates and removes on its own while a copy may be running —
# a token refresh's lock, a session's transient state. A copy that trips over
# one of them vanishing mid-way would abort the case (seen 2026-09-22:
# `.oauth_refresh.lock` gone between listing and copying, 50 cases into a
# run). They carry nothing a session needs.
TRANSIENT_HOME_FILES = shutil.ignore_patterns("*.lock", "*.tmp")


def _copytree_tolerant(src, dst):
    """copytree that skips transient files and tolerates a source vanishing
    between listing and copying — the remaining files are copied, the
    missing ones were not worth having."""
    try:
        shutil.copytree(src, dst, symlinks=True, ignore=TRANSIENT_HOME_FILES)
    except shutil.Error as e:
        real = [err for err in e.args[0] if "No such file or directory" not in str(err)]
        if real:
            raise shutil.Error(real)


def seed_fake_home(real_home: Path, fake_home: Path, driver: str):
    for rel in HOME_PRESERVE.get(driver, []):
        src = real_home / rel
        if not src.exists():
            continue
        dst = fake_home / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            _copytree_tolerant(src, dst)
        else:
            shutil.copy2(src, dst)
    for rel in HOME_STRIP_HOOKS.get(driver, []):
        strip_hooks(fake_home / rel)


def strip_hooks(settings: Path):
    """Drop the operator's own session hooks from a copied settings file. A
    file that isn't valid JSON raises on purpose: a run that can't tell
    whether a hook came along is not a measurement."""
    if not settings.is_file():
        return
    data = json.loads(settings.read_text())
    if data.pop("hooks", None) is not None:
        settings.write_text(json.dumps(data, indent=2) + "\n")


# Whether the case prompt gets prefixed with an explicit "read SKILL.md and
# follow it" instruction. False only for claude, where discovery itself is
# part of what's under test.
EXPLICIT_LOAD = {
    "claude": False,
    "pi": True,
    "opencode": True,
    "kimi": True,
    "cline": True,
    "codex": True,
    "hermes": True,
    "omp": True,
}


# The executable each driver runs — what `cli_version()` asks for `--version`.
CLI_BINARY = {
    "claude": "claude",
    "pi": "pi",
    "opencode": "opencode",
    "kimi": "kimi",
    "cline": "cline",
    "codex": "codex",
    "hermes": "hermes",
    "omp": "omp",
}

DRIVER_LABELS = {
    "claude": "Claude Code",
    "pi": "Pi",
    "opencode": "opencode",
    "kimi": "Kimi Code",
    "cline": "Cline",
    "codex": "Codex CLI",
    "hermes": "Hermes",
    "omp": "oh-my-pi",
}


# The literal non-interactive/permission-bypass flag each driver is invoked
# with (read out of each run_agent_*'s own cmd list, not guessed) — every
# driver needs one of these since these are unattended runs with no human to
# answer an approval prompt. Recorded per-case (see run_case) so "every cell
# in this matrix is soft prompt-compliance, not hard tool-deny" is verifiable
# straight from the data instead of only being implicit in this file.
PERMISSION_BYPASS = {
    "claude": "--dangerously-skip-permissions",
    "pi": "--approve",
    "opencode": "--auto",
    "kimi": "-p (implicit non-interactive; -y/--auto is rejected in combination with -p)",
    "cline": "--auto-approve true",
    "codex": "--approve-for-me",
    "hermes": "--yolo",
    "omp": "--yolo",
}


def build_prompt(case_prompt, driver, cfg=None):
    """Case prompt as actually sent to the agent for this driver.

    Unchanged for claude (discovery is part of what's under test there). Every
    other driver is handed the skill explicitly, via a prefixed pointer to the
    installed SKILL.md — see run.py's module docstring, "Drivers", for why.

    A case can switch the prefix off for every driver with case.json
    "explicit_load": false — the activation cases do, since whether the
    agent loads the skill *unprompted* is exactly what they measure. Such a
    case usually pins "skill_install" as well, so the path the project's own
    instruction names is where the skill actually is.
    """
    cfg = cfg or {}
    explicit = cfg.get("explicit_load", EXPLICIT_LOAD[driver])
    if not explicit:
        return case_prompt
    skill_rel = cfg.get("skill_install") or SKILL_INSTALL_REL[driver]
    return (
        f"Before doing anything else, read the file at the RELATIVE path "
        f"./{skill_rel}/SKILL.md, inside the current working directory of "
        f"this session (do not use any other 'keep-the-why' skill you may "
        f"already know about or have installed globally elsewhere on this "
        f"machine — only the copy at that exact relative path is the one "
        f"under test here). Follow its instructions for the rest of this "
        f"session — including any of its references/*.md files it points "
        f"you to for the situation at hand.\n\n{case_prompt}"
    )


AGENT_RUNNERS = {
    "claude": run_agent_claude,
    "pi": run_agent_pi,
    "opencode": run_agent_opencode,
    "kimi": run_agent_kimi,
    "cline": run_agent_cline,
    "codex": run_agent_codex,
    "hermes": run_agent_hermes,
    "omp": run_agent_omp,
}


TRANSCRIPT_RENDERERS = {
    "claude": render_transcript_claude,
    "pi": render_transcript_pi,
    "opencode": render_transcript_opencode,
    "kimi": render_transcript_kimi,
    "cline": render_transcript_cline,
    "codex": render_transcript_codex,
    "hermes": render_transcript_hermes,
    "omp": render_transcript_omp,
}
