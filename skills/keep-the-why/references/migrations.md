# Migrations

What changed in each version that an existing project may need to know about or act on — not limited to changes to the `context/` entry *format*. Also covers structural/placement conventions (e.g. how `context/index.md` is ordered) and config defaults added to `AGENTS.md`/`AGENTS.local.md`. Not every release needs an entry here — only ones with something an existing project should check. See `setup.md` for how and when this file gets consulted; note that "consulted" doesn't always mean "asks the user to act" — a purely informational entry (e.g. a config field silently backfilled to a default) is recorded here for completeness but needs no prompt.

Entries below assume 0.2.0 as the starting point — nothing before it tracked a `context-schema` at all, and 0.2.0 itself introduced no `context/` entry format change.

## Unreleased — Project/personal config moves into dedicated `.keep-the-why` files

**What changed:** the project config block (`<!-- keep-the-why:config -->`) moves out of the entry-point file (`AGENTS.md`, or whatever a project already uses) into a dedicated `.keep-the-why` file at the project root. The personal config block (`<!-- keep-the-why:local -->`) moves out of `AGENTS.local.md` into a dedicated, non-project file at `~/.keep-the-why/<id>.md`, keyed by a new `id` field the project file now carries. See "Why dedicated files, not entry-point blocks" in `context/config-format.md` for the reasoning, and `references/setup.md` for the full format and detection logic. Three optional additions ship alongside the relocation, none of which existing projects are required to adopt: a `personal-defaults` block a project can offer new developers (plus a machine-wide `~/.keep-the-why/config` policy governing whether that's asked about or auto-applied), `pinned-version`/`pinned-path` fields for pinning to a vendored skill copy, and `context/AGENTS.md` + `context/CLAUDE.md` guard files. Not a `context/` entry-format change — existing entries are untouched — but it needs real action from an existing project, not a silent backfill.

**Migrating an existing project (do this now, not on next touch — the whole point only holds once it's actually done):**

1. Generate the project's `id` (see "Project config" in `setup.md`) and create `.keep-the-why`, carrying over every existing field from the old `AGENTS.md` block verbatim (`context`, `init`, `context-schema`, `capture-confirmation`, `source-reference`), plus the new `id` field.
2. Ask whether the project wants to add a `personal-defaults` block for future developers — same question the project init wizard now asks, framed the same way.
3. Remove the `<!-- keep-the-why:config -->` block from the entry-point file, along with any prose that specifically pointed at it or at `AGENTS.local.md` for this skill's own state. Replace with a short one-line mention that the project uses Keep the Why and that its state lives in `.keep-the-why` — for a human reading the file cold, not load-bearing for the skill itself. **Also add a line noting the project was migrated and that any Keep the Why skill installation reading this file needs to be at `metadata.version` 0.10.0 or later** — an older installed skill won't know to look for `.keep-the-why` at all and could otherwise mistake a fully-set-up project for an uninitialized one.
4. If `context/` doesn't already have `AGENTS.md` and `CLAUDE.md` guard files (see "Guarding `context/` itself" in `setup.md`), add them now, in the same pass.
5. Separately, per developer, the *next* time each one activates the skill in this checkout (this doesn't happen all at once for everyone the moment the project-level part above lands, and that's fine — it's driven by local file presence, not by anything shared or git-tracked): if this checkout still has a `<!-- keep-the-why:local -->` block in `AGENTS.local.md`, carry its values and `last:` timestamps over verbatim into `~/.keep-the-why/<id>.md`, then remove the block from `AGENTS.local.md` — a pure relocation of that developer's own already-stated preferences, no questions needed. A developer who never had a personal block before this migration isn't affected by this step at all; they go through ordinary first-activation handling (personal wizard, or the project's `personal-defaults` if it offers one) exactly as if the project had always used `.keep-the-why`.

**Known limitation:** an installed skill older than 0.10.0 has no way to know `.keep-the-why` exists — it looks for the config block in the entry-point file, doesn't find it (step 3 removed it), and could mistake an already-migrated project for one that was never set up. Not fixable retroactively (an old skill can't be taught a convention that didn't exist when it was released) — the one-line note step 3 adds exists specifically to make this visible to a human before it causes confusion, and updating the skill before opening an already-migrated project avoids it entirely.

**Example — before (`AGENTS.md`):**

```markdown
<!-- keep-the-why:config -->
- context: `context/`
- init: complete
- context-schema: 0.9.2
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

**Example — after (`.keep-the-why`, new file; `AGENTS.md` keeps only a pointer):**

```markdown
<!-- keep-the-why:config -->
- id: acme---widget-service
- context: `context/`
- init: complete
- context-schema: 0.10.0
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

```markdown
This project uses Keep the Why — see `.keep-the-why` and `context/index.md`.
Migrated from the AGENTS.md-embedded config on 2026-08-31 — requires
Keep the Why skill version 0.10.0 or later.
```

## Unreleased — `context/index.md` entries sorted alphabetically

**What changed:** new entries in `context/index.md` are inserted in alphabetical order by filename instead of appended at the end — see `context/entry-format.md` and [#194](https://github.com/oliver-zehentleitner/keep-the-why/issues/194). Not a `context/` entry-format change, but it does need action in an existing project: the merge-conflict reduction this convention exists for only works once the whole list is actually sorted.

**Migrating an existing project:**

1. Resort `context/index.md` fully, once, alphabetically by filename. Unlike a per-entry field backfill, this is mechanical (no per-entry judgment) and cheap even for a large index — do it now rather than waiting for entries to be touched individually.
2. Insert any new entries in sorted position from that point on.

**Example — before:**

```markdown
- [release-and-distribution.md](release-and-distribution.md) — ...
- [config-format.md](config-format.md) — ...
- [entry-format.md](entry-format.md) — ...
```

**Example — after:**

```markdown
- [config-format.md](config-format.md) — ...
- [entry-format.md](entry-format.md) — ...
- [release-and-distribution.md](release-and-distribution.md) — ...
```

## 0.9.0 — `Type` accepts multiple values

**What changed:** an entry that genuinely documents more than one kind of thing now gets one `**Type:**` line per applicable value, instead of being forced to pick a single one. Supersedes point 2 of the 0.7.0 migration below — that guidance said to pick whichever value a future search is more likely to be about when an entry straddles two; the current guidance is to add a line for each value that genuinely applies instead. `undefined` stays exclusive — it never combines with the other four, since it means none of them fit.

**Changed guidance (see `references/repository-structure.md` and `context/entry-format.md`):**

- **Type:** one line per value that genuinely applies (`decision` | `workaround` | `incident` | `constraint`) — most entries still get exactly one; `undefined — <reason>` stays a single, exclusive line used only when none of the four fit.

**Migrating an existing entry:**

1. Not a backfill pass. An entry that already picked one value under the old "pick whichever" guidance doesn't need a dedicated pass to recover the value it left out — same "next time touched" rule as the 0.7.0 and 0.8.0 migrations below.
2. When you do touch such an entry, add a second `**Type:**` line if a second value genuinely applies now — don't add one just because the field technically allows it if the original single value still covers the entry fully.
3. Project-wide, once: check `context/README.md`'s "Reading the entries" Type line — it already describes Type generically ("what kind of thing it is: decision, workaround, incident, or constraint") without claiming single-valued, so no wording change is required there. Nothing to do for this step.

**Example — before:**

```markdown
**Type:** workaround
**Status:** active
**Evidence:** confirmed
```

**Example — after (only once a second value genuinely applies):**

```markdown
**Type:** workaround
**Type:** incident
**Status:** active
**Evidence:** confirmed
```

## 0.8.0 — `undefined` Type value added

**What changed:** entries where none of the four Type values (`decision` | `workaround` | `incident` | `constraint`) cleanly fit now record `**Type:** undefined — <reason>` instead of leaving the field blank. Supersedes point 3 of the 0.7.0 migration below — that guidance said to leave Type out when nothing fits; the current guidance is to mark it `undefined` with a reason instead, so misfit cases stay filterable rather than indistinguishable from entries that never considered Type at all.

**New value (see `references/repository-structure.md`):**

- **Type:** `undefined` — used only after actively confirming none of the four values fit; always followed by `— <short reason>`.

**Migrating an existing entry:**

1. Not a backfill pass. Entries that currently skip Type because nothing fit don't need a dedicated pass — same "next time touched" rule as the 0.7.0 migration below.
2. When you do touch one and confirm none of the four values fit, add `**Type:** undefined — <short reason>` rather than leaving the field blank.
3. Project-wide, once: if `context/README.md`'s "Reading the entries" Type line doesn't mention `undefined`, update it to match `references/setup.md`'s current template.

**Example — before:**

```markdown
**Status:** active
**Evidence:** confirmed
```

**Example — after:**

```markdown
**Type:** undefined — documents a naming convention, not a decision/workaround/incident/constraint
**Status:** active
**Evidence:** confirmed
```

## 0.7.0 — Type field added

**What changed:** entries can now carry a **Type** header field (`decision` | `workaround` | `incident` | `constraint`), placed before **Status**. It categorizes what kind of thing an entry is, independent of Status/Evidence, so a tool or agent can filter — "every incident," "every workaround" — without loading full topic files to find out.

**New field (see `references/repository-structure.md`):**

- **Type:** decision | workaround | incident | constraint — optional, filled in when one value clearly fits.

**Migrating an existing entry:**

1. Not a backfill pass. Add **Type** to an entry the next time it's touched anyway, same as any other maintenance edit — matches "Retrofitting an existing project" in `repository-structure.md`.
2. If an entry genuinely straddles two values (a workaround adopted because of an incident), pick whichever a future search is more likely to be about. Don't split the entry or leave Type blank just because more than one value would fit.
3. If nothing fits cleanly, leave it out rather than forcing a wrong-feeling value — Type is there to help filtering, not to gate whether an entry counts. (Superseded by the `undefined` value above — for a project migrating straight to the current version, apply that guidance instead of this step.)
4. Project-wide, once: if `context/README.md`'s "Reading the entries" section doesn't mention Type at all, add it — same wording as `references/setup.md`'s current template.

**Example — before:**

```markdown
**Status:** active
**Evidence:** confirmed
```

**Example — after:**

```markdown
**Type:** workaround
**Status:** active
**Evidence:** confirmed
```

## 0.3.0 — Evidence split from Status

**What changed:** `context/` entries previously classified evidence as one of confirmed, inferred, unknown, *or* superseded — treating "superseded" as if it were a fourth evidence level. It isn't: whether a decision is still current (Status) and how well it's evidenced (Evidence) are independent questions. A superseded decision can have been thoroughly confirmed when it was still active. Also added: an optional Source/Verification pair for confirmed entries whose claim is worth tracing or could be checked against other evidence.

**New fields (see `SKILL.md` rules 2 and 7):**

- **Status:** active | superseded | open | needs-review
- **Evidence:** confirmed | inferred | unknown *(unchanged values, now its own field)*
- **Source** and **Verification** (corroborated | uncorroborated | contradicted) — optional, only add where there's a real answer, per the proportionality principle. A `contradicted` verification must explain what contradicts it.

**Migrating an existing entry:**

1. If it currently has a single `Confirmed` / `Inferred` / `Unknown` marker with no mention of being superseded → that value becomes **Evidence**. Add **Status: active**.
2. If it currently says `Superseded` (with or without a separate confirmed/inferred/unknown marker) → **Status: superseded**. If an evidence value was recorded alongside it, keep it as **Evidence**. If not, set **Evidence: unknown** and flag the entry for review — don't guess what the original evidence level was.
3. Don't add **Source**/**Verification** retroactively just because the fields now exist — only add them where there's a genuine answer (rule 13's proportionality gate applies here too).
4. `Superseded` annotations already in prose (e.g. `> Superseded 2026-03: see below`) don't need to be rewritten — that's still how supersession gets recorded; **Status: superseded** is the structured counterpart for anything that also carries an Evidence/Status header.

**Example — before:**

```markdown
**Status:** active
**Confirmed** (2026-03-14, via maintainer interview)
```

**Example — after:**

```markdown
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14
```

(Verification omitted here — nothing to corroborate or contradict this against; adding it would be filler, not signal.)
