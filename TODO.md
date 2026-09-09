# TODO

Open work that is not a bug and not a design question — those go to
[issues](https://github.com/oliver-zehentleitner/keep-the-why/issues).
Last reviewed: 2026-09-09 (evening: measurement merged, issue forms and
`context/issue-triage.md` in, labels `skill-wording` and `evals` created).

## In progress

### Active

Nothing in flight.

### Pending

- [ ] **Patch release after the 0.16.0 series.** The measurement is in
  `docs/evals.md` (#357, 86, 84 and 81 of 87). Three findings are issues,
  each waiting on a wording decision by the maintainer before anything is
  patched: #354 (the request's "questions one at a time" answered with one
  list), #355 (the frustration case naming the agent tool's issue tracker;
  before deciding, one run of that case on Claude Code CLI 2.1.263 to
  confirm or drop the CLI-version hypothesis), #356 (`Evidence: confirmed`
  on a lost original reason — a `question`, the two readings are in the
  issue). None of them changes what the skill writes to disk. Release
  order as in `CONTRIBUTING.md`: linter first if a gate changes, then the
  skill tag, then three runs into `docs/evals.md`.
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
