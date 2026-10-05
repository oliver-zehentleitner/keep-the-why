# TODO

Open work that is not a bug and not a design question — those go to
[issues](https://github.com/oliver-zehentleitner/keep-the-why/issues).
Last reviewed: 2026-09-30.

## In progress

### Active

-

### Pending

- [ ] **`docs/security.md` against the skills.sh audits** of 0.18.2, once the
  three auditors have re-audited (release checklist step 12).

## Ideas

- **HOL badges** — parked with the other HOL follow-ups.
- **Dashboard, next:** diff two states (two commits, or an export against
  the working tree); `Revisit when` triggers grouped by the file they point
  at.
- **ai-memory, consolidation with source path.** Part 4 of
  [akitaonrails/ai-memory#700](https://github.com/akitaonrails/ai-memory/issues/700):
  consolidation carrying a file read's source path and refusing
  `kind: decision` for pages whose only evidence is a read under a declared
  record directory. The maintainer wants it as its own issue; only if we
  want to pursue it — `[capture] ignore_paths` already covers Keep the Why.
- **Codex plugin install as an eval condition.** The Codex driver hands the
  skill to the agent by path; with the plugin manifest in place, a variant
  that installs through `codex plugin add` would measure the documented
  install route rather than the by-hand one.
- **Topic-file size threshold** — tracked as
  [#256](https://github.com/oliver-zehentleitner/keep-the-why/issues/256):
  learn it from real repositories, don't invent one.
- **Lean Codex plugin.** The plugin root is the repository root, so
  `codex plugin add` copies about 13 MB. If Codex honors an ignore file for
  plugin packaging, the docs, linter, evals and experiments could stay out of
  the install. A `.codexignore` exists since #351, for the HOL scanner's
  best-practice check; whether Codex reads it is unverified (see
  `context/release-and-distribution.md`), so it lists local state only, not
  the docs or the evals.
