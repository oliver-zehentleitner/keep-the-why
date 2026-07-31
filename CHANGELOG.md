# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- `examples/first-time-setup.md` still showed the pre-0.6.0 project wizard: the `source-reference` question was missing from the dialogue and the field missing from the generated config block. Also corrected the "second developer" walkthrough (and the `wizard-respects-known-confirmation-flow-batch` eval case, which encoded the same error): `confirmation-flow` is stored per checkout in `AGENTS.local.md` and does not travel with the developer across projects — when it's not stored in the current checkout, the wizard asks and records it there. `references/setup.md` now states the per-checkout scope explicitly.
- `llms.txt`'s repo links (`AGENTS.md`, `SKILL.md`, `CHANGELOG`) still pointed at `/blob/main/` — changed to `/blob/latest/`, the same convention the 0.6.2 README link fix established.
- `mkdocs.yml`'s `exclude_docs` still listed `context/naming.md`, a file that no longer exists — removed.
- `README.md`'s "Related work" pointed at "What this is not" as being *above* when the section sits below it; and the setup pointer linked `docs/setup.md`, which on GitHub is a one-line include stub — now links the rendered https://keepthewhy.com/setup/ page instead, per the 0.6.2 link convention.
- `references/repository-structure.md`'s example `AGENTS.md` config block was missing `source-reference`, and the prose beneath it still claimed a real config block "always has both" fields when 0.6.0 made it three.

## [0.6.2] - 2026-07-31

### Added

- "Format" section in README documenting `context/` entry fields (Status, Evidence, Source, Revisit when, ...) directly — discoverable without installing the skill, matching the "repo-native convention, not just an agent skill" framing.
- "Independent verification" section in `docs/security.md`, linking to the SkillsLLM security scan report.

### Changed

- `docs/installation.md`'s GitHub-CLI warning about unverified skills now points to `docs/security.md`, which links onward to the SkillsLLM scan; both "Also listed on" tables link "security scan" directly to the scan report.
- Promoted "Repository structure" from the nested Reference nav group to top-level in `mkdocs.yml`'s nav, since it documents the `context/` format, not skill-usage detail.
- Replaced "trustworthy background" / "trust by default" wording in `docs/security.md` and `references/trust-model.md` with salience framing — the previous wording collided with the Source/evidence-level model (`confirmed`/`inferred`/`unknown`), implying `context/` is trusted by default when it explicitly isn't.
- Split `context/repo-conventions.md` (187 lines, five unrelated topics in one file) into `context/release-and-distribution.md`, `context/config-format.md`, `context/positioning.md`, and `context/compatibility.md` — rule 5 (organize by topic) and rule 8 (split large files) applied to this repo's own `context/`, not just advice given to others. All cross-references (`CONTRIBUTING.md`, `references/setup.md`, `docs/faq.md`, `mkdocs.yml` nav, `docs/context/*.md`) updated to match.

### Removed

- The "Launch-readiness pass" entry in `context/repo-conventions.md` (SKILL.md trimmed, negative evals added, README reordered ahead of the initial launch). On review, none of the four bundled changes had a real rejected alternative — all four were corrections made in response to external review feedback, which rule 6 already excludes from `context/` regardless of significance. The "what happened" is already covered by the `[0.1.0]` entry below.

### Fixed

- Internal links in `README.md` and `docs/security.md` hardcoded to `/blob/main/` (so a tagged checkout's README could show newer, unreleased `main` content instead of that tag's own) — changed to `/blob/latest/` (the project's own recommended pin) or, for pages also mirrored on the docs site (`repository-structure.md`, `methodology.md`), to their `keepthewhy.com` URL. An intermediate fix using bare relative paths broke the "Deploy docs" GitHub Action (`mkdocs build --strict` validates `.md` links against its own `docs_dir`, and these point outside it) — caught and corrected before release.

## [0.6.1] - 2026-07-30

### Added

- Added a "Working conventions" section to `AGENTS.md`, separate from the keep-the-why config block, for plain rules that need no rationale (currently: CHANGELOG heading/ordering).
- Added routing guidance to `references/repository-structure.md`: an embedded procedure, or a rule with no rationale behind it, isn't why-content even when discovered alongside a real decision — route it separately instead of forcing a Decision/Reason/Rejected structure onto it. New eval case.
- Explained why this can't run as a CI/CD check: by the time code is pushed, the reasoning that mattered has usually already happened and isn't recoverable from the diff — CI can verify a `context/` entry exists, not invent one. Extended "No daemon" in `docs/philosophy.md`, and added a new `docs/faq.md` entry, "Could this run as a CI/CD check instead of during development?"
- Sharpened Core Rule 6: a correction (a stale value, a regressed bug, wording fixed back in line with what's already established elsewhere) is not a decision, no matter how significant the fix or how it was surfaced — nothing was chosen between real alternatives. Significance and decision-worthiness are different questions; rule 13 tests the former, this rule the latter. New eval case.

### Changed

- Moved README's Claude Code plugin manifest mention out of "How it works" and into "Install", next to the other install methods, where it actually belongs. Removed the "How it works" pointer at the FAQ's Superpowers-composition entry entirely — the FAQ already stands on its own without a teaser sentence duplicating it.
- README's "Where this fits" table: `AGENTS.md`'s row now also names plain rules the agent should just follow (no rationale attached), matching the "Working conventions" section added to this repo's own `AGENTS.md`.
- Repositioned Keep the Why as "a repo-native convention and agent skill," not just "an agent skill" — the previous framing throughout (README hero, `llms.txt`'s blockquote, README's "How it works", `docs/philosophy.md`'s closing summary, `docs/installation.md`'s opener, and the generated `context/README.md` template embedded in `setup.md`, `examples/first-time-setup.md`, and this repo's own `context/README.md`) defined it as the skill itself, undermining the point that the skill is one half of an open convention, not the whole thing. Standardized on "repo-native" over "repository-native" (the existing majority spelling) while at it.
- Sharpened the ADR FAQ entry (`docs/faq.md`): ADRs' real-world weakness was never the format, it's that writing one depends entirely on a human remembering to do it under exactly the deadline pressure that makes people skip it. Keep the Why's agent-authored capture removes that dependency — it's a byproduct of the conversation, not a separate disciplined act.
- Shortened README's "Composition with other skills" paragraph to a pointer at the FAQ entry, instead of restating the explanation inline.
- Trimmed `context/repo-conventions.md`: moved the OAuth-scope workaround procedure to `CONTRIBUTING.md` (kept only the "why" in `context/`), and removed the external-review entry entirely — on a second pass, even the CI-check part it was reduced to wasn't a real decision (no genuine alternative was ever in contention; automating a check right after a manual one just missed something isn't something a reader would ask "why" about). Already documented here and in `CONTRIBUTING.md`'s note on the checklist.

### Fixed

- `.claude-plugin/plugin.json`'s description was missing "or recovers" — retrospective recovery is one of the four modes, and both `SKILL.md` and the root `plugin.json` name it explicitly. Fixed to match.
- `docs/installation.md`'s opener never used the "repo-native convention and agent skill" formula established elsewhere in the positioning sweep. Fixed to state it explicitly, then note the page installs the agent-skill half specifically.
- Full project-wide consistency audit after the positioning sweep. Found and fixed two stragglers the sweep missed: `mkdocs.yml`'s `site_description` (feeds keepthewhy.com's meta description and social preview cards via `overrides/main.html`) still had the old "is a repo-native agent skill" wording; `CONTRIBUTING.md` still referred to a "prior-art comparison in the README" — stale since the README's "Related work" section deliberately dropped name-by-name comparisons. Everything else checked clean: version numbers (`SKILL.md`, `llms.txt`, both `plugin.json` files, `context-schema`) match at 0.6.0 everywhere; "Also listed on" tables are identical across `README.md`, `docs/installation.md`, and `llms.txt`, and all four tracked external submissions were re-verified live; `mkdocs build --strict`, Link Check, and Validate Skill all pass on `main`.
- `llms.txt` wrongly restricted **Source** to confirmed entries only, contradicting `SKILL.md` rule 2 — and a regression of the exact bug this project's own `CHANGELOG` already documents as fixed in `0.3.1`. Fixed to match rule 2's actual scope (useful at any Evidence level).
- Three separate `### Changed`/`### Added` headings had accumulated under `[Unreleased]`, added independently by separate PRs instead of reusing an existing heading for the same category. Consolidated to one heading per category, with entries ordered alphabetically by first word within a category — now a documented convention, see `CONTRIBUTING.md` checklist item 8.

## [0.6.0] - 2026-07-29

### Added

- New project setting `source-reference` (`always` / `never` / `filtered: <criteria>`, default `never`) governs whether the skill actively asks for a related issue, ticket, PR, or post-mortem when recording a `context/` entry — distinct from rule 2's existing (passive) Source field. `filtered` criteria are free text the project defines itself, not a fixed taxonomy. Asking is never the same as requiring one to exist — "no reference" is a complete answer, never invented to fill the field. Project-wide only for now, no personal override, same precedent as `capture-confirmation`. Documented in `SKILL.md`, `references/setup.md`, `README.md`, `llms.txt`, and `docs/faq.md`.
- `.claude-plugin/plugin.json` — the official Claude Code plugin manifest (distinct from the root `plugin.json`, which serves GitHub's Copilot CLI plugin marketplace format). No `skills` field needed: Claude Code auto-discovers the existing `skills/` directory by convention. Groundwork for listing on `obra/superpowers-marketplace`.
- New `SKILL.md` section "Composition with other skills": Keep the Why is a cross-cutting persistence skill, not a workflow orchestrator — when another skill already governs how work gets done, follow that workflow first and preserve only the rationale likely to matter afterward. Written generically, not tied to any one specific framework. Documented in `README.md`, `llms.txt`, and a new `docs/faq.md` entry ("Does this work alongside Superpowers or other methodology-style skills?").
- "Also listed on" table in `README.md` and `docs/installation.md`, plus an equivalent "Also Listed On" section in `llms.txt`, tracking marketplace listing status (skills.sh, SkillsLLM, ASM Registry, awesome-agent-skills, GitHub Copilot plugin marketplace) — only lists what's actually confirmed live or has an open, trackable submission, not aspirational entries. Entries sorted Live first (A–Z), then Pending (A–Z).
- Submitted a manifest to the [ASM Registry](https://github.com/luongnv89/asm-registry) ([PR #5](https://github.com/luongnv89/asm-registry/pull/5)), pinned to `v0.5.2`. Updating the pinned commit on future releases is now step 10 of the release checklist in `CONTRIBUTING.md`.
- Link to [obra/superpowers#2051](https://github.com/obra/superpowers/issues/2051) in `context/repo-conventions.md` — a compatibility gap found via live testing (Keep the Why didn't reliably self-trigger after a decision settled inside another skill's own workflow step) was reported upstream, framed as feedback on their own bootstrap's stated behavior, not a third-party integration request.

### Changed

- [SkillsLLM](https://skillsllm.com/skill/keep-the-why) listing status corrected from "Not eligible yet" to "Live" in the "Also listed on" tables — the prior "requires 100+ GitHub stars" note was wrong; SkillsLLM listed the skill unprompted at 11 stars, verified with a clean security scan.

### Fixed

- "Composition with other skills" was missing an explicit re-check instruction: checking whether Keep the Why applies isn't a one-time, start-of-turn decision — re-check at the natural end of another skill's workflow step (a design settled, a root cause confirmed, an alternative rejected), not just once before that step ran. Retested with the fix in place — it still didn't self-trigger (the added text lives in the skill body, which only loads once already triggered; the trigger check itself runs against `description`, untouched by this fix). Added an honest caveat instead of a stronger claim: whether the re-check happens on its own isn't guaranteed, and asking directly is a reasonable fallback. New eval case added.
- `docs/faq.md`'s "How is this different from git-why, AgDR, or similar projects?" entry named specific competing tools and pointed at a README section ("Not a green field") that no longer exists under that name — missed when README/`llms.txt` dropped name-by-name comparisons earlier. Reworded to match, and the dead section reference fixed to "Related work". Also brought the "distinguishing combination" wording in README, `llms.txt`, and the FAQ back in sync with the four modes `SKILL.md` actually describes (was missing "maintenance", and used the stale "code-guided interviews" name instead of "knowledge-transfer interviews").

## [0.5.2] - 2026-07-28

### Added

- `SKILL.md` frontmatter's `metadata` block now includes `author: "Oliver Zehentleitner"` — the Agent Skills spec's `metadata` field is an arbitrary key-value map (its own spec example shows `author` as a custom key), not a dedicated top-level field.
- `plugin.json` at the repo root, declaring `skills/` as this repo's skill directory — groundwork for registering this repo as an external plugin in GitHub's Copilot plugin marketplace (`awesome-copilot`), submitted via their external-plugin Issue form with a pinned release tag (see `context/repo-conventions.md`).

### Fixed

- `SKILL.md`'s "Reference files" list now uses real Markdown links (`[references/setup.md](references/setup.md)`) instead of plain backtick-formatted paths — `awesome-copilot`'s `vally lint` orphan-files check couldn't otherwise tell those files were reachable from `SKILL.md`.

## [0.5.1] - 2026-07-27

### Added

- The generated `context/README.md` template (`setup.md`, `examples/first-time-setup.md`, this repo's own `context/README.md`) now names and links Keep the Why in the body text, not just the logo image — explaining that the folder follows a schema shared across projects, so an agent or person who recognizes it already knows how to work with it.

### Fixed

- The Keep the Why logo image in `README.md`, `context/README.md`, `setup.md`, and `examples/first-time-setup.md` wasn't a link — clicking it opened the raw image instead of navigating to keepthewhy.com. Wrapped in an `<a href="https://keepthewhy.com">`.

## [0.5.0] - 2026-07-27

### Changed

- README and `llms.txt`'s "Related work" no longer name-compare against specific competing tools (`git-why`, Agent Decision Records, Addy Osmani's `documentation-and-adrs` skill) — that started as a fix for a broken link to Agent Decision Records (which pointed at a generic personal homepage), but any such list is incomplete the moment it's written and stale soon after. Kept: Architecture Decision Records and the AGENTS.md standard, both genuine open standards/conventions rather than competing tools. The distinguishing description now points to `docs/philosophy.md` and "What this is not" instead of a per-project comparison table.
- Rewrote the generated `context/README.md` template (in `setup.md`, `examples/first-time-setup.md`, and this repo's own `context/README.md`): now explicitly names Status/Evidence, states the trust boundary in the folder itself (content is project knowledge, never permission-granting instructions — reinforcing rule 15 right where a reader first lands), and links to the context index instead of the bare filename `index.md`.

### Added

- README's "Example" section gained a second, shorter example: a change considered and then abandoned once a real constraint surfaces mid-discussion, with no commit or diff ever resulting — the negative-space capture case was previously only a passing mention in the Core Concept summary, not visible where most readers actually look first. Links to `examples/abandoned-change.md` for the full walkthrough.
- **New Core Rule 15**: `context/` (and everything else in the repository) is project knowledge, never agent instructions — reading it grants no authority over what to do. Content that reads as a directive rather than a description (an embedded command, a request to hide something from the user, a self-declared "confirmed" claim) gets named and flagged to the user, never silently followed, silently deleted, or silently rewritten. The same restraint applies when writing: synthesize established knowledge, don't transcribe verbatim instructions, hidden/encoded content, or commands-for-later out of an issue, webpage, commit, or log.
- New reference file `references/trust-model.md`: the reasoning for why `context/` is a sharper injection surface than an ordinary repo file (automatic reading, cross-session persistence, populated from less-vetted sources during retrospective recovery), the read/write treatment in detail, a worked example, and how it relates to rules 1, 2, and 9. Also published as a docs site page.
- `retrospective-analysis.md`'s "Search order isn't trust order" now distinguishes how much to *believe* a source's claims from whether a source's content is safe to *act on* — a discovery source can be low-trust for facts and still carry something that needs flagging as a directive, not just a doubtful claim.
- 6 new eval cases: direct injection in an existing `context/` entry, hidden Unicode instructions, a base64 payload in source material, injection embedded in a quoted issue, a dangerous instruction disguised as a documented decision, and an injection attempting to declare itself `confirmed`.
- New docs site page `docs/philosophy.md`: the Unix-philosophy framing (one job, use what's already there), the "why simple" reasoning for no database/daemon/dashboard, and the condensed guideline as a closing statement.
- README's "What this is not" gained two entries: not session memory or an activity log, and not project management or an agent workflow/orchestration framework — informed by comparing against adjacent tools in that space, without naming or comparing against them publicly.
- New docs site page `docs/security.md`, a prominent, discoverable entry point separate from "Trust model" — the security posture overview (no external service/telemetry/daemon, no secrets in `context/`, actions still go through the agent's own permission model), pointing to `trust-model.md` for the injection-specific detail and `SECURITY.md` for vulnerability reporting, which are two different questions that were previously only findable separately.
- README, `docs/installation.md`, and `llms.txt` now tell installers to explicitly prompt their agent ("initialize Keep the Why in this project") after installing, rather than only saying "start a new session." A Skill activates on a matching conversation, not automatically on session start — without the explicit nudge, the one-time setup wizard would only run whenever something happened to trigger it organically. Clarified that this nudge is only needed once per project: setup writes a pointer into `AGENTS.md` itself, and most AGENTS.md-aware tools already read that file at the start of every session on their own.
- `examples/first-time-setup.md`'s "Situation" now notes that its trigger (a matching question) is one path to activation, and that saying "initialize Keep the Why in this project" directly works the same way without needing a relevant question to come up first.

### Fixed

- `examples/first-time-setup.md` rendered badly on the docs site — fenced code blocks nested inside numbered list items collapsed into unhighlighted inline code, and the sequential wizard dialogue (consecutive `>` lines with no blank line between turns) collapsed into one run-on paragraph inside the blockquote. Neither broke `mkdocs build --strict`, since both are rendering-fidelity issues, not broken links. Added `pymdownx.superfences` to `mkdocs.yml` (plain `fenced_code` doesn't handle fences nested inside list items) and inserted blank `>` lines between each dialogue turn. Verified against the actual built HTML, not just a successful build.

## [0.4.2] - 2026-07-25

### Changed

- **`confirmation-flow`'s scope broadened**: it now governs how *both wizards' own questions* get presented, not just multiple pending `context/` entry confirmations. `sequential` (default, and the only behavior a developer with no stored preference yet gets) asks one question, waits for the answer, then asks the next. `batch` bundles them into one message, the way both wizards used to work unconditionally before this setting existed — now a legitimate choice once a developer's preference is actually known, not the default. Caught in practice: bundling every wizard question together contradicted a developer's own already-stated `confirmation-flow: sequential` preference.
- `examples/first-time-setup.md` rewritten to actually demonstrate sequential, turn-by-turn wizard presentation instead of the old bundled-question block.
- 2 new eval cases: a first-ever activation defaults to sequential wizard presentation; a developer with an established `confirmation-flow: batch` preference gets bundled questions even in a brand-new project, since the preference travels with the developer, not the project.

### Fixed

- This repo's own `AGENTS.md` never pointed to `AGENTS.local.md`, unlike the skill's own `repository-structure.md` example — caught by actually running the personal-preferences wizard against this working copy instead of just inspecting the files.
- `mkdocs.yml`'s `site_description` still had the pre-rework hero text from before README/llms.txt's hook sentence was reworked in `0.4.0`'s cycle — fed the docs site's SEO/social-preview meta description with stale copy.
- Release checklist gained a step for `examples/first-time-setup.md`'s illustrative `context-schema` value, which otherwise goes stale on every release that doesn't touch the `context/` format — same situation this repo's own `AGENTS.md` would be in without the existing `context-schema` catch-up step.

## [0.4.1] - 2026-07-24

### Fixed

- `examples/first-time-setup.md` predated `capture-confirmation`/`confirmation-flow` entirely — found while reviewing the freshly reinstalled 0.4.0 skill end to end. Wizard questions, both config block snippets, and the second-developer section now reflect the current fields; also added the previously-missing `context-schema` line to the project config block example.

## [0.4.0] - 2026-07-24

### Added

- **`capture-confirmation`** (project-wide, `AGENTS.md`): `automatic`, `confirm-always`, or `confirm-when-unsure` (default) — how much permission is needed before writing to `context/`, independent of whether an entry is warranted at all. `confirm-when-unsure` is exactly today's existing behavior, now named and configurable.
- **`confirmation-flow`** (personal, `AGENTS.local.md`): `sequential` or `batch` — how multiple pending confirmations get presented when more than one accumulates at once (typical in retrospective recovery or after an interview).
- New Core Rule 11 covering both settings: session instructions override stored preferences, which override the project setting, which override the documented default; a direct instruction to capture something specific counts as confirmation for that one change; and confirmation never overrides Evidence quality, the proportionality gate, a substantive clarifying question, or the existing requirement to never commit/publish without being asked.
- Applies across all four modes, not just continuous capture — including a specific safeguard for maintenance: `automatic` never permits silently deleting, reinterpreting, or replacing already-confirmed historical information with weaker evidence.
- Project init wizard and personal preferences wizard both updated with a question for the new settings.
- New **Core Rule 14**: clarify ambiguity instead of guessing, applied generally — not just to entry content. A stored setting that's genuinely missing may fall back to a documented default (e.g. `capture-confirmation` absent → `confirm-when-unsure`, since that's already the project's real behavior). A setting that's *present but invalid*, recorded with *conflicting duplicate values*, or a *session instruction that doesn't clearly resolve* to one option is never treated the same as missing — name the valid options and ask, don't silently coerce, normalize, or pick one.
- 21 new eval cases covering the confirmation model: cross-axis interactions, the permission-vs-clarifying-question distinction, and the missing-vs-invalid-vs-contradictory distinction (invalid values, duplicate conflicting values, ambiguous session instructions, and a likely typo that still needs confirmation before being treated as corrected).
- `.github/workflows/validate-skill.yml`: validates `SKILL.md` against the Agent Skills spec (`skills-ref validate`) and that `evals.json` is well-formed JSON, on every push to `main` and every PR.

### Fixed

- `release.yml`'s `checkout` didn't pin to the `workflow_dispatch` tag input, so a manual dispatch could package whatever commit the workflow happened to run from instead of the requested tag. Now pins `ref:` explicitly, and "Move latest tag" moves it to that same tag rather than an implicit `HEAD`.
- `context-schema`'s definition in `setup.md` read like an independent format-version number, which is how an external review initially (mis)understood it. Reworded: it's the latest skill version this project's `context/` has been checked and migrated against, not a second versioning axis.
- `confirmation-flow` missing from a personal config was documented as a silent backfill to `sequential`, same treatment as `capture-confirmation`'s missing-field case. Caught by review: there's no prior behavior for `confirmation-flow` to preserve, since the axis didn't exist before — it needed to ask once, not default silently. Fixed, and Core Rule 14 now makes the missing-vs-invalid distinction explicit project-wide.
- Reference docs described `confirmation-flow: batch` and `capture-confirmation: confirm-always` as the "natural fit" for retrospective recovery and interviews respectively. Neutralized — a deliberately chosen personal preference gets respected regardless of which mode it's used in, not nudged toward whichever option sounds more fitting.
- The `AGENTS.md` example in `repository-structure.md` omitted `context-schema` and `capture-confirmation`, both of which a real project's config block always has — an example without them was misleading, not just terse. Now shown at realistic current values.
- `setup.md`'s "personal block present → use it, no re-asking" read as a blanket statement, in tension with the missing-field and invalid-value handling documented right below it. Precised: applies to settings that are present and valid, not the whole block regardless of contents.
- This repo's own `AGENTS.md` and `context/repo-conventions.md` were missing `capture-confirmation`/`confirmation-flow` — dogfooded.

## [0.3.1] - 2026-07-23

### Fixed

- `version` and `repository` moved from top-level frontmatter fields into `metadata:` (`metadata.version`, `metadata.repository`) in `SKILL.md` — the Agent Skills spec documents `metadata` as the place for custom properties; top-level custom fields aren't part of the spec.
- The consistency check couldn't actually find triggered `Revisit when` conditions — it was scoped to `context/index.md`, which by design only holds one-line summaries, not the conditions themselves. Rescoped to grep recursively under the project config's `context:` location for `**Revisit when:**` lines and only open files that match, instead of a hardcoded `context/*.md`.
- A project whose `context-schema` is *ahead* of the installed skill's version was treated the same as "up to date." Now surfaced explicitly (older skill on a newer project) with a recommendation to update, instead of silently proceeding as if there were nothing to check.
- `repository-structure.md` said "Evidence and Revisit when are not mandatory fields" — contradicted Core rule 2 (Evidence is mandatory for every entry) and the file's own earlier statement. Should have said Verification, not Evidence; fixed, and Core rule 7 now states explicitly that a triggered Revisit when sets Status to needs-review without resetting Evidence.
- **Source** was described as tied to confirmed claims only (Core rule 2), but the legacy-project example used it with `Evidence: inferred`. Source is now documented as useful at any Evidence level; Verification remains the field for checking a claim against other evidence.
- The project init wizard's normative steps had the entry-point config block written before the setup questions were asked — reversed from the worked example, which asks first. Reordered to match.
- Update-check version comparison now explicitly calls for stripping a leading `v` and comparing semantically (`0.9.0` < `0.10.0`), not as strings.
- `on-failure: retry-quietly` is cleared after a successful update check instead of persisting indefinitely, so a later unrelated failure asks again rather than staying silently suppressed.
- This repo's own `context-schema` was left at `0.3.0` even though nothing in `migrations.md` applied to the gap from `0.3.0` — the release checklist only mentioned advancing `context-schema` when a migration was needed, not also when nothing was. Fixed the checklist wording and caught this repo's own `context-schema` up to `0.3.1` (see `context/repo-conventions.md`).
- `docs/installation.md` referenced the pre-restructuring top-level `version:` frontmatter field instead of `metadata.version`.
- Dogfooding fixes in this repo's own `context/`: `repo-conventions.md` had a Status value outside the defined enum, and referenced the pre-rename "Autostart preference" instead of `capture-mode`; `context/index.md` undersold `repo-conventions.md` as "operational notes" when it documents process and tooling decisions.

### Added

- `docs/installation.md` and `llms.txt` now state explicitly that updating the skill itself (new `metadata.version`, frontmatter shape changes) is independent of `context-schema`/migrations — a release only asks something of a project when the `context/` entry format actually changes.
- New eval cases: `context-schema` ahead of the installed skill, semver-aware update-check comparison, and the consistency check respecting a non-default configured `context:` path.

## [0.3.0] - 2026-07-23

### Added

- `context/` entries now track **Status** (active, superseded, open, needs-review) separately from **Evidence** (confirmed, inferred, unknown) — previously "superseded" was mixed into the evidence classification as if it were a fourth confidence level, when it's really a different question (is this still current, vs. how well is it backed).
- Optional **Source** and **Verification** fields for confirmed entries whose claim is worth tracing or could be checked against other evidence. A `contradicted` verification must explain what contradicts it, not just carry the label.
- `context-schema` field in the project config block, tracking which version's `context/` entry format is in use — separate from the installed skill version, since not every release changes the format.
- `references/migrations.md`: what changed and how to update existing `context/` entries, checked automatically when `context-schema` falls behind the installed version.
- A developer can personally decline being asked about one specific `context-schema` migration (`migration-prompt: <version> declined` in `AGENTS.local.md`) without affecting the project or any other developer.
- Continuous capture now includes the abandoned change as its own signal: starting to modify or remove something, then stopping after discovering why it shouldn't be touched — reasoning that would otherwise leave no trace, since nothing gets committed.
- This `CHANGELOG.md` — the README already promised one in its "Where this fits" table; it just didn't exist.
- `CONTRIBUTING.md` gained a pre-PR checklist (which files to check for staleness on a change) and a release checklist.

### Changed

- The proportionality gate (rule 12) sharpened with a concrete example pair ("prevents a breaking API change" earns an entry, "formats the code more nicely" doesn't) and now explicitly allows a quick yes/no question when it's genuinely unclear whether something is worth documenting — asking isn't a violation of staying low-effort.
- README and `llms.txt` now state directly that a `context/` update ships in the same commit or PR as the code it explains — reviewed and versioned the same way, no separate system to trust or keep in sync.

## [0.2.0] - 2026-07-21

### Added

- First-activation setup: a project init wizard (why-knowledge folder, starting mode, README badge) and a separate personal preferences wizard (capture mode, update-check and consistency-check intervals) — see `docs/setup.md`.
- Per-session timer checks: opportunistic update-check (compares the installed version against the latest GitHub release) and consistency-check (flags `context/` entries whose "Revisit when" condition has actually triggered).
- `version` and `repository` fields in `SKILL.md`'s frontmatter, so the skill can identify itself and check for updates.
- A `context/README.md` created automatically during setup, so the folder explains itself to anyone (or any tool) landing there cold — GitHub renders it automatically when browsing the folder.
- A Keep the Why badge (`docs/badge.md`, `assets/badge.svg`) projects can add to their own README.
- `robots.txt` and an automatic `sitemap.xml` for the docs site.
- A floating `latest` git tag, moved automatically on every release, so install instructions never need a version bump.
- Pinned installs (`gh skill install ... @latest`, `npx skills add .../tree/latest/...`, `git clone --branch latest`) as the default recommendation instead of tracking `main`.
- A `GH Release` GitHub Actions workflow: tag a release, get a GitHub Release with generated notes, a packaged `keep-the-why-skill.zip`, and the `latest` tag moved.
- A Link Check GitHub Actions workflow (catches dead links across the whole repo).

### Changed

- The README's hero section now states the payoff directly (portability between developers, better agent answers, less "ask Bob") instead of only describing the capture mechanism.
- `capture-mode: proactive | explicit-only` replaces what was briefly called `autostart` — a Skill has no session-level autostart hook to promise, so the field now describes what's actually configurable.
- `AGENTS.local.md`'s creation now checks (and if needed, adds to) `.gitignore` first, instead of only stating "not committed" in prose.
- Update-check failures are reported once and the answer remembered, instead of either failing silently forever or re-asking every session.

### Fixed

- A citation to a 2026 position paper on decision-rationale decay overstated its scope (misattributed to "AI-generated" decisions; the paper studied traditional ADRs) — corrected to match what the paper actually found.
- A placeholder token (`<name>`) in an example was silently stripped by HTML rendering on the live docs site — replaced with a concrete example name.
- The README's license badge pointed at a page that never existed — now links directly to `LICENSE`.
- Docs referenced the now-deprecated `npm/npx` package for installing `npx` — now points at the Node.js download page (`npx` ships bundled since npm 5.2+/Node 8.2+).

## [0.1.0] - 2026-07-10

Initial release.

### Added

- The Keep the Why agent skill: `SKILL.md`, `references/` (methodology, repository structure, continuous capture, retrospective analysis, interview playbook), `examples/`, and `evals/evals.json`.
- Four modes: continuous capture, retrospective recovery, knowledge-transfer interview (targeted questions and free narration), and maintenance.
- `llms.txt` for AI agents/assistants looking up the project.
- The docs site at [keepthewhy.com](https://keepthewhy.com), built with mkdocs-material.
- Logo, wordmark, and favicon.
- `context/repo-conventions.md`, dogfooding the skill on its own repository from day one.

[Unreleased]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v0.1.0
