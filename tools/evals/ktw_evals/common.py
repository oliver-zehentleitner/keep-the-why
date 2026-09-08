"""Paths, size limits, and the two helpers every other module shares."""

import re
import subprocess
from pathlib import Path

# tools/evals/ — this file lives one level down, in the ktw_evals package.
TOOL_DIR = Path(__file__).resolve().parent.parent


REPO_ROOT = TOOL_DIR.parent.parent


SKILL_DIR = REPO_ROOT / "skills" / "keep-the-why"


EVALS_JSON = TOOL_DIR / "evals.json"


FIXTURES_DIR = TOOL_DIR / "fixtures"


BASE_FIXTURE = FIXTURES_DIR / "_base"


MATRIX_CONFIG_JSON = TOOL_DIR / "matrix-config.json"


MAX_DIFF_CHARS = 30_000


MAX_TRANSCRIPT_CHARS = 60_000


MAX_TOOL_RESULT_CHARS = 400


def sh(args, cwd=None, check=True, env=None, timeout=None, input_=None):
    return subprocess.run(
        args,
        cwd=cwd,
        check=check,
        env=env,
        timeout=timeout,
        capture_output=True,
        text=True,
        input=input_,
    )


def _cap(text, limit=MAX_TRANSCRIPT_CHARS):
    if len(text) > limit:
        return text[:limit] + "\n…(transcript truncated)"
    return text


def skill_version():
    """The skill's own version, from SKILL.md's frontmatter."""
    return re.search(r'version: "([^"]+)"', (SKILL_DIR / "SKILL.md").read_text()).group(
        1
    )


def fake_home_env(env, home):
    """Point everything that would write to the operator's home at the fake
    one — not only $HOME. pipx, uv and pip's --user mode each locate their
    install and bin directories through their own variables (or through
    platformdirs, which ignores an overridden HOME on some platforms), so a
    session that installs a tool would otherwise leak it into the real
    ~/.local and every later session would find it there. The fake home's
    bin directory goes first on PATH so a tool the agent installs during the
    run is found by the same session, the way a user's ~/.local/bin is."""
    home = str(home)
    env["HOME"] = home
    env["PIPX_HOME"] = f"{home}/.local/share/pipx"
    env["PIPX_BIN_DIR"] = f"{home}/.local/bin"
    env["UV_TOOL_DIR"] = f"{home}/.local/share/uv/tools"
    env["UV_TOOL_BIN_DIR"] = f"{home}/.local/bin"
    env["PYTHONUSERBASE"] = f"{home}/.local"
    env["PATH"] = f"{home}/.local/bin:" + env.get("PATH", "")
    return env
