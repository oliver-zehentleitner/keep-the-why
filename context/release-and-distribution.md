# Release and distribution

## Automation tokens need the `workflow` OAuth scope to push workflow files

**Status:** active
**Evidence:** confirmed

An operational constraint, not a design choice: any push that touches `.github/workflows/*.yml` is rejected by GitHub unless the pushing credential has the `workflow` OAuth scope — this is independent of the `repo` scope and applies to any token or bot/automation account that lacks it, not specific to this repo.

The workaround (split the workflow file into its own commit, have someone with the right scope add it separately) is a procedure, not a reason — see `CONTRIBUTING.md`.

## The installable skill lives under `skills/keep-the-why/`, not at the repo root

**Status:** active
**Evidence:** confirmed

`SKILL.md`, `references/`, `examples/`, and `evals/` moved from the repo root into `skills/keep-the-why/`. Everything else (`docs/`, `mkdocs.yml`, `context/`, CI config) stays at the root — it's this project's own site and self-documentation, not part of what gets installed into someone else's project.

**Reason:** `gh skill install` (GitHub CLI v2.90.0+) discovers skills via the `skills/*/SKILL.md` convention. A repository with `SKILL.md` directly at its root doesn't match that pattern and isn't reliably discovered — a known, currently open upstream bug (cli/cli#13552) confirms this specifically for root-level single-skill repos. Moving the skill under `skills/keep-the-why/` isn't just tidier structure, it's what makes the recommended install path (`gh skill install oliver-zehentleitner/keep-the-why`) actually work.

It also fixes a second, independent problem: cloning this whole repository into an agent's skills directory (the previous install method) nests an embedded git repository inside the target project and pulls in unrelated files (docs, mkdocs config, CI, evals) that have nothing to do with running the skill.

**Rejected alternative:** keep `SKILL.md` at the root and only document the limitation (`gh skill install` won't discover it, use manual clone instead). Rejected because the manual-clone fallback has its own real problem (the embedded-repo issue above) — accepting both limitations to avoid one file move wasn't a good trade.

## `release.yml`'s checkout pins the actual release tag, not the workflow's trigger ref

**Status:** active
**Evidence:** confirmed

The `GH Release` workflow's `checkout` step explicitly sets `ref: ${{ github.event.inputs.tag || github.ref }}`, and "Move latest tag" moves `latest` to that same resolved tag rather than an implicit `HEAD`.

**Reason:** `actions/checkout@v4` without an explicit `ref` checks out whatever triggered the workflow. For the normal tag-push trigger that's already correct (the trigger ref *is* the tag). For a manual `workflow_dispatch` run with a typed-in tag input, though, the trigger ref is whatever branch the dispatch was run from — not necessarily the tag someone typed into the input box. Without pinning `ref` explicitly, a manual dispatch could package and release the wrong commit under the requested tag's name. Caught by external review; we'd only ever used the tag-push path in practice, so it hadn't surfaced.

**Rejected alternative:** leave it as-is, reasoning that we never actually use manual dispatch. Rejected — the input field existing at all implies it's meant to work correctly, and a latent bug that only bites on a rarely-used path is still worth fixing once known.

## skills.sh rides the moving `latest` tag; awesome-copilot needs a pinned release instead

**Status:** active
**Evidence:** confirmed

skills.sh resolves this repo's skill via the moving `latest` tag `release.yml` force-updates on every release (see "`release.yml`'s checkout pins the actual release tag" above) — no separate registration step needed per release. GitHub's Copilot plugin marketplace (`awesome-copilot`) was initially assumed to work the same way, registering this repo as a remote plugin source with `ref: latest`. That assumption was wrong: `awesome-copilot`'s external-plugin intake explicitly requires an immutable locator (a release tag or full 40-character commit SHA) — its issue submission template has a required checkbox stating the provided ref/sha "is immutable ... not a branch," and a force-moved tag like `latest` would make that confirmation false even though it isn't a branch. A first attempt at this (PR github/awesome-copilot#2469) also used the wrong contribution path entirely — hand-editing `.github/plugin/marketplace.json`, which is a generated file (`eng/generate-marketplace.mjs`); external plugins go through a GitHub Issue using the `external-plugin.yml` form instead, which their `.github/plugin/plugin.json` explicitly forbids doing via direct PR. Closed and corrected.

**Reason:** immutability is a real security property their intake process wants for external, third-party-hosted plugins — a reviewed submission shouldn't be able to change what it points to after approval. `latest` is deliberately mutable (that's the whole point for skills.sh), so it can't honestly satisfy that checkbox for `awesome-copilot`, even though nothing in the string-based ref validator would catch it mechanically.

**Rejected alternative:** submit `ref: latest` anyway, since the validator doesn't reject the literal string. Rejected — passing an automated check by exploiting what it doesn't verify isn't the same as meeting the stated requirement, and this project doesn't want to misrepresent a submission's immutability to get a marketplace listing.

**Consequence:** for `awesome-copilot` specifically, each meaningful release needs a fresh immutable ref (a version tag, e.g. `v0.5.1`) — unlike skills.sh, this one doesn't ride `latest` for free. Only the *first* submission goes through their Issue form and full maintainer review; per their `CONTRIBUTING.md` ("Updating listed external plugins via PR"), later version bumps for an already-approved listing go through a direct PR updating `plugins/external.json`, which only runs automated quality gates — lighter than the initial review, but still a PR we have to open per release. Their process also re-reviews approved listings every six months on the maintainer side (`re-review-due`); no action needed from us unless they flag `re-review-follow-up`.

**Known consumers of this repo's tags** (keep current — a reason `release.yml`'s tag-move step, and future release tags generally, can't be dropped or changed casually):
- skills.sh — via the moving `latest` tag
- GitHub Copilot plugin marketplace (`awesome-copilot`), planned — via a pinned release tag, submitted through their external-plugin Issue form

## `.claude-plugin/plugin.json` is a second, separate manifest — not a replacement for the root `plugin.json`

**Status:** active
**Evidence:** confirmed

Added `.claude-plugin/plugin.json` (the official Claude Code plugin manifest, verified against Anthropic's own `plugin.json` schema reference) alongside the existing root `plugin.json` (built for GitHub's Copilot CLI plugin marketplace format, see the `awesome-copilot` entries above). Two files, two different consumers, both needed.

**Reason:** Claude Code and GitHub Copilot CLI each define their own plugin manifest format and expected file location — `.claude-plugin/plugin.json` versus a root-level `plugin.json` — and neither reads the other's. Consolidating into one file wasn't an option once both ecosystems mattered to us; each needs its own, correctly located manifest. Claude Code's schema has no `skills` field at all — skills are auto-discovered from a `skills/` (or `commands/`) directory at the plugin root by convention — unlike the Copilot CLI schema, which requires listing `skills` explicitly. This is why `.claude-plugin/plugin.json` doesn't need a `skills` field even though the root one does.

**Rejected alternative:** try to find or invent one manifest format both ecosystems would accept. Rejected — not viable; the two schemas are independently defined by different vendors with different required fields and file locations. Maintaining two small, correctly-targeted manifests is simpler than fighting that.

**Related:** the "Composition with other skills" section in `SKILL.md` was written generically (no specific framework named) rather than tailored to any one methodology-style skill framework we might integrate with — the positioning (cross-cutting persistence, not a workflow orchestrator) is true regardless of which specific framework it's composed alongside, and naming one by name in the skill's own evergreen content would date quickly and read as an unearned endorsement or dependency.
