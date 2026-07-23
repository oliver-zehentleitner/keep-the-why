# Contributing

Keep the Why is small on purpose — contributions that keep it that way are especially welcome.

The installable skill package lives under `skills/keep-the-why/` (SKILL.md, references/, examples/, evals/). Everything else at the repo root (docs/, mkdocs config, context/) is the project's own site and self-documentation, not part of what gets installed.

## What's useful

- Real examples from applying the skill to an actual repository (continuous, retrospective, or interview mode) — even a rough write-up in `skills/keep-the-why/examples/` is valuable.
- Sharper wording in `skills/keep-the-why/SKILL.md` itself, especially anything that makes the Evidence (confirmed / inferred / unknown) or Status (active / superseded / open / needs-review) classification more reliable in practice.
- Additional eval cases in `skills/keep-the-why/evals/evals.json` — particularly failure modes you've hit (hallucinated rationale, generic interview questions, index bloat) that aren't covered yet.
- **Cross-agent test results.** The evals exist, but nobody's run the full set against Claude Code, Codex CLI, and Gemini CLI yet and published the results — that's a real gap, not something this project claims to have done. If you run the evals against an agent, open an issue or PR with what you found (pass/fail per case, agent, and version) — that's exactly the kind of verified claim worth adding to the README once there's actual data behind it.
- Corrections to the prior-art comparison in the README — if something is inaccurate or missing, say so.

## What to avoid

- Don't expand `SKILL.md` itself with content that belongs in `skills/keep-the-why/references/`. It's meant to stay small enough to load cheaply; detail goes in reference files, loaded on demand.
- Don't propose a rigid, one-size-fits-all repository template. The whole point is that structure adapts to the project — keep guidance in `skills/keep-the-why/references/repository-structure.md` illustrative, not prescriptive.

## Process

Open an issue or a PR — for anything beyond a small fix, an issue first is appreciated so the direction can be discussed before the work is done.

## Before opening a PR

For any change to the skill's rules, workflow, or reference docs, check whether it also needs updating in:

1. `skills/keep-the-why/SKILL.md` — Core Rules, Workflow, Reference file list
2. The affected `skills/keep-the-why/references/*.md` files
3. **`skills/keep-the-why/references/migrations.md`** — if the change alters the *format* of existing `context/` entries (new/renamed/restructured fields), add a migration entry in the same PR, not later at release time. Most changes don't touch the format at all; skip this when they don't.
4. `skills/keep-the-why/evals/evals.json` — does the change need a new case, or invalidate an existing one? Validate with `python3 -c "import json; print(len(json.load(open('skills/keep-the-why/evals/evals.json'))))"`
5. `docs/*.md` — include-wrapper pages and `mkdocs.yml` nav, if a reference file is new
6. `README.md` — if the change affects something described or promised there
7. `llms.txt` — if the change affects the Core Concept or payoff, not just implementation detail
8. `CHANGELOG.md` — add a line under `[Unreleased]`
9. `context/repo-conventions.md` — if the change itself was a non-obvious decision worth dogfooding
10. `mkdocs build --strict` before committing — catches broken links and nav mistakes

## Release checklist (maintainer)

1. Bump `metadata.version` in `skills/keep-the-why/SKILL.md` frontmatter
2. Update the `Version:` line in `llms.txt` to match
3. In `CHANGELOG.md`, rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` and add a fresh empty `[Unreleased]` above it
4. **Verify `skills/keep-the-why/references/migrations.md` already covers every `context/` format change since the last release** — this should already be true if step 3 of the pre-PR checklist was followed each time, but check before tagging, not after. This is the one that must never be found out of sync retroactively.
5. If this repo's own `context-schema` (in `AGENTS.md`) is behind the version just released and something in `migrations.md` applies to `context/repo-conventions.md`: migrate it now, dogfooding the same process a user would go through
6. Tag `vX.Y.Z` and push the tag — the `GH Release` workflow creates the release and moves the `latest` tag automatically

Oliver runs this personally, or asks the assisting agent to run it on his explicit request for a specific version — never triggered on its own initiative just because a PR merged.
