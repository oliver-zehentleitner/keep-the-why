# Skill configuration format

## Setup/init state is tracked opportunistically, not via a real background schedule

**Type:** decision
**Status:** active
**Evidence:** confirmed

The skill's periodic checks (update availability, `context/` staleness) run as an "elapsed time since last check" comparison evaluated whenever the skill is already active in a session — not a true OS-level scheduled job (`cron`, Task Scheduler) that wakes something up on its own.

**Reason:** a Skill has no background execution — it only runs inside an active agent session. A real OS cron entry would need to shell out to a specific agent's non-interactive invocation (e.g. `claude -p "..."`), which only works for agents that expose one and ties the mechanism to a single vendor, contradicting the project's cross-agent goal. Comparing elapsed time on every session start works identically regardless of which agent is running the skill.

**Rejected alternative:** a real OS-level scheduled job that invokes an agent CLI directly. Rejected for the cross-agent portability reason above, not for being harder to build — it's better *if* you only ever use one specific agent, but that's not a constraint this project wants to impose.

## Config state lives in delimited blocks inside existing entry-point files, not a separate file

> Superseded 2026-08-31: the "not a separate file" conclusion no longer holds — see "Config moves to dedicated `.keep-the-why` files, not entry-point blocks" below. The delimited-block syntax itself (HTML comments, easy to locate and parse) wasn't the part that was wrong — it's exactly what the dedicated files below still use.

**Type:** decision
**Status:** superseded
**Evidence:** confirmed

Setup state is written into `<!-- keep-the-why:config -->` / `<!-- keep-the-why:local -->` blocks inside files the project already has a reason to read (`AGENTS.md` and `AGENTS.local.md`), not a dedicated state file.

**Reason:** keeps the state next to files every agent working in the repo is already expected to read, instead of adding a new file nobody has a reason to look at otherwise. The HTML-comment delimiters keep it easy to locate and parse without needing to interpret the rest of the file, and keep it visually out of the way of the human-readable pointer content those files are otherwise supposed to stay limited to.

**Rejected alternative:** a separate state file (e.g. `.keep-the-why.json`). Rejected because it adds a file whose only reader is this skill, splits state away from the files that already serve as the project's agent entry points, and a dedicated dotfile invites exactly the kind of "second undocumented system" the config-block approach was chosen to avoid.

## Config moves to dedicated `.keep-the-why` files, not entry-point blocks

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

Project config moves from a block embedded in `AGENTS.md` (or whatever entry-point file a project uses) into a dedicated `.keep-the-why` file at the project root. Personal config moves the same way, from `AGENTS.local.md` into `~/.keep-the-why/<id>.md`, outside the project entirely. See `references/setup.md` for the full format.

**Reason:** the premise behind the earlier decision above — "keeps state next to a file every agent already reads" — turned out not to hold uniformly across agents even before this change: Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so a project already needed a symlink or import to make the embedded block visible there at all. `AGENTS.md` was originally meant to double as a lightweight autostart signal for this skill; in practice it never reliably worked that way, for the same reason. Filed externally as issue #192: a personal-scope skill install fully shadows a project-scoped one of the same name in some tools, so a project's own vendored, pinned copy of this skill could never run for a developer who also had it installed personally — embedding state in a file whose own visibility already varied by agent made that worse, not better. This project is still v0.x and explicitly in an experimental, evaluate-and-improve phase; finding a structural weakness like this and correcting it is exactly what that phase is for, not something to work around indefinitely to avoid revisiting an earlier call.

**Rejected alternative:** keep the embedded-block scheme and only patch around its specific gaps (e.g. document the Claude Code symlink requirement more prominently). Rejected — the gaps trace back to the same root cause (state tied to whichever file a given agent happens to treat as its entry point), so patching each symptom individually would leave the next one undiscovered instead of removing the shared cause.

**Consequence:** existing projects need to migrate — see `references/migrations.md`, "Project/personal config moves into dedicated `.keep-the-why` files." `AGENTS.md` no longer gets a "this project uses Keep the Why" pointer written into it either, fresh or migrated — Oliver's call: that's the project's own editorial decision (a README section, the badge), not this skill's to add unasked; `.keep-the-why` instead carries its own short, human-readable header line so opening that specific file cold is self-explanatory. The one exception is a migrated project's leftover version-requirement note (see `migrations.md`) — kept specifically because setup detection is an LLM reading the whole file, not a literal marker match, so a plain-English note left where an older skill is already looking is something it can actually notice, unlike a change to logic it was never taught.

## Project identity is stored explicitly, not re-derived each session

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

`.keep-the-why` carries an `id` field, generated once at init (`<owner>---<repo>` from a git remote, or `<uuid>---<folder-name>` without one) and never recomputed. A developer's personal file is keyed by it: `~/.keep-the-why/<id>.md`.

**Reason:** two derive-it-fresh alternatives were considered and both had real bugs, not just theoretical ones. `git rev-parse --git-common-dir` looked appealing — it's the one `.git` directory every linked worktree of a clone shares, which would make personal state naturally worktree-transparent — but it prints a relative path from a repo's main checkout and an absolute one from a linked worktree, so used raw it would split a single clone into two different keys. Deriving from the `origin` remote URL each time avoids that specific bug, but breaks differently: it changes if a remote is renamed or the repo is moved to a different host or org, silently orphaning a developer's existing personal file with no migration path, since nothing recorded what the old key used to be. Storing the id once, as data, sidesteps both: it doesn't care what `git rev-parse` prints in a given context, and it doesn't change just because a remote URL does.

**Rejected alternative:** `git rev-parse --git-common-dir` as a live key. Rejected for the absolute/relative bug above.

**Rejected alternative:** the `origin` remote URL, re-read each session, as a live key. Rejected — breaks on rename/move/fork with no way to reconcile the old and new key, where a stored `id` just keeps working.

## `personal-defaults` and a machine-wide ask-vs-accept policy

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

A project can optionally offer a `personal-defaults` block in `.keep-the-why`, suggesting personal-workflow settings for a new developer instead of every one of them answering the personal wizard from scratch. Whether a developer gets asked before adopting a project's offered defaults, or has them applied automatically, is controlled by a separate, machine-wide `personal-defaults-policy` field in `~/.keep-the-why/config` — asked once, the first time the situation ever comes up, not per project.

**Reason:** a team that has already agreed on conventions (capture mode, confirmation flow, check intervals) shouldn't have every new member re-litigate the same four questions individually — but making that automatic outright would remove a developer's ability to notice and consciously accept (or override) what they're inheriting, and different developers plausibly want different amounts of friction here regardless of any one project's preference. Splitting it into an optional project-side suggestion plus a personal, machine-wide policy for how to handle any project's suggestion lets both preferences coexist without one silently overriding the other.

**Rejected alternative:** apply `personal-defaults` automatically whenever a project offers one, no policy needed. Rejected — removes a developer's ability to ever be asked, even one who'd prefer confirming every time regardless of project.

**Rejected alternative:** always ask, no auto-accept option, even for a developer who's confirmed the same kind of thing repeatedly and finds it pure friction. Rejected — the whole reason `personal-defaults` exists is to reduce onboarding friction; forcing a question every single time undercuts that for a developer who's already decided they trust project-suggested defaults.

## Pinned versions defer by reading the vendored copy directly, not via a second skill name

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

A project can pin `.keep-the-why` to an exact vendored copy (`pinned-version` + `pinned-path`). When a personally-installed skill's own version differs, it reads the vendored `SKILL.md` at that path directly and follows it instead of its own instructions for the rest of the session, rather than the vendored copy being installed under a separate, version-namespaced skill name (e.g. `keep-the-why-v0.9.0`) that gets invoked by name.

**Reason:** a version-namespaced separate name avoids a Skill-loading name collision cleanly, but means every vendored copy needs a unique name assigned at install time, and a workspace ends up with N differently-named copies of what's functionally the same skill instead of one. Reading the vendored file directly needs no new tooling and no change to how vendoring already works today — a project just checks in a release under its normal name, same as always.

**Rejected alternative:** vendor under a version-namespaced skill name and have the generically-installed skill invoke it by name via normal Skill loading. Rejected — more moving parts (naming convention, unique-name bookkeeping at install time) for the same outcome, and it changes what vendoring itself has to do, not just how a pin gets resolved.

**Consequence:** if `pinned-path` doesn't exist, this is a hard stop, not a silent fallback to the installed version — see "Pinned versions" in `references/setup.md`. Continuing quietly (even just refusing `context/` writes while everything else proceeds) would itself be a silent-drift failure: the developer wouldn't know the skill had backed off from what the project actually pinned.

## `context/` gets `AGENTS.md`/`CLAUDE.md` guard files against hand-written schema edits

**Type:** incident
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

Reported externally: a session with the project's Keep the Why setup already complete edited `context/` entries directly, schema-shaped, without invoking the skill at all. The fix — a small `context/AGENTS.md` ("invoke the skill before editing anything here, don't write to the schema by hand") plus a `context/CLAUDE.md` that's just a one-line `@AGENTS.md` import — is now part of what the project init wizard creates alongside `context/README.md`.

**Reason:** `context/README.md` is a plain file an agent might never open before editing an entry — nothing forces it into context. A nested `CLAUDE.md`, by contrast, is a harness-level guarantee in Claude Code: it loads automatically the first time any file in its directory is read, regardless of whether the agent thought to look for it. Codex doesn't have that specific mechanism (it only walks `AGENTS.md` from the repository root to the current working directory), which is why both files exist rather than one — `CLAUDE.md` as a one-line import keeps a single canonical wording instead of two copies drifting apart. Worth being honest about what this buys: guaranteed injection of the instruction at the right moment, not guaranteed compliance — a real technical block would need something heavier, like a `PreToolUse` hook, which this doesn't attempt.

**Rejected alternative:** rely on `context/README.md` alone, or add a pointer line to the top of `context/index.md`. Rejected — neither file is force-loaded by anything; both depend on the agent already deciding to open them, which is exactly the behavior that failed in the reported incident.

**Rejected alternative:** a `PreToolUse` hook technically blocking writes to `context/*.md` outside this skill's own flow. Not rejected outright, just not adopted here — heavier and more script-like than this project's guidance otherwise is, and the guard above already addresses the reported failure mode at much lower cost.

## Setup state splits across a project block and a personal block

**Type:** decision
**Status:** active
**Evidence:** confirmed

Where `context/` lives, whether the project has been initialized, and how much confirmation is needed before writing (`capture-confirmation`) are in the committed `AGENTS.md` config block. Capture-mode preference, `confirmation-flow` (how multiple pending confirmations get presented), and the update-check/consistency-check intervals and their last-run timestamps, are in the personal, uncommitted `AGENTS.local.md` block instead. A project can be `init: complete` while a specific developer still gets asked their own preferences, if they don't have an `AGENTS.local.md` yet.

**Reason:** the first version bundled everything into one committed block. Oliver pointed out that capture-mode and check-interval preferences are individual workflow choices, not project facts — one developer wanting weekly update checks and another wanting none are both fine, and forcing one answer onto everyone (or making it a merge-conflict-prone shared timestamp several sessions race to update) doesn't fit the existing `AGENTS.md`/`AGENTS.local.md` boundary this project already draws for exactly this kind of distinction.

**Rejected alternative:** one combined block covering both project and personal state, as originally shipped. Rejected once the personal/project distinction became clear — see above.

## Update-check failures get surfaced once, not swallowed indefinitely

**Type:** decision
**Status:** active
**Evidence:** confirmed

If the update check can't run (no web access this session), the first failure is reported and the user is asked whether to keep retrying each session or turn the check off. Subsequent identical failures don't re-ask.

**Reason:** the first version skipped silently on failure, on the reasoning that a check that can't run shouldn't nag about it. Oliver pointed out the actual risk: for a user whose agent never has web access, that check would be permanently and invisibly broken — silence reads as "nothing to report," not "this has never once worked." A single surfaced notice, with the option to just turn it off, avoids both the nagging and the false sense that the check is doing anything.

**Rejected alternative:** always skip silently on failure (the first version). Rejected because it can't be distinguished from "checked, nothing new" — the two states look identical to the user, and one of them is worth knowing about.

## `context-schema` always tracks the released version, even when nothing migrated

**Type:** incident
**Status:** active
**Evidence:** confirmed

Every release advances this repo's own `context-schema` (in this file's config block) to match the just-released `metadata.version`, even when that release introduced no `context/` entry format change — not just when `migrations.md` had something to apply.

**Reason:** during the 0.3.1 release, `context-schema` was left at `0.3.0` because nothing in `migrations.md` applied to the 0.3.0→0.3.1 gap — but "nothing to migrate" and "don't advance the number" are different things. Leaving it behind made a later external review flag it as if the skill's own schema-comparison logic were broken, when the actual bug was simpler: the release process itself skipped the catch-up step that `setup.md`'s existing behind-case logic already calls for.

**Rejected alternative:** a separate `metadata.context-schema` field in `SKILL.md`, decoupled from `metadata.version`, so schema and release versioning could drift independently. Rejected — the existing single-version-axis model (check for applicable migrations, advance the number whether or not anything applied) already does everything a second version field would, without a second number to keep in sync.

## `migrations.md` covers anything an existing project needs to know about or act on, not only `context/` entry-format changes

**Type:** decision
**Status:** active
**Evidence:** confirmed

`references/migrations.md` records what changed in each version that an existing project may need to know about or act on — structural/placement conventions (e.g. `context/index.md`'s sort order) and config defaults added to `AGENTS.md`/`AGENTS.local.md`, not only changes to the `context/` entry format itself. A purely informational entry (a field silently backfilled to a documented default) still gets recorded, just without the migrate-now/defer/decline prompt — that prompt is reserved for entries that actually require doing something.

**Reason:** raised by Oliver while reviewing the `context/index.md` alphabetical-sort convention (see "`context/index.md` entries are sorted alphabetically by filename" in `context/entry-format.md`) — that change isn't a `context/` entry-format change, so it was initially left out of `migrations.md` on the (unstated, never actually agreed) assumption that the file was format-only. Oliver's position: `migrations.md` exists to answer "what do I need to do after updating," full stop — narrowing it to format changes just meant some actionable changes had nowhere to be tracked. No hard technical reason favored the narrow reading either — `setup.md`'s existing consult mechanism already checks `migrations.md` for entries in the version range between a project's `context-schema` and the installed `metadata.version`, regardless of what kind of change each entry represents, so widening the file's scope needed no change to the trigger logic.

**Rejected alternative:** keep `migrations.md` scoped to `context/` entry-format changes only, as `setup.md:221` explicitly documented before this decision (`capture-confirmation`/`confirmation-flow`/`source-reference` backfills were called out as deliberately *not* going through `migrations.md`). Rejected — that carve-out was itself the misunderstanding being corrected here, not a separate design this decision needed to preserve.

**Consequence:** `setup.md:221`'s carve-out language rewritten to say these settings still get an informational `migrations.md` entry, just without a prompt. `setup.md`'s step 5 (context-schema behind case) and `SKILL.md`'s equivalent summary both reworded to stop implying only entry-format changes are checked. `references/migrations.md`'s own opening paragraph rewritten to state the broader scope directly. Three more spots asserted the old narrow scope and needed the same fix: `CONTRIBUTING.md`'s pre-PR checklist (step 3) and release checklist (step 5), `docs/installation.md`'s "Updating" section, and `llms.txt`'s setup/migrations paragraph — all three previously told a contributor or user that only `context/` entry-format changes ever require action, which would have kept recreating this exact gap for the next non-format convention change.

## `capture-confirmation` is project-wide only, for now — deliberately, to test first

**Type:** decision
**Status:** active
**Evidence:** confirmed

`capture-confirmation` (automatic / confirm-always / confirm-when-unsure — how much permission is needed before writing to `context/`) lives only in the project config block (`AGENTS.md`), with no personal override in this release, even though `capture-mode` and `confirmation-flow` are both personal.

**Reason:** Oliver's call: test the setting project-wide first and see how it behaves in practice before deciding whether individual developers should be able to override it. The resolution order (session instruction → personal setting → project setting → default) is deliberately structured so a personal override slots in later without restructuring anything — same pattern as `migration-prompt: <version> declined` — but adding it now, before there's any real usage to learn from, would be guessing at a need rather than confirming one.

**Rejected alternative:** ship a personal override immediately, symmetric with `capture-mode` and `confirmation-flow`. Rejected for now — not because it's wrong in principle, but because whether developers actually want to diverge from the project's confirmation bar is an open question this release is meant to help answer, not one to presume the answer to upfront.

## `source-reference` asks about ticket/issue links, doesn't require one to exist, and ships project-wide only

**Type:** decision
**Status:** active
**Evidence:** confirmed

New project setting `source-reference` (`always` / `never` / `filtered: <criteria>`, default `never`) governs whether the skill actively asks for a related issue, ticket, PR, or post-mortem when recording a `context/` entry — distinct from rule 2's existing Source field, which was already able to hold this but was never actively sought.

**Reason:** prompted by an external review of this project pointing out that a "why" is strongest when it's traceable to something concrete like a tracked incident or ticket. The underlying capability already existed (Source, rule 2) — what was missing was ever proactively asking for it. Making that its own setting, rather than folding it into `capture-confirmation`, keeps the two questions separate: whether writing needs permission (`capture-confirmation`) is orthogonal to whether the skill goes looking for a ticket reference (`source-reference`) — a project could want one without the other.

**Rejected alternative:** a rigid per-entry YAML/frontmatter schema with a mandatory ticket-ID field (the shape the original suggestion came in, closer to ADR/AgDR-style structured records). Rejected — this project already differentiates itself from one-file-per-decision, rigid-schema tools (see "No name-by-name comparison" in `context/positioning.md`); a mandatory structured field pushes toward exactly that model and would need its own `context-schema` migration. Recording Source in prose, same as today, keeps the format unchanged — only whether it gets actively asked for changes.

**Rejected alternative (the `filtered` mechanism specifically):** a fixed taxonomy of filter categories (by topic file, by Status, by severity) defined by the skill. Rejected in favor of free text the project defines itself — a fixed taxonomy would be guessing at categories before there's real usage to learn from, the same reasoning already applied to keeping `capture-confirmation` project-wide-only for now (see above).

**Consequence:** `always` (or a matching `filtered` criterion) means asking is mandatory, but a reference existing is not — "no, nothing tracks this" is a complete, valid answer. Inventing a plausible-sounding ticket reference to avoid an empty field would violate rule 1 exactly like inventing rationale would. No personal override in this release, same "test one setting before adding a second axis" precedent as `capture-confirmation`.
