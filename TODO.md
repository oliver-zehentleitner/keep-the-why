# TODO

Open work that is not a bug and not a design question — those go to
[issues](https://github.com/oliver-zehentleitner/keep-the-why/issues).
Last reviewed: 2026-09-09.

## In progress

### Active

- [ ] **Two wizards are two messages** — the three wizard-presentation flips
  from the 0.15.0 measurement, fixed in `SKILL.md` step 0,
  `references/setup.md` and the retrofitting rule in
  `references/repository-structure.md`, re-measured 9/9 on the three cases
  (`init-wizard-first-activation`, `wizard-defaults-one-list-per-wizard`,
  `negative-existing-good-structure-untouched`). Pull request #343, awaiting
  merge; ships with the next release.

### Pending

- [ ] **Next skill release (0.16.0).** Unreleased on `main`: the Codex plugin
  manifest and one-plugin marketplace (#340), the HOL scanner workflow (#336,
  #337), `experiments/rejected-change/` (#334), and #343 once merged. The
  Codex manifest is a new install surface, so a minor, not a patch. Checklist
  in `CONTRIBUTING.md`: linter first, then the tag, then three full eval runs
  into `docs/evals.md`. Waits on the maintainer's call.
- [ ] **HOL / awesome-ai-plugins listing**
  ([hashgraph-online/awesome-ai-plugins#257](https://github.com/hashgraph-online/awesome-ai-plugins/pull/257)).
  Contribution check passes; the maintainers' centralized scan still runs an
  older scanner release whose secret heuristic flags an eval case id, which
  is explained in the PR. Waits on their rerun or merge. Afterwards: claim
  the listing on hol.org (repository owner), and add the HOL registry to
  `llms.txt` under "Also Listed On".
- [ ] **awesome-copilot**
  ([github/awesome-copilot#2984](https://github.com/github/awesome-copilot/pull/2984)),
  bump to 0.15.0, waits on their review. Bump again in place when the next
  release exists.
- [ ] **Agent & model matrix rebuild** (`docs/agent-matrix.md`). The tooling
  (`tools/evals/run.py --matrix`) is ready; the matrix was last built against
  0.9.x. Waits on two decisions: whether `chestertons-fence-guard` is still
  the representative case, and whether the Mistral column stays given its
  per-run cost. Before the rebuild, add a Gemini CLI driver under
  `tools/evals/ktw_evals/drivers/` (the matrix has a column for it, the runner
  has no driver) and verify it on one case; a new driver uses
  `common.fake_home_env` like the others.

## Ideas

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
  the install.
