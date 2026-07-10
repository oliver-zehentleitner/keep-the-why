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

## Launch-readiness pass: SKILL.md trimmed, negative evals added, README reordered

**Status:** active
**Confirmed**

Four changes made together ahead of publishing to skill marketplaces: `SKILL.md` cut from ~2100 to ~1580 words (merged redundant rules, tightened the Record workflow step instead of restating rules 9/13 in full); six negative-case evals added (routine changes that shouldn't trigger the skill, an already-good doc structure that shouldn't be rebuilt, conflicting sources, a secret in an interview answer, a stale confirmed decision past its revisit trigger); README reordered so Install and a concrete Example come right after the pitch, with the longer "Problem" and "Where this fits" sections moved below instead of gating the actionable content; and social preview meta tags (Open Graph/Twitter card, pointing at the existing logo) added via a small `overrides/main.html` template.

**Reason:** all four came out of an external review before the intended launch — the SKILL.md length and README ordering were both flagged as things a technically experienced reader would stumble on even though the underlying idea was sound, and the missing negative evals were a real gap (every existing eval tested "the skill should do X," none tested "the skill should stay quiet" or "the skill should flag a conflict instead of guessing").

**Rejected/deferred:** a cross-agent test matrix (Claude Code, Codex CLI, Gemini CLI) was suggested alongside the evals. Not done here — this environment only has access to Claude Code, and claiming test results without having actually run them would violate rule 1 (never invent) applied to the project's own claims about itself. `CONTRIBUTING.md` asks for real cross-agent results as a contribution instead of asserting them prematurely.

