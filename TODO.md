# TODO

Open work that is not a bug and not a design question — those go to
[issues](https://github.com/oliver-zehentleitner/keep-the-why/issues). Items
here are known next steps, waiting on a decision, a release, or someone else.
Last reviewed: 2026-09-08.

## Release

- [ ] **Next skill release.** Unreleased on `main`: the Codex plugin manifest and
  one-plugin marketplace (#340), the HOL scanner workflow (#336, #337), and
  `experiments/rejected-change/` (#334). The Codex manifest is a new install
  surface, so this is a minor (0.16.0), not a patch. Checklist in
  `CONTRIBUTING.md`: linter first, then the tag, then three full eval runs
  into `docs/evals.md`.

## Skill text

- [ ] **One-list wizard, one message per wizard.** The 0.15.0 measurement
  (`docs/evals.md`) shows three presentation flips with a clean tree: twice
  both wizards' lists in one message, once "one question at a time". Decide
  whether `references/setup.md` needs one more sentence — "the personal list
  is a second message, after the project answer" — or whether the next
  series settles it. Eval cases: `init-wizard-first-activation`,
  `wizard-defaults-one-list-per-wizard`,
  `negative-existing-good-structure-untouched`.

## Listings

- [ ] **HOL / awesome-ai-plugins**
  ([hashgraph-online/awesome-ai-plugins#257](https://github.com/hashgraph-online/awesome-ai-plugins/pull/257)).
  Contribution check passes; the maintainers' centralized scan still runs the
  older scanner release whose secret heuristic flags an eval case id, which
  is explained in the PR. After merge: claim the listing on hol.org
  (repository owner), and add the HOL registry to `llms.txt` under "Also
  Listed On".
- [ ] **awesome-copilot**
  ([github/awesome-copilot#2984](https://github.com/github/awesome-copilot/pull/2984)),
  bump to 0.15.0, waiting on their review. Bump again in place when the next
  release exists.

## Evals

- [ ] **Agent & model matrix rebuild** (`docs/agent-matrix.md`). The tooling
  (`tools/evals/run.py --matrix`) is ready; the matrix was last built against
  0.9.x. Before rebuilding: add a Gemini CLI driver under
  `tools/evals/ktw_evals/drivers/` (the matrix has a column for it, the runner
  has no driver) and verify it on one case; decide whether
  `chestertons-fence-guard` is still the representative case, and whether the
  Mistral column stays given its per-run cost. A new driver must use
  `common.fake_home_env` like the others.
- [ ] **Codex plugin install as an eval condition.** The Codex driver hands the
  skill to the agent by path today; with the plugin manifest in place, a
  variant that installs through `codex plugin add` would measure the
  documented install route rather than the by-hand one.

## Housekeeping

- [ ] **Topic-file size threshold** — open as
  [#256](https://github.com/oliver-zehentleitner/keep-the-why/issues/256):
  learn it from real repositories, don't invent one.
