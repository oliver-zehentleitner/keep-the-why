# Contributing

Keep the Why is small on purpose — contributions that keep it that way are especially welcome.

The installable skill package lives under `skills/keep-the-why/` (SKILL.md, references/, examples/, evals/). Everything else at the repo root (docs/, mkdocs config, context/) is the project's own site and self-documentation, not part of what gets installed.

## What's useful

- Real examples from applying the skill to an actual repository (continuous, retrospective, or interview mode) — even a rough write-up in `skills/keep-the-why/examples/` is valuable.
- Sharper wording in `skills/keep-the-why/SKILL.md` itself, especially anything that makes the "confirmed / inferred / unknown" distinction more reliable in practice.
- Additional eval cases in `skills/keep-the-why/evals/evals.json` — particularly failure modes you've hit (hallucinated rationale, generic interview questions, index bloat) that aren't covered yet.
- Corrections to the prior-art comparison in the README — if something is inaccurate or missing, say so.

## What to avoid

- Don't expand `SKILL.md` itself with content that belongs in `skills/keep-the-why/references/`. It's meant to stay small enough to load cheaply; detail goes in reference files, loaded on demand.
- Don't propose a rigid, one-size-fits-all repository template. The whole point is that structure adapts to the project — keep guidance in `skills/keep-the-why/references/repository-structure.md` illustrative, not prescriptive.

## Process

Open an issue or a PR — for anything beyond a small fix, an issue first is appreciated so the direction can be discussed before the work is done.
