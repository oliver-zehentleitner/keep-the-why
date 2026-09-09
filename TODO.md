# TODO

Open work that is not a bug and not a design question — those go to
[issues](https://github.com/oliver-zehentleitner/keep-the-why/issues).
Last reviewed: 2026-09-09.

## In progress

### Active

Nothing in flight.

### Pending

- [ ] **0.16.0 release measurement.** The skill is tagged (`v0.16.0`,
  2026-09-09; linter 0.16.0.0 on PyPI first, per the checklist). What is
  still open is the measurement: three consecutive full eval runs on the tag
  (`--all --parallel 2 --judge-always --retry-until-complete`, TMPDIR outside
  the home directory, Claude Code CLI 2.1.266) into `docs/evals.md` — the
  four numbers per run, a note on every failed run, a run-history row. The
  series is running; results land in `tools/evals/results/full-v0.16.0-r1`
  to `-r3`.
- [ ] **HOL / awesome-ai-plugins listing**
  ([hashgraph-online/awesome-ai-plugins#257](https://github.com/hashgraph-online/awesome-ai-plugins/pull/257)).
  Rebased on their request; all five catalog checks pass, including the
  source-repository scan. Waits on their merge. Afterwards, two steps: the
  repository owner claims the listing on hol.org ("Claim this listing" —
  ownership proof, unlocks managing the registry page: media, first comment,
  launch day); then add the HOL registry to `llms.txt` under "Also Listed
  On".
- [ ] **awesome-copilot**
  ([github/awesome-copilot#2998](https://github.com/github/awesome-copilot/pull/2998)),
  bump to 0.16.0, waits on their review; #2984 (0.15.0) is merged. Every
  release gets its own bump PR there.
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
  the install. A `.codexignore` exists since #351, for the HOL scanner's
  best-practice check; whether Codex reads it is unverified (see
  `context/release-and-distribution.md`), so it lists local state only, not
  the docs or the evals.
