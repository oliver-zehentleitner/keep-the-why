# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- The consistency check's `Revisit when` search was hardcoded to `context/*.md` — a leftover from the previous fix that didn't account for a project choosing a different why-knowledge location or splitting it into subsystem subdirectories. Now greps recursively under whatever the project config's `context:` value actually is.
- This repo's own `context-schema` was left at `0.3.0` after the `0.3.1` release, even though nothing in `migrations.md` applied to that gap — the release checklist only mentioned advancing `context-schema` when a migration was needed, not also when nothing was. Fixed the checklist wording and caught this repo's own `context-schema` up to `0.3.1` (see `context/repo-conventions.md`).
- `docs/installation.md` still referenced the pre-0.3.1 top-level `version:` frontmatter field instead of `metadata.version`.

### Added

- `docs/installation.md` and `llms.txt` now state explicitly that updating the skill itself (new `metadata.version`, frontmatter shape changes) is independent of `context-schema`/migrations — a release only asks something of a project when the `context/` entry format actually changes.
- New eval case covering the fixed consistency-check path bug: a project with `context:` pointing somewhere other than the default `context/`.

## [0.3.1] - 2026-07-23

### Fixed

- `version` and `repository` moved from top-level frontmatter fields into `metadata:` (`metadata.version`, `metadata.repository`) in `SKILL.md` — the Agent Skills spec documents `metadata` as the place for custom properties; top-level custom fields aren't part of the spec.
- The consistency check couldn't actually find triggered `Revisit when` conditions — it was scoped to `context/index.md`, which by design only holds one-line summaries, not the conditions themselves. Now greps `context/*.md` directly for `**Revisit when:**` lines and only opens files that match.
- A project whose `context-schema` is *ahead* of the installed skill's version was treated the same as "up to date." Now surfaced explicitly (older skill on a newer project) with a recommendation to update, instead of silently proceeding as if there were nothing to check.
- `repository-structure.md` said "Evidence and Revisit when are not mandatory fields" — contradicted Core rule 2 (Evidence is mandatory for every entry) and the file's own earlier statement. Should have said Verification, not Evidence; fixed, and Core rule 7 now states explicitly that a triggered Revisit when sets Status to needs-review without resetting Evidence.
- **Source** was described as tied to confirmed claims only (Core rule 2), but the legacy-project example used it with `Evidence: inferred`. Source is now documented as useful at any Evidence level; Verification remains the field for checking a claim against other evidence.
- The project init wizard's normative steps had the entry-point config block written before the setup questions were asked — reversed from the worked example, which asks first. Reordered to match.
- Update-check version comparison now explicitly calls for stripping a leading `v` and comparing semantically (`0.9.0` < `0.10.0`), not as strings.
- `on-failure: retry-quietly` is cleared after a successful update check instead of persisting indefinitely, so a later unrelated failure asks again rather than staying silently suppressed.
- Dogfooding fixes in this repo's own `context/`: `repo-conventions.md` had a Status value outside the defined enum, and referenced the pre-rename "Autostart preference" instead of `capture-mode`; `context/index.md` undersold `repo-conventions.md` as "operational notes" when it documents process and tooling decisions.

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

[Unreleased]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v0.1.0
