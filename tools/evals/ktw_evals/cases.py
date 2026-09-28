"""Loading eval cases, per-case fixture config, and the matrix config."""

import json
import sys

from .common import EVALS_JSON, FIXTURES_DIR, MATRIX_CONFIG_JSON


def load_cases(selected):
    cases = json.loads(EVALS_JSON.read_text())
    by_id = {c["id"]: c for c in cases}
    if selected:
        missing = [c for c in selected if c not in by_id]
        if missing:
            sys.exit(f"unknown case id(s): {', '.join(missing)}")
        return [by_id[c] for c in selected]
    return cases


def load_matrix_config():
    """The repo's standing driver x model matrix (tools/evals/matrix-config.json).

    Kept as data, not a Python constant, so growing the matrix (a new model,
    a new driver once verified) is a one-line JSON edit, not a code change —
    and so a CI job can read the exact same file without importing this
    module.
    """
    return json.loads(MATRIX_CONFIG_JSON.read_text())


def read_case_config(case_id):
    """Optional per-case config: fixtures/<id>/case.json.

    Supported keys:
      base: "none" to skip the _base overlay (default: use _base)
      remove: [paths] to delete from the project dir after overlay
      personal: "none" to skip seeding the default personal config into the
                fake $HOME (simulates a developer with no personal file yet
                for this project — the ~/.keep-the-why/ equivalent of the old
                "remove AGENTS.local.md" convention)
      commits: [{"message": str, "files": {path: content}, "author": str,
                 "date": str | "days_ago": int}] — extra commits after the
                 initial one; days_ago dates the commit relative to the run
                 so a prompt's "two weeks ago" stays true
      disallowed_tools: [tool names] passed to claude --disallowedTools
                        (e.g. deny WebFetch to simulate no web access)
      explicit_load: false to send the case prompt bare on every driver,
                     without the "read SKILL.md first" prefix the non-claude
                     drivers normally get — for cases that measure whether
                     the agent loads the skill unprompted
      skill_install: install path for the skill on every driver (default:
                     the driver's own, see drivers.SKILL_INSTALL_REL) — for
                     cases whose fixture names the path in an instruction
      cwd: a subdirectory of the project to start the session in (the
           discovery rule, a mono repo's sub-project); checks and the diff
           stay relative to the project root, the explicit-load prefix's
           skill path is made relative to it
      remote: a URL added as `origin` after the initial commit, never
              fetched — for the `canonical` backfill
      remotes: {name: url} — several named remotes, e.g. a fork checkout
               (origin = the fork, upstream = the project); never fetched
      Keys starting with "_" are notes for whoever reads the fixture (an id
      a check refers to) and are ignored.

    A fixtures/<id>/home/ directory, if present, is overlaid onto the fake
    $HOME after the default personal config is (or isn't) seeded — for a case
    that needs a specific ~/.keep-the-why/<id>.md (an invalid or missing
    field) or a ~/.keep-the-why/config (the global personal-defaults-policy).
    """
    p = FIXTURES_DIR / case_id / "case.json"
    if p.exists():
        return json.loads(p.read_text())
    return {}
