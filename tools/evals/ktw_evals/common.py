"""Paths, size limits, and the two helpers every other module shares."""

import os
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
    run is found by the same session, the way a user's ~/.local/bin is.

    The operator's own ~/.local/bin is replaced on PATH by a shadow of
    itself without the linter launchers: a `ktw-lint` installed there would
    otherwise be what the agent finds, and its state on the host — present,
    absent, half-reinstalled, pointing at a module the redirected
    PYTHONUSERBASE can no longer see — would become part of the measurement.
    The documented condition for a series is "no linter on the host"; the
    shadow makes it true regardless of the host. Everything else in that
    directory (the agent CLI itself lives there on many machines) stays
    reachable."""
    home = str(home)
    env["HOME"] = home
    env["PIPX_HOME"] = f"{home}/.local/share/pipx"
    env["PIPX_BIN_DIR"] = f"{home}/.local/bin"
    env["UV_TOOL_DIR"] = f"{home}/.local/share/uv/tools"
    env["UV_TOOL_BIN_DIR"] = f"{home}/.local/bin"
    env["PYTHONUSERBASE"] = f"{home}/.local"
    real_local_bin = Path.home() / ".local" / "bin"
    shadow = shadow_local_bin(real_local_bin, Path(home) / ".local" / "host-bin")
    parts = []
    for p in env.get("PATH", "").split(os.pathsep):
        if not p:
            continue
        if os.path.normpath(p) == str(real_local_bin):
            if shadow and str(shadow) not in parts:
                parts.append(str(shadow))
            continue
        parts.append(p)
    env["PATH"] = os.pathsep.join([f"{home}/.local/bin"] + parts)
    return env


LINTER_LAUNCHERS = frozenset({"ktw-lint", "keep-the-why-lint"})


def shadow_local_bin(real_bin, shadow):
    """A directory of symlinks to everything in `real_bin` except the linter
    launchers. None when `real_bin` does not exist, or when the shadow cannot
    be created — then `real_bin` simply stays off the PATH."""
    if not real_bin.is_dir():
        return None
    try:
        shadow.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None
    for entry in real_bin.iterdir():
        if entry.name in LINTER_LAUNCHERS:
            continue
        target = shadow / entry.name
        if not target.exists() and not target.is_symlink():
            target.symlink_to(entry)
    return shadow


_CLI_VERSION = {}


def cli_version(binary="claude"):
    """`<binary> --version`, once per process. None when it cannot be run.

    Part of the instrument a run records next to the resolved model ids: the
    same model behind the same CLI binary can still behave differently on
    another day, and the version is the cheapest thing to write down."""
    if binary not in _CLI_VERSION:
        try:
            out = subprocess.run(
                [binary, "--version"], capture_output=True, text=True, timeout=60
            ).stdout.strip()
            _CLI_VERSION[binary] = out.split("\n")[0] if out else None
        except (OSError, subprocess.TimeoutExpired):
            _CLI_VERSION[binary] = None
    return _CLI_VERSION[binary]
