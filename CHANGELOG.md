# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/oliver-zehentleitner/keep-the-why/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v0.1.0
