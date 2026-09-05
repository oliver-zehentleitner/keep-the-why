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
