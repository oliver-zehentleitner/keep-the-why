# Migrations

What changed in each version that affects the *format* of existing `context/` entries, and how to bring them up to date. Not every release needs an entry here — most changes affect the skill's own behavior, not what's already written in a project's `context/`. See `setup.md` for how and when this file gets consulted.

Entries below assume 0.2.0 as the starting point — nothing before it tracked a `context-schema` at all, and 0.2.0 itself introduced no `context/` entry format change.

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
