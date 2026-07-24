# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v0.1.0
