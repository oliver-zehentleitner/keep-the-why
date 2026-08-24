# Contributing

Keep the Why is small on purpose — contributions that keep it that way are especially welcome.

The installable skill package lives under `skills/keep-the-why/` (SKILL.md, references/, examples/). Everything else at the repo root (docs/, mkdocs config, context/, `tools/evals/`) is the project's own site and self-documentation, not part of what gets installed.

## What's useful

- Real examples from applying the skill to an actual repository (continuous, retrospective, or interview mode) — even a rough write-up in `skills/keep-the-why/examples/` is valuable.
- Sharper wording in `skills/keep-the-why/SKILL.md` itself, especially anything that makes the Evidence (confirmed / inferred / unknown) or Status (active / superseded / open / needs-review) classification more reliable in practice.
- Additional eval cases in `tools/evals/evals.json` — particularly failure modes you've hit (hallucinated rationale, generic interview questions, index bloat) that aren't covered yet.
- **Cross-agent test results.** The full set runs against Claude Code via the local runner in `tools/evals/` (fixture projects, real agent sessions, an LLM judge — see its README). Nobody's run it against Codex CLI, Gemini CLI, or other agents yet and published the results — that's the remaining gap, tracked with current status and findings in [issue #131](https://github.com/oliver-zehentleitner/keep-the-why/issues/131). If you run the evals against another agent, open an issue or PR with what you found (pass/fail per case, agent, and version) — that's exactly the kind of verified claim worth adding to the README once there's actual data behind it.
- Corrections to the README's "Related work" section — if something is inaccurate or missing, say so.

## What to avoid

- Don't expand `SKILL.md` itself with content that belongs in `skills/keep-the-why/references/`. It's meant to stay small enough to load cheaply; detail goes in reference files, loaded on demand.
- Don't propose a rigid, one-size-fits-all repository template. The whole point is that structure adapts to the project — keep guidance in `skills/keep-the-why/references/repository-structure.md` illustrative, not prescriptive.

## Process

[Open an issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new/choose) or a PR — for anything beyond a small fix, an issue first is appreciated so the direction can be discussed before the work is done. Same link for a bug report, confusing docs, or the skill just not doing what it claims — not only for planned contributions.

**Pushing a change that touches `.github/workflows/*.yml`?** GitHub rejects that push unless your credential has the `workflow` OAuth scope, independently of `repo` — this hits any token or bot/automation account missing it, not just this repo (see `context/release-and-distribution.md` for why). If yours lacks it: commit the workflow file's content separately, push everything else normally, and have someone with the right scope add the workflow file itself (GitHub UI or their own credentials).

## Before opening a PR

For any change to the skill's rules, workflow, or reference docs, check whether it also needs updating in:

1. `skills/keep-the-why/SKILL.md` — Core Rules, Workflow, Reference file list
2. The affected `skills/keep-the-why/references/*.md` files
3. **`skills/keep-the-why/references/migrations.md`** — if the change alters the *format* of existing `context/` entries (new/renamed/restructured fields), add a migration entry in the same PR, not later at release time. Most changes don't touch the format at all; skip this when they don't.
4. `tools/evals/evals.json` — does the change need a new case, or invalidate an existing one? Validate with `python3 -c "import json; print(len(json.load(open('tools/evals/evals.json'))))"`. A new or changed case usually also needs a matching fixture under `tools/evals/fixtures/` so the runner can execute it — see `tools/evals/README.md`. **If the case count changed, update every place that hardcodes it**: `docs/evals.md`'s opening line ("The skill ships N eval cases") and the `--all` comment in `tools/evals/README.md`. `README.md` and `llms.txt` deliberately don't hardcode it (see `CHANGELOG.md`) — leave those as "a suite of eval cases".
5. `docs/*.md` — include-wrapper pages and `mkdocs.yml` nav, if a reference file is new
6. `README.md` — if the change affects something described or promised there
7. `llms.txt` — if the change affects the Core Concept or payoff, not just implementation detail
8. `CHANGELOG.md` — add a line under `[Unreleased]`. Reuse the existing `### Added` / `### Changed` / `### Fixed` heading for that category if one's already there in this `[Unreleased]` block — don't open a second one. Within a category, keep entries alphabetically ordered by their first word, not insertion order.
9. `context/` — if the change itself was a non-obvious decision worth dogfooding (pick the topic file it actually belongs in, or start a new one — see `references/repository-structure.md`)
10. `mkdocs build --strict` before committing — catches broken links and nav mistakes

## Release checklist (maintainer)

Steps 1–3 and 6–7 below are also checked automatically by the "Check version consistency across the repo" step in `validate-skill.yml`, on every push and PR — it fails loudly if any of these drift apart, rather than relying on the manual steps alone catching it.

1. Bump `metadata.version` in `skills/keep-the-why/SKILL.md` frontmatter
2. Update the `Version:` line in `llms.txt` to match
3. Update the `version` field in `plugin.json` and `.claude-plugin/plugin.json` to match
4. In `CHANGELOG.md`, rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` and add a fresh empty `[Unreleased]` above it
5. **Verify `skills/keep-the-why/references/migrations.md` already covers every `context/` format change since the last release** — this should already be true if step 3 of the pre-PR checklist was followed each time, but check before tagging, not after. This is the one that must never be found out of sync retroactively.
6. This repo's own `context-schema` (in `AGENTS.md`) must never trail the version just released, same as `setup.md`'s "context-schema behind metadata.version" logic requires of any project: if something in `migrations.md` applies to this repo's own `context/` entries, migrate them now (dogfooding the same process a user would go through), then advance `context-schema` to match. If nothing applies, still advance `context-schema` to match — don't leave it pointing at an older version just because there was nothing to migrate.
7. Bump every illustrative `context-schema` value shown in the skill's own docs to match — currently in `references/setup.md` and `references/repository-structure.md`'s config block examples, and `examples/first-time-setup.md`'s. `grep -rn "context-schema: 0\." skills/keep-the-why/` to find all of them; these are hardcoded example versions, not placeholders, so each one goes stale on every release that doesn't touch the `context/` format, same as this repo's own `AGENTS.md` would without step 5. Evals that deliberately construct a historical or relative version scenario (e.g. testing the migration-detection or ahead-of-installed-version logic) are not examples of "current state" and don't need updating — only config-block snippets meant to represent a project set up today.
8. Tag `vX.Y.Z` and push the tag — the `GH Release` workflow creates the release and moves the `latest` tag automatically
9. Once the tag exists, open a PR against `github/awesome-copilot` bumping this plugin's `version`/`source.ref` in `plugins/external.json` (from a synced fork — `oliver-zehentleitner-aigent/awesome-copilot`), then regenerate `.github/plugin/marketplace.json` with `npm run plugin:generate-marketplace` and include it in the same commit — see `context/release-and-distribution.md`'s "skills.sh rides the moving `latest` tag; awesome-copilot needs a pinned release instead." A standing step now that the repo is listed there, not a one-time thing.

Oliver runs this personally, or asks the assisting agent to run it on his explicit request for a specific version — never triggered on its own initiative just because a PR merged. This includes step 9.
