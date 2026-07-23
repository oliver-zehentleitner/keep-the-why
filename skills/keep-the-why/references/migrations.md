# Migrations

What changed in each version that affects the *format* of existing `context/` entries, and how to bring them up to date. Not every release needs an entry here — most changes affect the skill's own behavior, not what's already written in a project's `context/`. See `setup.md` for how and when this file gets consulted.

Entries below assume 0.2.0 as the starting point — nothing before it tracked a `context-schema` at all, and 0.2.0 itself introduced no `context/` entry format change.

## 0.3.0 — Evidence split from Status

**What changed:** `context/` entries previously classified evidence as one of confirmed, inferred, unknown, *or* superseded — treating "superseded" as if it were a fourth evidence level. It isn't: whether a decision is still current (Status) and how well it's evidenced (Evidence) are independent questions. A superseded decision can have been thoroughly confirmed when it was still active. Also added: an optional Source/Verification pair for confirmed entries whose claim is worth tracing or could be checked against other evidence.

**New fields (see `SKILL.md` rules 2 and 7):**

- **Status:** active | superseded | open | needs-review
- **Evidence:** confirmed | inferred | unknown *(unchanged values, now its own field)*
- **Source** and **Verification** (corroborated | uncorroborated | contradicted) — optional, only add where there's a real answer, per the proportionality principle. A `contradicted` verification must explain what contradicts it.

**Migrating an existing entry:**

1. If it currently has a single `Confirmed` / `Inferred` / `Unknown` marker with no mention of being superseded → that value becomes **Evidence**. Add **Status: active**.
2. If it currently says `Superseded` (with or without a separate confirmed/inferred/unknown marker) → **Status: superseded**. If an evidence value was recorded alongside it, keep it as **Evidence**. If not, set **Evidence: unknown** and flag the entry for review — don't guess what the original evidence level was.
3. Don't add **Source**/**Verification** retroactively just because the fields now exist — only add them where there's a genuine answer (rule 12's proportionality gate applies here too).
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
