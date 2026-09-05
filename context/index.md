# Context index

Why this project is built the way it is.

- [compatibility.md](compatibility.md) — findings from testing Keep the Why alongside other skills/frameworks, and design decisions about the skill's own activation/setup-triggering behavior
- [config-format.md](config-format.md) — design of the skill's own setup/config mechanism (`.keep-the-why`/`~/.keep-the-why/` files, `context-schema`, confirmation settings, pinned versions)
- [entry-format.md](entry-format.md) — design of `context/` entries and layout themselves: flat directory (no subdirectories), the `Type` field
- [evals.md](evals.md) — design of the eval runner and suite (`tools/evals/`): package layout, what the judge and the mechanical checks each decide
- [lint.md](lint.md) — design decisions internal to the structural linter (`lint/`): schema gating, severity model, parsing heuristics
- [positioning.md](positioning.md) — editorial/positioning choices for README, `llms.txt`, and docs
- [release-and-distribution.md](release-and-distribution.md) — how this repo builds, releases, and gets distributed/installed across ecosystems
