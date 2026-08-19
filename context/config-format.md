# Skill configuration format

## Setup/init state is tracked opportunistically, not via a real background schedule

**Type:** decision
**Status:** active
**Evidence:** confirmed

The skill's periodic checks (update availability, `context/` staleness) run as an "elapsed time since last check" comparison evaluated whenever the skill is already active in a session — not a true OS-level scheduled job (`cron`, Task Scheduler) that wakes something up on its own.

**Reason:** a Skill has no background execution — it only runs inside an active agent session. A real OS cron entry would need to shell out to a specific agent's non-interactive invocation (e.g. `claude -p "..."`), which only works for agents that expose one and ties the mechanism to a single vendor, contradicting the project's cross-agent goal. Comparing elapsed time on every session start works identically regardless of which agent is running the skill.

**Rejected alternative:** a real OS-level scheduled job that invokes an agent CLI directly. Rejected for the cross-agent portability reason above, not for being harder to build — it's better *if* you only ever use one specific agent, but that's not a constraint this project wants to impose.

## Config state lives in delimited blocks inside existing entry-point files, not a separate file

**Type:** decision
**Status:** active
**Evidence:** confirmed

Setup state is written into `<!-- keep-the-why:config -->` / `<!-- keep-the-why:local -->` blocks inside files the project already has a reason to read (`AGENTS.md` and `AGENTS.local.md`), not a dedicated state file.

**Reason:** keeps the state next to files every agent working in the repo is already expected to read, instead of adding a new file nobody has a reason to look at otherwise. The HTML-comment delimiters keep it easy to locate and parse without needing to interpret the rest of the file, and keep it visually out of the way of the human-readable pointer content those files are otherwise supposed to stay limited to.

**Rejected alternative:** a separate state file (e.g. `.keep-the-why.json`). Rejected because it adds a file whose only reader is this skill, splits state away from the files that already serve as the project's agent entry points, and a dedicated dotfile invites exactly the kind of "second undocumented system" the config-block approach was chosen to avoid.

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
