# Repository conventions

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

## Launch-readiness pass: SKILL.md trimmed, negative evals added, README reordered

**Status:** active
**Evidence:** confirmed

Four changes made together ahead of publishing to skill marketplaces: `SKILL.md` cut from ~2100 to ~1580 words (merged redundant rules, tightened the Record workflow step instead of restating rules 9/13 in full); six negative-case evals added (routine changes that shouldn't trigger the skill, an already-good doc structure that shouldn't be rebuilt, conflicting sources, a secret in an interview answer, a stale confirmed decision past its revisit trigger); README reordered so Install and a concrete Example come right after the pitch, with the longer "Problem" and "Where this fits" sections moved below instead of gating the actionable content; and social preview meta tags (Open Graph/Twitter card, pointing at the existing logo) added via a small `overrides/main.html` template.

**Reason:** all four came out of an external review before the intended launch — the SKILL.md length and README ordering were both flagged as things a technically experienced reader would stumble on even though the underlying idea was sound, and the missing negative evals were a real gap (every existing eval tested "the skill should do X," none tested "the skill should stay quiet" or "the skill should flag a conflict instead of guessing").

**Rejected/deferred:** a cross-agent test matrix (Claude Code, Codex CLI, Gemini CLI) was suggested alongside the evals. Not done here — this environment only has access to Claude Code, and claiming test results without having actually run them would violate rule 1 (never invent) applied to the project's own claims about itself. `CONTRIBUTING.md` asks for real cross-agent results as a contribution instead of asserting them prematurely.

## Setup/init state is tracked opportunistically, not via a real background schedule

**Status:** active
**Evidence:** confirmed

The skill's periodic checks (update availability, `context/` staleness) run as an "elapsed time since last check" comparison evaluated whenever the skill is already active in a session — not a true OS-level scheduled job (`cron`, Task Scheduler) that wakes something up on its own.

**Reason:** a Skill has no background execution — it only runs inside an active agent session. A real OS cron entry would need to shell out to a specific agent's non-interactive invocation (e.g. `claude -p "..."`), which only works for agents that expose one and ties the mechanism to a single vendor, contradicting the project's cross-agent goal. Comparing elapsed time on every session start works identically regardless of which agent is running the skill.

**Rejected alternative:** a real OS-level scheduled job that invokes an agent CLI directly. Rejected for the cross-agent portability reason above, not for being harder to build — it's better *if* you only ever use one specific agent, but that's not a constraint this project wants to impose.

## Config state lives in delimited blocks inside existing entry-point files, not a separate file

**Status:** active
**Evidence:** confirmed

Setup state is written into `<!-- keep-the-why:config -->` / `<!-- keep-the-why:local -->` blocks inside files the project already has a reason to read (`AGENTS.md` and `AGENTS.local.md`), not a dedicated state file.

**Reason:** keeps the state next to files every agent working in the repo is already expected to read, instead of adding a new file nobody has a reason to look at otherwise. The HTML-comment delimiters keep it easy to locate and parse without needing to interpret the rest of the file, and keep it visually out of the way of the human-readable pointer content those files are otherwise supposed to stay limited to.

**Rejected alternative:** a separate state file (e.g. `.keep-the-why.json`). Rejected because it adds a file whose only reader is this skill, splits state away from the files that already serve as the project's agent entry points, and a dedicated dotfile invites exactly the kind of "second undocumented system" the config-block approach was chosen to avoid.

## Setup state splits across a project block and a personal block

**Status:** active
**Evidence:** confirmed

Where `context/` lives, whether the project has been initialized, and how much confirmation is needed before writing (`capture-confirmation`) are in the committed `AGENTS.md` config block. Capture-mode preference, `confirmation-flow` (how multiple pending confirmations get presented), and the update-check/consistency-check intervals and their last-run timestamps, are in the personal, uncommitted `AGENTS.local.md` block instead. A project can be `init: complete` while a specific developer still gets asked their own preferences, if they don't have an `AGENTS.local.md` yet.

**Reason:** the first version bundled everything into one committed block. Oliver pointed out that capture-mode and check-interval preferences are individual workflow choices, not project facts — one developer wanting weekly update checks and another wanting none are both fine, and forcing one answer onto everyone (or making it a merge-conflict-prone shared timestamp several sessions race to update) doesn't fit the existing `AGENTS.md`/`AGENTS.local.md` boundary this project already draws for exactly this kind of distinction.

**Rejected alternative:** one combined block covering both project and personal state, as originally shipped. Rejected once the personal/project distinction became clear — see above.

## Update-check failures get surfaced once, not swallowed indefinitely

**Status:** active
**Evidence:** confirmed

If the update check can't run (no web access this session), the first failure is reported and the user is asked whether to keep retrying each session or turn the check off. Subsequent identical failures don't re-ask.

**Reason:** the first version skipped silently on failure, on the reasoning that a check that can't run shouldn't nag about it. Oliver pointed out the actual risk: for a user whose agent never has web access, that check would be permanently and invisibly broken — silence reads as "nothing to report," not "this has never once worked." A single surfaced notice, with the option to just turn it off, avoids both the nagging and the false sense that the check is doing anything.

**Rejected alternative:** always skip silently on failure (the first version). Rejected because it can't be distinguished from "checked, nothing new" — the two states look identical to the user, and one of them is worth knowing about.


## `context-schema` always tracks the released version, even when nothing migrated

**Status:** active
**Evidence:** confirmed

Every release advances this repo's own `context-schema` (in this file's config block) to match the just-released `metadata.version`, even when that release introduced no `context/` entry format change — not just when `migrations.md` had something to apply.

**Reason:** during the 0.3.1 release, `context-schema` was left at `0.3.0` because nothing in `migrations.md` applied to the 0.3.0→0.3.1 gap — but "nothing to migrate" and "don't advance the number" are different things. Leaving it behind made a later external review flag it as if the skill's own schema-comparison logic were broken, when the actual bug was simpler: the release process itself skipped the catch-up step that `setup.md`'s existing behind-case logic already calls for.

**Rejected alternative:** a separate `metadata.context-schema` field in `SKILL.md`, decoupled from `metadata.version`, so schema and release versioning could drift independently. Rejected — the existing single-version-axis model (check for applicable migrations, advance the number whether or not anything applied) already does everything a second version field would, without a second number to keep in sync.

## `release.yml`'s checkout pins the actual release tag, not the workflow's trigger ref

**Status:** active
**Evidence:** confirmed

The `GH Release` workflow's `checkout` step explicitly sets `ref: ${{ github.event.inputs.tag || github.ref }}`, and "Move latest tag" moves `latest` to that same resolved tag rather than an implicit `HEAD`.

**Reason:** `actions/checkout@v4` without an explicit `ref` checks out whatever triggered the workflow. For the normal tag-push trigger that's already correct (the trigger ref *is* the tag). For a manual `workflow_dispatch` run with a typed-in tag input, though, the trigger ref is whatever branch the dispatch was run from — not necessarily the tag someone typed into the input box. Without pinning `ref` explicitly, a manual dispatch could package and release the wrong commit under the requested tag's name. Caught by external review; we'd only ever used the tag-push path in practice, so it hadn't surfaced.

**Rejected alternative:** leave it as-is, reasoning that we never actually use manual dispatch. Rejected — the input field existing at all implies it's meant to work correctly, and a latent bug that only bites on a rarely-used path is still worth fixing once known.

## `capture-confirmation` is project-wide only, for now — deliberately, to test first

**Status:** active
**Evidence:** confirmed

`capture-confirmation` (automatic / confirm-always / confirm-when-unsure — how much permission is needed before writing to `context/`) lives only in the project config block (`AGENTS.md`), with no personal override in this release, even though `capture-mode` and `confirmation-flow` are both personal.

**Reason:** Oliver's call: test the setting project-wide first and see how it behaves in practice before deciding whether individual developers should be able to override it. The resolution order (session instruction → personal setting → project setting → default) is deliberately structured so a personal override slots in later without restructuring anything — same pattern as `migration-prompt: <version> declined` — but adding it now, before there's any real usage to learn from, would be guessing at a need rather than confirming one.

**Rejected alternative:** ship a personal override immediately, symmetric with `capture-mode` and `confirmation-flow`. Rejected for now — not because it's wrong in principle, but because whether developers actually want to diverge from the project's confirmation bar is an open question this release is meant to help answer, not one to presume the answer to upfront.

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

## No name-by-name comparison against competing tools, only named standards

**Status:** active
**Evidence:** confirmed

README's and `llms.txt`'s "Related work" don't compare Keep the Why against specific competing tools or skills by name (`git-why`, Agent Decision Records, Addy Osmani's `documentation-and-adrs` skill, and similar were removed). What stays named: Architecture Decision Records and the AGENTS.md standard — genuine open standards/conventions this project builds alongside, not competitors. The distinguishing description points to `docs/philosophy.md` and "What this is not" instead of a per-project comparison table.

**Reason:** started as a fix for a broken link (Agent Decision Records pointed at a generic personal homepage), but the real problem is structural: any name-by-name list of competing tools is incomplete the moment it's written and stale soon after — new tools appear, others go unmaintained, and keeping the list accurate becomes its own maintenance burden unrelated to this project's actual job.

**Rejected alternative:** keep a maintained comparison table and just fix the broken link. Rejected — doesn't address why it went stale in the first place, and the same drift would recur.

**Consequence, caught late:** `docs/faq.md`'s "How is this different from git-why, AgDR, or similar projects?" entry was missed when this changed elsewhere (README, `llms.txt`) — it named both tools and pointed at a README section ("Not a green field") that no longer exists under that name (now "Related work"). Fixed once noticed; recorded here so the next place this wording lives doesn't get missed the same way.

## `source-reference` asks about ticket/issue links, doesn't require one to exist, and ships project-wide only

**Status:** active
**Evidence:** confirmed

New project setting `source-reference` (`always` / `never` / `filtered: <criteria>`, default `never`) governs whether the skill actively asks for a related issue, ticket, PR, or post-mortem when recording a `context/` entry — distinct from rule 2's existing Source field, which was already able to hold this but was never actively sought.

**Reason:** prompted by an external review of this project pointing out that a "why" is strongest when it's traceable to something concrete like a tracked incident or ticket. The underlying capability already existed (Source, rule 2) — what was missing was ever proactively asking for it. Making that its own setting, rather than folding it into `capture-confirmation`, keeps the two questions separate: whether writing needs permission (`capture-confirmation`) is orthogonal to whether the skill goes looking for a ticket reference (`source-reference`) — a project could want one without the other.

**Rejected alternative:** a rigid per-entry YAML/frontmatter schema with a mandatory ticket-ID field (the shape the original suggestion came in, closer to ADR/AgDR-style structured records). Rejected — this project already differentiates itself from one-file-per-decision, rigid-schema tools (see "No name-by-name comparison" above); a mandatory structured field pushes toward exactly that model and would need its own `context-schema` migration. Recording Source in prose, same as today, keeps the format unchanged — only whether it gets actively asked for changes.

**Rejected alternative (the `filtered` mechanism specifically):** a fixed taxonomy of filter categories (by topic file, by Status, by severity) defined by the skill. Rejected in favor of free text the project defines itself — a fixed taxonomy would be guessing at categories before there's real usage to learn from, the same reasoning already applied to keeping `capture-confirmation` project-wide-only for now (see above).

**Consequence:** `always` (or a matching `filtered` criterion) means asking is mandatory, but a reference existing is not — "no, nothing tracks this" is a complete, valid answer. Inventing a plausible-sounding ticket reference to avoid an empty field would violate rule 1 exactly like inventing rationale would. No personal override in this release, same "test one setting before adding a second axis" precedent as `capture-confirmation`.

## `.claude-plugin/plugin.json` is a second, separate manifest — not a replacement for the root `plugin.json`

**Status:** active
**Evidence:** confirmed

Added `.claude-plugin/plugin.json` (the official Claude Code plugin manifest, verified against Anthropic's own `plugin.json` schema reference) alongside the existing root `plugin.json` (built for GitHub's Copilot CLI plugin marketplace format, see the `awesome-copilot` entries above). Two files, two different consumers, both needed.

**Reason:** Claude Code and GitHub Copilot CLI each define their own plugin manifest format and expected file location — `.claude-plugin/plugin.json` versus a root-level `plugin.json` — and neither reads the other's. Consolidating into one file wasn't an option once both ecosystems mattered to us; each needs its own, correctly located manifest. Claude Code's schema has no `skills` field at all — skills are auto-discovered from a `skills/` (or `commands/`) directory at the plugin root by convention — unlike the Copilot CLI schema, which requires listing `skills` explicitly. This is why `.claude-plugin/plugin.json` doesn't need a `skills` field even though the root one does.

**Rejected alternative:** try to find or invent one manifest format both ecosystems would accept. Rejected — not viable; the two schemas are independently defined by different vendors with different required fields and file locations. Maintaining two small, correctly-targeted manifests is simpler than fighting that.

**Related:** the new "Composition with other skills" section in `SKILL.md` was written generically (no specific framework named) rather than tailored to any one methodology-style skill framework we might integrate with — the positioning (cross-cutting persistence, not a workflow orchestrator) is true regardless of which specific framework it's composed alongside, and naming one by name in the skill's own evergreen content would date quickly and read as an unearned endorsement or dependency.

## "Composition with other skills" needed an explicit re-check instruction, found via real testing

**Status:** active
**Evidence:** confirmed

Added a second paragraph to "Composition with other skills": checking whether Keep the Why applies isn't a one-time, start-of-turn decision — re-check specifically at the natural end of another skill's workflow step (a design settled, a root cause confirmed, an alternative rejected), since that's exactly when capture-worthy content has just been produced.

**Reason:** live-tested against a real methodology-style skill framework (installed via Claude Code's plugin system, `claude plugin install`) in a scratch project. A genuine design decision with a clearly rejected alternative (token bucket vs. a simple sleep-based throttle) played out entirely inside that framework's own brainstorming step. Keep the Why did not activate on its own afterward, despite the content matching its trigger description almost exactly. Asked directly why not, the agent's own explanation: it had checked "does a skill apply" once at the start of the turn (per the other framework's own bootstrap instruction to check before any action), then tracked that framework's workflow state through to completion without re-checking once new decision content had actually been produced mid-conversation. Once explicitly told to invoke Keep the Why afterward, it worked correctly — clean setup wizard, two well-formed entries with Decision/Alternative/Reason and Status/Evidence/Source, nothing committed unasked. The gap was specifically the *automatic* re-trigger, not the capture logic itself.

**Rejected alternative (superseded by the retest below):** leave "Composition with other skills" as originally written and treat this as something the user just has to remember to ask for. Originally rejected on the reasoning that this shouldn't need a manual nudge — see "Update after retest" for why that conclusion changed.

**Verification:** contradicted. Retested the identical scenario (same toy repo, same design conversation, fresh session) with the added re-check instruction in place — Keep the Why still did not self-trigger. Asked directly, the agent confirmed it hadn't re-checked, and explained why: the added instruction lives in `SKILL.md`'s *body*, which only enters context once a skill is already triggered — the trigger decision itself runs against the short frontmatter `description`, which this fix never touched. The instruction was, in effect, circular: only read by an agent that had already done the thing it was there to prompt.

**Update after retest:** decided not to keep chasing this with further prompt-engineering inside our own `SKILL.md` (e.g. moving the cue into `description` itself) — Claude Code's skill activation is model-driven with no hard orchestration layer, so reliability here isn't fully in our control no matter how it's worded, and iterating on wording against a moving, unverifiable target isn't a good use of effort. Two things instead: (1) document the real limitation plainly rather than implying seamless automatic composition — recommend explicitly prompting for a check after a design/debugging session concludes, until proven otherwise; (2) report the finding upstream. The methodology-style framework's own bootstrap instruction already claims to re-check *any* skill's relevance before every action, "even 1% chance" — our test shows that claim doesn't hold once a workflow step is underway. That's a legitimate, evidence-based gap in a claim they already make about their own system, worth telling them directly, not something to quietly route around on our side.

**Reported:** filed as [obra/superpowers#2051](https://github.com/obra/superpowers/issues/2051) — framed explicitly as an observation about their own bootstrap's stated behavior, not a request to change anything for a third-party skill (their `CLAUDE.md` is explicit that third-party-specific asks belong in a separate plugin, not core). Not a marketplace listing, so it doesn't belong in the "Also listed on" tables — a compatibility finding, tracked here instead.

## CI now checks version consistency across the repo, after an external review caught a regressed fix and two smaller drifts by hand

**Status:** active
**Evidence:** confirmed

Added a "Check version consistency across the repo" step to `validate-skill.yml`, comparing `SKILL.md`'s `metadata.version` against `plugin.json`, `.claude-plugin/plugin.json`, `llms.txt`'s `Version:` line, `AGENTS.md`'s `context-schema`, and the three illustrative `context-schema` examples (`references/setup.md`, `references/repository-structure.md`, `examples/first-time-setup.md`) — fails the build if any differ.

**Reason:** an external review found this drift by hand (`llms.txt` had regressed a bug already documented as fixed in `0.3.1`; `.claude-plugin/plugin.json`'s description had fallen out of sync with `SKILL.md`'s — see `CHANGELOG.md` for what those actually were). The manual release checklist already asked for exactly this comparison (steps 1–3, 6–7), and the drift still happened anyway. A CI check that fails loudly doesn't depend on the checklist being followed carefully every single time.

**Consequence — what this can't catch:** only *numeric* drift. There's no cheap, reliable automated check for "does this sentence still say the same thing as that other sentence" — the semantic drift this same review also found needs a human or an external review to catch, same as this time.

**Rejected alternative:** leave version consistency to the manual release checklist alone. Rejected — see Reason above; it already existed and didn't prevent this.
