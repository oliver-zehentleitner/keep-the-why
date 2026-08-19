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
