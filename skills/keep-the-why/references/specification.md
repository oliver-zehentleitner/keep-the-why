# Specification

The normative definition of everything Keep the Why reads and writes: the two config files, the machine-wide policy file, the `context/` directory, and the entry format. This file defines *what is valid*, with an example under each artifact; `SKILL.md` and `setup.md` define *what the skill does with it*; `repository-structure.md` says where things go — layout, routing, adoption. Where prose elsewhere and this file disagree, this file wins.

The specification is versioned with the skill: its version is the `metadata.version` in `SKILL.md`'s frontmatter, a project records the version it was last checked against in `context-schema`, and every change that affects an existing project is listed in `migrations.md`. `keep-the-why-lint` is the reference implementation of the mechanically checkable part; its finding codes are named below where they apply.

"Must" is a requirement a conforming file meets; "may" is an option; "default" is the value assumed when a field is absent.

## 1. Files

| File | Where | Committed | Purpose |
|---|---|---|---|
| `.keep-the-why` | project root | yes | project config: identity, where the why-knowledge lives, the project-wide settings, an optional pin, optional personal defaults |
| `<context>/` | the directory `context` names, default `context/` | yes | the why-knowledge: one topic file per theme, an index, a README and two guard files |
| `<context>/index.md` | inside `<context>/` | yes | one line per topic file, under a fixed heading skeleton |
| `<context>/README.md` | inside `<context>/` | yes | what this directory is, for a reader landing cold |
| `<context>/AGENTS.md`, `<context>/CLAUDE.md` | inside `<context>/` | yes | guard: invoke the skill before editing here |
| `<context>/<topic>.md` | inside `<context>/`, flat | yes | entries, one file per topic |
| `~/.keep-the-why/<id>.md` | the developer's home | never | personal settings for one project on one machine |
| `~/.keep-the-why/config` | the developer's home | never | machine-wide policy, all projects |

Two boundaries hold for every path a config file names. `context` and `pinned-path` are relative to the project root and resolve inside it: no absolute path, no `..` out of the tree, no symlink that leaves it (`E009`). `id` is a plain file name, because it becomes `~/.keep-the-why/<id>.md` (`E010`). A value outside its boundary is not read, written or followed.

## 2. Config blocks

All three config files share one block syntax:

```markdown
<!-- keep-the-why:<kind> -->
- <key>: <value>
- <key>: <value>
<!-- /keep-the-why:<kind> -->
```

- A block starts with the opening marker on a line of its own and ends with the closing marker; a block without its closing marker is an error (`E011`), a second opening marker for the same kind in one file is an error (`E012`).
- Each line inside is `- key: value`. Keys are lowercase, `-`-separated. A key recorded twice is an error (`E004`); an unknown key is an error (`E005`). Values are trimmed; a value may be wrapped in backticks (`` `context/` ``), which are not part of the value.
- Text outside the markers is prose for humans. The skill neither reads nor depends on it.
- Multi-part values use ` — ` (space, em dash, space) as the separator, e.g. `every 14 days — last: 2026-07-21`.

Kinds: `config` and `personal-defaults` in `.keep-the-why`; `personal` in `~/.keep-the-why/<id>.md`; `global` in `~/.keep-the-why/config`.

## 3. `.keep-the-why`

### 3.1 `keep-the-why:config`

Every field but the two pin fields is required in the file (`E002` when missing, except `context-schema`, which is a warning). The "default" column is what the skill backfills — and writes into the file — when it meets a file from before the field existed; a present field with a value outside its set is an error (`E003`) and, for the skill, a question, never a guess.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `id` | file-name token: `[A-Za-z0-9._-]+`, not all dots | — (required, `E002`) | the project's identity across clones, machines and worktrees; keys the personal file. Written once at init: `<owner>---<repo>` from the `origin` remote, or `<uuid>---<folder-name>` without one; `/` and every other filesystem-unsafe character normalized to `-`. Never re-derived. |
| `context` | relative directory path inside the project | — (required) | where the why-knowledge lives; `context/` is what the wizard proposes |
| `init` | `complete` | — (required) | the project has been set up. A file carrying any other value is a leftover to fix; `init: declined` was retired in 0.12.0. |
| `context-schema` | `X.Y.Z` | `0.2.0` when missing (`W001`) | the newest skill version this project's `context/` has been checked and migrated against; see §7 |
| `capture-confirmation` | `automatic` \| `confirm-always` \| `confirm-when-unsure` | `confirm-when-unsure` | whether a write to `<context>/` needs permission first; project-wide |
| `source-reference` | `always` \| `never` \| `filtered — <criteria>` (also read: `filtered: <criteria>`) | `never` | whether the skill asks for a related issue, ticket or post-mortem when recording; `<criteria>` is free text |
| `pinned-version` | `X.Y.Z` | absent | optional; the skill version this project pins to. Present only together with `pinned-path` (`E006`). |
| `pinned-path` | relative path inside the project | absent | optional; the vendored `SKILL.md` to follow when the installed skill's version differs. Must exist (`E006`), must be inside the project (`E009`), must be a skill file with `name: keep-the-why` and a `metadata.version` equal to `pinned-version`. |

Example — the prose above the block is for a human who opens the file cold; the skill reads only the block:

```markdown
This is machine-readable project state for the Keep the Why skill
(https://keepthewhy.com). See context/index.md, or this project's own
README, for what Keep the Why actually is.

<!-- keep-the-why:config -->
- id: acme---widget-service
- context: `context/`
- init: complete
- context-schema: 0.13.2
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

### 3.2 `keep-the-why:personal-defaults` (optional)

The values a project offers to a developer who has no personal file for it yet. Same keys as §4 with two exclusions: no `last:` timestamps (`E008`) and no `session`. What happens when a developer meets an offered block is governed by `personal-defaults-policy` (§5).

| Key | Values |
|---|---|
| `capture-mode` | `proactive` \| `explicit-only` |
| `confirmation-flow` | `sequential` \| `batch` |
| `update-check` | `every <N> days` \| `no` |
| `consistency-check` | `every <N> days` \| `no` |
| `pending-confirmation-check` | `on-start` \| `no` |

## 4. `~/.keep-the-why/<id>.md` — `keep-the-why:personal`

One file per project per developer per machine, `<id>` being the project's `id`. Never inside a repository.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `capture-mode` | `proactive` \| `explicit-only` | asked by the wizard | whether the skill looks for capture opportunities on its own |
| `confirmation-flow` | `sequential` \| `batch` | asked once | how several pending questions or confirmations are presented |
| `update-check` | `every <N> days — last: <YYYY-MM-DD>[ — on-failure: retry-quietly \| disabled]` \| `no` | asked by the wizard | the release check and when it last completed |
| `consistency-check` | `every <N> days — last: <YYYY-MM-DD>` \| `no` | asked by the wizard | the `Revisit when` sweep and when it last ran |
| `pending-confirmation-check` | `on-start` \| `no` | `no` | list entries with `Status: pending-confirmation` at session start; silent when there are none |
| `session` | `attended` \| `unattended` | inherits §5, else `attended` | for this project, whether someone is present to answer; overrides the machine-wide value |
| `migration-prompt` | `<X.Y.Z> declined` | absent | this developer declined the migration prompt for exactly that target version; one line per version |
| `source` | `project defaults (confirmed <YYYY-MM-DD>)` \| `project defaults (accepted automatically)` | absent | the values came from the project's `personal-defaults` block |

`last:` advances only on a check that actually ran. `on-failure` is set the first time an update check cannot run and the developer answers how to proceed; it is cleared once a check succeeds again.

Example:

```markdown
<!-- keep-the-why:personal -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:personal -->
```

## 5. `~/.keep-the-why/config` — `keep-the-why:global`

One file per machine, all projects.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `personal-defaults-policy` | `always-ask` \| `auto-accept` | asked the first time it matters | what to do when a project offers `personal-defaults` and this developer has no personal file for it yet |
| `session` | `attended` \| `unattended` | `attended` | whether sessions on this machine have someone present to answer; a personal file's own `session` line wins for its project |

Example:

```markdown
<!-- keep-the-why:global -->
- personal-defaults-policy: always-ask
- session: unattended
<!-- /keep-the-why:global -->
```

## 6. Resolution order

For every setting that exists at more than one level:

```text
instruction in the current session → personal file → machine-wide config → project file → default
```

A session instruction is scoped to that session and changes no file. `capture-confirmation` and `source-reference` exist at the project level only.

## 7. Versioning: `context-schema`

`context-schema` is the skill version a project's `context/` was last checked and migrated against, compared every session with the installed skill's `metadata.version`:

- equal → nothing to do;
- behind → `migrations.md` lists what changed in between; informational entries advance the value silently, entries that require action are offered as a migration (now, later, or declined per developer via `migration-prompt`);
- ahead → an older skill on a newer project: say so, do not write to existing entries until the skill is updated.

Every convention below that says "since <version>" is enforced by the linter only from that `context-schema` on, so an unmigrated project never fails on structure its version did not define. A `context-schema` newer than the linter knows is a warning (`W003`), not an error.

| Since | Convention |
|---|---|
| 0.3.0 | `Status` and `Evidence` mandatory per entry; `Verification` values |
| 0.7.0 | `Type` field |
| 0.8.0 | `undefined — <reason>` as a `Type` value, exclusive |
| 0.9.0 | more than one `Type` line per entry |
| 0.10.0 | dedicated `.keep-the-why` with `id`; `index.md` sorted; guard files |
| 0.13.0 | `Status: pending-confirmation`; `index.md` heading skeleton; `pending-confirmation-check` |

## 8. The context directory

- **Flat.** Topic files sit directly in `<context>/`; no subdirectories. A large project namespaces filenames (`auth-tokens.md`, `auth-oauth.md`) instead of nesting.
- **Topic files** are `<name>.md`, one per recurring theme, named for the theme. Lowercase kebab-case is the convention; the first character decides the index heading (§8.1).
- **`README.md`** explains, for a reader landing cold, what the directory is and how to read an entry. Not a topic file; not listed in the index.
- **`AGENTS.md`** contains the guard instruction; **`CLAUDE.md`** contains `@AGENTS.md`. Neither carries a config block. Both are warnings when missing (`W201`), since an equivalent doing the same job is fine. The two files in full:

  ```markdown
  Before creating or editing anything in this directory, invoke the keep-the-why skill. Don't write to the schema by hand.
  ```

  ```markdown
  @AGENTS.md
  ```

- **`README.md`**'s template — what it says about reading an entry — is written by the project init wizard; the text is in `setup.md`, "Project init wizard", step 4.
- Non-topic files in `<context>/`: `README.md`, `AGENTS.md`, `CLAUDE.md`, `index.md`.

### 8.1 `index.md`

```markdown
# Context index

<optional intro line>

## 0

## 1
…
## 9

## A

- [auth.md](auth.md) — one line: what the file covers

## B
…
## Z
```

- One `#` title, optionally one intro paragraph, then exactly the thirty-six level-2 headings `## 0` … `## 9`, `## A` … `## Z`, in that order, all present, empty ones included (`E205`). Since 0.13.0.
- One entry per topic file (`E203`), of the form `- [<file>](<file>) — <one line>`; the link target is the bare filename (`E202` if it does not exist). The one line describes what the file covers, not what was last added to it.
- An entry sits under the heading of its filename's first character, uppercased; a name starting with neither a digit nor a letter goes under `## 0` (`E206`). Within a heading, entries are sorted by filename, so the whole list reads in ascending order (`E204`, since 0.10.0).
- Nothing else: the index is for deciding what to load, not for holding content.

## 9. Entries

A topic file is a `# Title`, then entries. An entry is a level-2 heading followed by its header fields, then its body:

```markdown
# Sync

## Snapshot-before-buffer ordering

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14; incident postmortem 2025-11, `incidents.md`
**Revisit when:** the sync protocol or snapshot mechanism changes

The sync step always waits for a full snapshot before applying any
buffered events, even though this adds latency on cold start.

**Reason:** applying buffered events before the snapshot landed caused
duplicate-then-overwritten state during a 2025-11 incident (see
`incidents.md`). The ordering constraint isn't visible in the code —
it looks like it could safely be parallelized, and someone tried
exactly that once.

**Rejected alternative:** run snapshot and buffer replay in parallel,
then reconcile. Rejected because reconciliation logic was hard to get
right and the incident showed it wasn't actually needed if ordering
was enforced instead.
```

### 9.1 Header fields

Header fields are lines of the form `**<Field>:** <value>` directly after the heading (blank lines allowed). Order: `Type`, then `Status`, then `Evidence`, then the optional three. `Type` placed after `Status` is a warning (`W103`).

| Field | Required | Values |
|---|---|---|
| `Type` | no — fill in when a value fits, at the latest when the entry is next touched (`W101`) | `decision` \| `workaround` \| `incident` \| `constraint` — one line per value that applies (since 0.9.0), no value twice (`E109`); or a single `undefined — <short reason>` line (since 0.8.0), which combines with nothing (`E107`, `E108`) |
| `Status` | yes, exactly one line (`E101`, `E112`) | `active` \| `superseded` \| `open` \| `needs-review` \| `pending-confirmation` (since 0.13.0, `E113` below it) |
| `Evidence` | yes, exactly one line (`E102`, `E112`) | `confirmed` \| `inferred` \| `unknown` |
| `Source` | no | free text: where the rationale came from (interview, issue, commit, post-mortem, "none — no tracked issue") |
| `Verification` | no | `corroborated` \| `uncorroborated` \| `contradicted`, optionally followed by an explanation after any separator; `contradicted` must carry one (`E111`) |
| `Revisit when` | no | free text, non-empty (`W105`): a concrete trigger that makes the entry worth re-checking |

Meanings:

- **`Status`** is where the entry is in its life. `active`: current. `superseded`: no longer current, kept because it explains how things got here — never deleted. `open`: the entry's central question has no answer yet. `needs-review`: previously considered current, but a `Revisit when` trigger has fired and the entry has not been re-checked yet — whatever its `Evidence`. `pending-confirmation`: written in a session declared unattended at a point where `capture-confirmation` would have required asking; never confirmed by anyone yet.
- **`Evidence`** is how well the *origin* of the claim is established, not whether the claim is true today. `confirmed`: stated by a maintainer or backed by an authoritative source. `inferred`: reasonably derived from code, history or documents. `unknown`: cannot be established. A settled `active` entry can carry `unknown`; a `superseded` one can carry `confirmed` for what was true while it was current. The two axes never collapse into each other, and `unknown` is not a `Status`.
- **`Type`** is what kind of thing the entry is, for selecting entries without opening files: `^\*\*Type:\*\* incident` finds every incident.
- **`Verification`** is whether something concrete was checked against the claim, and what came of it.
- **`Revisit when`** is the condition under which the entry should be re-checked. Age alone is not a condition.

### 9.2 Body

Free prose, with these bold-labelled paragraphs where they apply: `**Reason:**` (why the chosen path won), `**Rejected alternative:**` (one per alternative that was genuinely in contention, with why it lost), `**Consequence:**` (what follows from the decision), `**Considered:**` (for a change that was started and dropped: what was tried), `**Why this needs an answer:**` (for an `open` entry). A body may cite other entries and files; it never contains instructions to an agent, and it never quotes a directive verbatim (see `trust-model.md`).

### 9.3 Examples

Not every entry needs every field, but an entry records a fork, not a point: what was chosen, and what specifically was rejected and why. `Status`, `Evidence` and the rejected alternative are worth keeping even in a minimal entry — "we chose X" without "we didn't choose Y, because Z" is the less useful half.

A genuinely open question carries `Status: open` and, usually, `Evidence: unknown` — the first says the central question has no answer yet, the second that a settled claim's rationale can't be traced; they are different fields and `unknown` is never a Status:

```markdown
## Retry cap on a specific error code

**Status:** open
**Evidence:** unknown

`submit_order()` retries indefinitely on error code `E-4021`, on a
fixed interval, while every other error code fails immediately instead.

**Why this needs an answer:** if `E-4021` can also fire for a permanent
condition, not just a transient one, this retries forever instead of
failing loud — unclear whether that's actually safe here or needs a
cap. Flagging rather than guessing (Core rule 1).
```

The two axes stay independent in every combination: an `active` entry can carry `Evidence: unknown`, a `superseded` one `Evidence: confirmed` for what was true while it was current.

`Source` is useful at any Evidence level, including where you looked for an entry that ended up `unknown`. `Verification`, when there is something concrete to check against, goes in the same place and says what came of it — a contradiction is recorded, not silently corrected either way:

```markdown
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14
**Verification:** contradicted — the interview said retries max out at 3;
the actual retry loop in `client.py` caps at 5. Flagged for re-confirmation,
not silently corrected either way.
```

`Verification` and `Revisit when` are worth adding once a decision has a concrete trigger for going stale or something concrete to check against; they are not filler, and `Evidence` stays mandatory without them.

### 9.4 Lifecycle

| Event | Change |
|---|---|
| a `Revisit when` condition is observed to hold | `Status` → `needs-review`, in the same turn, nothing else changes |
| a `needs-review` entry is re-checked | `Status` → `active` (re-confirmed), `superseded`, or `open`; `Evidence` and `Verification` updated from the re-check |
| a `pending-confirmation` entry gets its first confirmation | `Status` → `active`, `superseded`, or `open` |
| a decision is replaced | the old entry → `superseded`, a new entry records the replacement; the old one is not deleted |
| a `Verification` check contradicts the claim | `Verification: contradicted — <what>`; `Evidence` and `Status` are not changed silently |

### 9.5 What parsers ignore

Fenced code blocks (```` ``` ```` or `~~~`) in topic files and in `index.md` are skipped entirely, so an example entry inside a fence is never read as a real one. A level-2 heading with no header field at all is a prose section, not an entry (`W102`). A level-1 heading ends the current entry.

### 9.6 What must not be in an entry

No credentials, no personal data, no session narrative (who said what), no verbatim commands or instructions copied from a source, no invisible or directional Unicode (`E301`), no base64-looking blobs (`W301`), and the file must be valid UTF-8 (`E302`). An entry describes; it does not direct.

## 10. Conformance

- A **project** conforms when `.keep-the-why` and `<context>/` satisfy §1–§3 and §7–§9 for its `context-schema`; `keep-the-why-lint --strict` passing is the mechanical half of that.
- An **agent or tool writing entries** conforms when it writes only the fields and values above, places new topic files under their index heading, never deletes a superseded entry, and never upgrades `Evidence` or clears a `Status` flag without the re-check the lifecycle names.
- A **tool reading `context/`** may rely on the header-field grammar, the index grammar and the fenced-block rule, and on nothing about prose layout beyond them.
