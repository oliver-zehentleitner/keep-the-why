# Entry and layout format

## `context/` stays flat — no subdirectories, even for large projects

**Type:** decision
**Status:** active
**Evidence:** confirmed

`context/` is a flat directory of topic files. There is no hierarchical subdirectory structure grouping topics by domain or subsystem, regardless of project size. Where topic files alone stop scaling, the prescribed move is namespacing filenames instead of nesting (`context/auth/tokens.md`) — as a prefix (`auth-tokens.md`) or a suffix (`tokens-auth.md`), whichever groups and sorts more usefully for that project; not restricted to one form.

**Reason:** prompted by comparing this project against Google's Open Knowledge Format (OKF v0.2), which formalizes Andrej Karpathy's "LLM Wiki" gist pattern into hierarchical directories of markdown-plus-YAML-frontmatter concept files, grouped by domain, each level optionally carrying its own `index.md`. Oliver's call after reviewing it: Keep the Why doesn't model a general-purpose, multi-domain knowledge catalog the way OKF does (arbitrary datasets, APIs, playbooks spanning an org) — a single repo's rationale doesn't have the kind of independent domains directories are meant to separate, and `context/index.md` already gives direct, flat navigation cheaply. Adding directory depth would be complexity without a problem it actually solves for this project's shape. It would also import a problem this project doesn't have: OKF's own spec recommends bundle-root-relative links specifically because its hierarchical layout lets a referring file's directory depth change, breaking plain relative links — a flat `context/` can't have that problem in the first place, so the fix isn't worth adopting either.

**Rejected alternative:** hierarchical subdirectories per subsystem/domain, each with its own `index.md`, matching OKF's structure. Rejected for the reasons above. If a project later hits real growth pain that filename namespacing can't absorb, that's the trigger to revisit this — not a preemptive adoption now.

**Revisit when:** a project's `context/` grows large enough that filename namespacing genuinely stops being enough to keep it navigable.

## Entries get an optional `Type` field (`decision` | `workaround` | `incident` | `constraint`)

**Type:** decision
**Status:** active
**Evidence:** confirmed

Every `context/` entry can carry a `**Type:**` header field, placed before `**Status:**`, with one of four values: `decision`, `workaround`, `incident`, `constraint`. It categorizes what kind of thing an entry is, independent of Status and Evidence.

**Reason:** raised while comparing this project against OKF (see the flat-layout entry above) — OKF requires every concept file to declare a `type`, used for filtering/routing. The underlying idea is genuinely useful even though OKF's specific mechanism (mandatory per-file, open vocabulary) doesn't fit Keep the Why's topic-file model, where one file holds several entries. Adapted as an entry-level, not file-level, field with a small fixed vocabulary instead of OKF's open one, so it stays reliably filterable: a tool or agent can select "every incident" or "every workaround" across `context/` without loading full topic files to find out, which matters for token cost as `context/` grows. Vocabulary deliberately kept to four values, matching the four things `SKILL.md`'s own "When to use this skill" section already names as capture-worthy (a decision, a workaround, an incident, a constraint) — no separate "rejected alternative" value, since a rejected alternative is structurally part of a decision entry (rule 6's fork), not a distinct entry type on its own.

Filled in on new entries when a value clearly fits; not a blocking requirement — Oliver's explicit steer was to fill in what's reasonably clear without turning it into bureaucracy, so an entry that doesn't cleanly fit one value just skips the field, same tier as Source/Verification/Revisit when rather than Status/Evidence. Existing entries pick up a Type the next time they're touched anyway, not through a dedicated backfill pass (see "Retrofitting an existing project" in `references/repository-structure.md`).

**Rejected alternative:** a mandatory per-file YAML frontmatter `type` field, OKF's own mechanism. Rejected because it assumes one file per concept — this project already rejected that shape for entries generally (see "Why topic files, not a shadow tree or one-file-per-decision" in `references/methodology.md`, and the source-reference rejected-alternative in `context/config-format.md` rejecting a "rigid per-entry YAML/frontmatter schema" for the same reason) — a mandatory structured field per file would need its own `context-schema` migration and push toward exactly the rigid, ADR-style model this project deliberately differentiates itself from.

**Rejected alternative (open vocabulary):** letting projects define their own Type values freely, as OKF does ("types are not centrally registered"). Rejected for this project specifically — an open vocabulary is more expressive but less reliably filterable, and the whole point of adding Type here is cheap, predictable filtering.

**Consequence:** this is a `context-schema`-relevant change (see `references/migrations.md`, "0.7.0 — Type field added"). Released in 0.7.0: `context-schema` advanced to 0.7.0 alongside `metadata.version`, per `CONTRIBUTING.md`'s release checklist ("never trail the version just released, even when nothing migrated"). This repo's own pre-existing `context/` entries were backfilled with Type in the same release, on Oliver's explicit call — a deliberate departure from the "migrate when next touched, not a dedicated pass" default this same entry recommends for other projects retrofitting this onto their own existing entries.

## `undefined` Type value flags entries where none of the four fit

**Type:** decision
**Status:** active
**Evidence:** confirmed

An entry that actively considers Type but finds that none of `decision`, `workaround`, `incident`, `constraint` cleanly fits records `**Type:** undefined — <short reason>` instead of leaving the field blank. The trailing reason is required, not decorative — it says why none of the four fit, not just that none did.

**Reason:** raised by Oliver — an entry where Type was genuinely evaluated and rejected needs to be distinguishable from one where Type was simply never considered; otherwise both collapse into the same blank field, and there's no way to `grep` for "cases the current vocabulary doesn't cover." `undefined` turns that gap into an explicit, filterable marker; the attached reason is what turns an accumulation of `undefined` entries into material for deciding whether the fixed vocabulary needs a fifth real value. This keeps Type a closed vocabulary in the sense the rejected-alternative reasoning above cared about — `undefined` is one more fixed member of the set, not an escape hatch into free text.

**Rejected alternative:** leaving Type blank when nothing fits, as originally documented. Rejected because it's indistinguishable from "not yet reviewed" — blank entries can't be `grep`ed apart from each other, so there was no way to find and evaluate the misfit cases at all.

**Rejected alternative (bare `other`):** an `other` value with no attached reason. Rejected — without the explanation, `other` degrades into the same kind of dumping-ground value the closed-vocabulary decision above was meant to avoid, and gives no material to act on later.

**Consequence:** this is a `context-schema`-relevant change, same tier as the original Type field. Migration guidance in `references/migrations.md`.

## `Type` accepts more than one value via repeated header lines

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer

An entry that genuinely documents more than one kind of thing gets one `**Type:**` line per applicable value, listed in the order the facts appear in the entry's own text.

> Superseded 2026-08: the "pick whichever a future search is more likely to be about" guidance in the "Entries get an optional `Type` field" entry above no longer applies — see this entry instead. That entry's core decision (Type exists, entry-level, four fixed values) still stands; only the single-value-per-entry constraint is superseded.

**Reason:** raised while auditing how Type held up against existing, larger `context/` collections in practice — several entries genuinely bundle more than one kind of fact under a single Status/Evidence header (e.g. one cleanup-round entry documenting an environment workaround, an unrelated bug fix, and a distribution-channel decision together), and forcing a single Type onto them either loses information or pushes toward over-splitting small, related facts into separate entries purely to keep Type single-valued — working against rule 13's proportionality gate. Repeating `**Type:**` keeps every field single-valued-per-line, consistent with how every other header field already works, so a plain `grep '^\*\*Type:\*\* incident'` still matches exactly, with no comma/whitespace handling needed.

**Rejected alternative:** a comma-separated single line (`**Type:** workaround, incident`). Rejected because it breaks the one-value-per-line convention every other field already uses, and complicates exact-match `grep` (ordering and spacing would vary between entries) for no real benefit over just repeating the line.

**Rejected alternative (keep "pick one"):** leaving the original straddle guidance in place, always resolving to a single value. Rejected — the field's purpose is accurate search and classification; picking one when more than one genuinely applies makes the tag less accurate for no benefit, and "keep the field sparse" isn't a real constraint here — there's no cost to an extra `Type:` line beyond being honest about what an entry documents.

**Consequence:** this is a `context-schema`-relevant change, same tier as the original Type field. Not a backfill pass — existing single-Type entries stay valid as-is; an entry only grows a second `**Type:**` line if it's touched again and genuinely warrants one. Migration guidance in `references/migrations.md`.

## `context/index.md` entries are sorted alphabetically by filename

**Type:** decision
**Status:** active
**Evidence:** confirmed

New entries in `context/index.md` are inserted in alphabetical order by filename, not appended at the end of the list.

**Reason:** raised in [#194](https://github.com/oliver-zehentleitner/keep-the-why/issues/194) — in a repo with several PRs open at once, always appending new entries at the end means any two PRs adding unrelated topic files insert at the same line and collide on merge, even though nothing about their content actually conflicts. Sorting alphabetically spreads insertions across different lines instead, so two such PRs only collide when they happen to add topics with adjacent filenames. Cheapest available fix — no tooling, no `context-schema` change, just a placement convention.

**Rejected alternative:** appending at the end (the prior, undocumented default). Rejected because it guarantees a collision on the same line for any two concurrent PRs adding new topic files, regardless of what those topics are.

**Rejected alternative (generated index):** regenerate `index.md` from a per-file description stored in each topic file, lockfile-style, so conflicts resolve by rerunning a script instead of manual reconciliation. Not rejected outright, just deferred — proposed in #194 as a follow-up if the alphabetical-sort convention alone doesn't bring the collision rate down enough in practice.

**Consequence:** this repo's own `context/index.md` was re-sorted to match in the same change, and the `context/index.md` example in `references/repository-structure.md` updated accordingly. Not a `context-schema` change — it's a placement convention for the index file, not a change to entry or index format itself.
