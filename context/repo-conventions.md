# Repository conventions

## Automation tokens need the `workflow` OAuth scope to push workflow files

**Status:** active, operational constraint (not a design choice)
**Confirmed**

Any push that touches `.github/workflows/*.yml` is rejected by GitHub unless the pushing credential has the `workflow` OAuth scope — this is independent of the `repo` scope and applies to any token or bot/automation account that lacks it, not specific to this repo.

**Workaround:** if the pushing credential lacks the `workflow` scope, prepare the workflow file's content separately and have someone with appropriate access add it manually (via the GitHub UI or their own credentials), while pushing everything else in the same change normally by excluding just the workflow file from that commit.

## The installable skill lives under `skills/keep-the-why/`, not at the repo root

**Status:** active
**Confirmed**

`SKILL.md`, `references/`, `examples/`, and `evals/` moved from the repo root into `skills/keep-the-why/`. Everything else (`docs/`, `mkdocs.yml`, `context/`, CI config) stays at the root — it's this project's own site and self-documentation, not part of what gets installed into someone else's project.

**Reason:** `gh skill install` (GitHub CLI v2.90.0+) discovers skills via the `skills/*/SKILL.md` convention. A repository with `SKILL.md` directly at its root doesn't match that pattern and isn't reliably discovered — a known, currently open upstream bug (cli/cli#13552) confirms this specifically for root-level single-skill repos. Moving the skill under `skills/keep-the-why/` isn't just tidier structure, it's what makes the recommended install path (`gh skill install oliver-zehentleitner/keep-the-why`) actually work.

It also fixes a second, independent problem: cloning this whole repository into an agent's skills directory (the previous install method) nests an embedded git repository inside the target project and pulls in unrelated files (docs, mkdocs config, CI, evals) that have nothing to do with running the skill.

**Rejected alternative:** keep `SKILL.md` at the root and only document the limitation (`gh skill install` won't discover it, use manual clone instead). Rejected because the manual-clone fallback has its own real problem (the embedded-repo issue above) — accepting both limitations to avoid one file move wasn't a good trade.

