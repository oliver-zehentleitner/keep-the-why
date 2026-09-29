# Specification

The normative definition of everything Keep the Why reads and writes: the project config file, the personal file, the machine-wide policy file, a context cache's settings file, the `context/` directory, and the entry format. This file defines *what is valid*, with an example under each artifact; `SKILL.md` and `setup.md` define *what the skill does with it*; `repository-structure.md` says where things go — layout, routing, adoption. Where prose elsewhere and this file disagree, this file wins.

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
| `~/.keep-the-why/projects.json` | the developer's home | never | the mapping: where each project has been seen on this machine, with a timestamp per path; written by the skill's setup check and by `keep-the-why-dashboard`, read by both (§5.2) |
| `~/.keep-the-why/cache/<id>/` | the developer's home | never | a read-only context cache of a family member that is not checked out here: a sparse partial clone holding its `.keep-the-why` and its context directory, nothing else (§5.2) |
| `~/.keep-the-why/cache/<id>.md` | the developer's home | never | that cache's own settings and refresh timestamp, next to the directory, not inside it (§5.1) |

All of these are written and kept current by the skill — the config files by the two wizards and the setup check, `<context>/` by capture and maintenance. A person answers the setup once per project and the occasional question; editing a file by hand is for changing a setting, not part of using it.

**The project** is the tree under the nearest `.keep-the-why` walking up from the working directory, minus the trees under any deeper `.keep-the-why`. Discovery walks up the way Git walks up to `.git`; the nearest file wins and cuts off everything above it, whether or not a Git boundary lies in between. A directory above several projects and below none is not a project. The four layouts this admits — one repository with one instance, one repository with several, several repositories, one — are in `repository-structure.md`, "Layouts".

Three boundaries hold for every path a config file names. `context` and `pinned-path` are relative to the project root and resolve inside it: no absolute path, no `..` out of the tree, no symlink that leaves it (`E009`). `root`, a path-form `parent` and a path-form child location are relative and resolve inside the Git toplevel — the same rule one level up, since a family member may be a sibling directory in the same repository and nothing else (`E009`). `id` is a plain file name, because it becomes `~/.keep-the-why/<id>.md` (`E010`). A value outside its boundary is not read, written or followed. `canonical`, a URL-form `parent` and a URL-form child location are URLs and never filesystem paths.

## 2. Config blocks

All four config files share one block syntax:

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

Kinds: `config`, `personal-defaults` and `children` in `.keep-the-why`; `personal` in `~/.keep-the-why/<id>.md`; `global` in `~/.keep-the-why/config`; `cache` in `~/.keep-the-why/cache/<id>.md`.

## 3. `.keep-the-why`

### 3.1 `keep-the-why:config`

Required in the file: `id`, `context`, `init`, `capture-confirmation`, `source-reference` (`E002` when missing) and `context-schema` (a warning, `W001`). The rest — `canonical`, `parent`, `dashboard-state`, `root` and the two pin fields — are optional. The "default" column is what the skill backfills — and writes into the file — when it meets a file from before the field existed; a present field with a value outside its set is an error (`E003`) and, for the skill, a question, never a guess.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `id` | file-name token: `[A-Za-z0-9._-]+`, not all dots | — (required, `E002`) | the project's identity across clones, machines and worktrees; keys the personal file. Written once at init: `<owner>---<repo>` from the published remote (`upstream` in a fork checkout, else `origin`) of the nearest `.git` above the file, or `<uuid>---<folder-name>` without one; `/` and every other filesystem-unsafe character normalized to `-`. A `.keep-the-why` below the Git toplevel (an isolated-context mono repo) appends its `root` as a slug: `<owner>---<repo>---<sub-path>`. Never re-derived. |
| `canonical` | `https://<host>/<path>`, no trailing slash, no `.git` suffix, no query or fragment | absent when the project has no remote; backfilled from the published remote otherwise (`upstream` in a fork checkout, else `origin`) | the repository's stored locator: the normalized URL of the published remote, SSH forms rewritten to `https`. Written once at init and changed only deliberately, when the repository is renamed, transferred or moved; not re-derived (`E003` when malformed). |
| `parent` | `https://<host>/<path>` (another repository) or a relative directory path inside the Git toplevel | absent (no parent) | the project this one belongs to, when it is part of a larger one: the parent's `canonical`, or its path relative to this `.keep-the-why` in an isolated-context mono repo (`..` for a sub-project whose parent is the repository root). At most one. The parent lists this project back in its `children` block (§3.3); when both sides are in the checkout the linter checks the link both ways (`E015`); a URL is checked for shape only (`E003`), a path for its boundary (`E009`). |
| `dashboard-state` | `https://<site>/<path>.json`, normally `…/state.json` | absent (no published export) | where this project's dashboard export is published — the `state.json` that `ktw-dashboard --export` writes next to `index.html` and `badge.svg`. Read by another dashboard in *public* mode to browse this project's family member without a checkout; `E003` when malformed. |
| `root` | relative directory path inside the Git toplevel | absent (the file is at the toplevel) | the path of this `.keep-the-why` relative to the Git toplevel, for a project below it (an isolated-context mono repo). Tooling keys such a project by `(canonical, root)`. Not set on a toplevel (`E003`); never `..` or absolute (`E009`). |
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
- canonical: https://github.com/acme/widget-service
- context: `context/`
- init: complete
- context-schema: 0.18.0
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

### 3.2 `keep-the-why:personal-defaults` (optional)

The values a project offers to a developer who has no personal file for it yet. The six keys below — §4 without `session`, `migration-prompt` and `source`, and without `last:` timestamps (`E008`). What happens when a developer meets an offered block is governed by `personal-defaults-policy` (§5).

| Key | Values |
|---|---|
| `capture-mode` | `proactive` \| `explicit-only` |
| `confirmation-flow` | `sequential` \| `batch` |
| `update-check` | `every <N> days` \| `no` |
| `consistency-check` | `every <N> days` \| `no` |
| `pending-confirmation-check` | `on-start` \| `no` |
| `local-lint` | `auto` \| `ask` \| `no` |

### 3.3 `keep-the-why:children` (optional)

The parent of a family lists its children here, one line each — and this is the *routing*: where an entry about something belongs when it is not the project the agent happens to be working in. `setup.md`, "Family: routing and writing across projects", says what the skill does with it.

```markdown
<!-- keep-the-why:children -->
- <name>: <location> — <scope>
<!-- /keep-the-why:children -->
```

- `<name>`: a token in the block grammar's key alphabet, for prose and findings (`unicorn-binance-rest-api`, `widget`); listed once (`E004`).
- `<location>`: the child's `canonical` (another repository), or a relative directory path inside the Git toplevel (an isolated-context mono repo: `packages/widget`). A path must exist and carry a `.keep-the-why` (`E016`) whose `parent` points back here (`E015`); a URL is checked for shape only. Any other form is `E014`; a path leaving the repository is `E009`.
- `<scope>`: **required** (`E014`) — one line saying what belongs in that project. It is written once, here; the child does not repeat it, its own `index.md` already lists what it holds.

The parent's own scope is not written: it holds what is family-wide, or clearly its own. The block is not a dependency graph and not a list of every related repository — a family member is a project whose `context/` is organized together with this one, one parent, any number of children. A project with a `children` block may itself carry a `parent`: a family can nest (a cluster with its dashboard as a child, the cluster itself a child of a suite), and the family is then the whole tree — its root, the one ancestor without a `parent`, and everything below it. Each level's block routes among its own children only; routing and writing follow the parent chain (`setup.md`, "Family: routing and writing across projects").

Example, the parent of a suite:

```markdown
<!-- keep-the-why:children -->
- unicorn-binance-rest-api: https://github.com/oliver-zehentleitner/unicorn-binance-rest-api — REST client, endpoint coverage, rate limits
- unicorn-binance-websocket-api: https://github.com/oliver-zehentleitner/unicorn-binance-websocket-api — stream client, websocket libraries, reconnect behaviour
<!-- /keep-the-why:children -->
```

and a child's config line: `- parent: https://github.com/oliver-zehentleitner/unicorn-binance-suite`.

## 4. `~/.keep-the-why/<id>.md` — `keep-the-why:personal`

One file per project per developer per machine, `<id>` being the project's `id`. Never inside a repository.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `capture-mode` | `proactive` \| `explicit-only` | asked by the wizard, which proposes `proactive` | whether the skill looks for capture opportunities on its own. `proactive`: it records rationale as it surfaces in normal work, nobody has to ask; `explicit-only`: it waits for a request |
| `confirmation-flow` | `sequential` \| `batch` | asked once; the wizard proposes `batch` | how several pending questions or confirmations are presented |
| `update-check` | `every <N> days — last: <YYYY-MM-DD>[ — on-failure: retry-quietly \| disabled]` \| `no` | asked by the wizard | the release check and when it last completed |
| `consistency-check` | `every <N> days — last: <YYYY-MM-DD>` \| `no` | asked by the wizard | the `Revisit when` sweep and when it last ran |
| `pending-confirmation-check` | `on-start` \| `no` | `no` | list entries with `Status: pending-confirmation` at session start; silent when there are none |
| `local-lint` | `auto` \| `ask` \| `no` | `auto` from the wizard; `ask` when the line is absent | run `keep-the-why-lint` after every write to the context location and after a settings change (`--setup`); the linter's version must be at least the skill's — `auto` installs or updates it from PyPI unasked, `ask` asks first |
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
| `cache-refresh` | `every <N> days` \| `no` | `every 1 day`, asked once when the first cache is created | how often a context cache is pulled before it is read; a cache file's own `refresh` line wins for that cache (`W002` when malformed) |
| `cache-offline` | `ask` \| `read-stale` \| `stop` | `ask` | what to do when a cache cannot be pulled: ask, read it and say its date, or stop; a cache file's own `offline` line wins (`E003` when malformed) |

Example:

```markdown
<!-- keep-the-why:global -->
- personal-defaults-policy: always-ask
- session: unattended
<!-- /keep-the-why:global -->
```

### 5.1 `~/.keep-the-why/cache/<id>.md` — `keep-the-why:cache`

One file per cache, next to the cache directory `~/.keep-the-why/cache/<id>/`, never inside it (the clone stays untouched and its `git status` clean). Written when the cache is created.

| Key | Values | Default | Meaning |
|---|---|---|---|
| `canonical` | the cached project's `canonical` | written at creation | which repository this cache holds |
| `refresh` | `every <N> days — last: <YYYY-MM-DD>` \| `no` | the machine-wide `cache-refresh` | this cache's own interval and when it was last pulled; overrides §5 |
| `offline` | `ask` \| `read-stale` \| `stop` | the machine-wide `cache-offline` | this cache's own answer for a failed pull; overrides §5 |

```markdown
<!-- keep-the-why:cache -->
- canonical: https://github.com/oliver-zehentleitner/unicorn-binance-suite
- refresh: every 1 day — last: 2026-09-27
- offline: read-stale
<!-- /keep-the-why:cache -->
```

### 5.2 `~/.keep-the-why/projects.json` and the cache directory

`projects.json` is JSON, not a Markdown block, because it is cache data rather than a setting: many rows, timestamps, written by tools and read by tools.

```json
{
 "projects-json": 1,
 "projects": [
  {
   "id": "oliver-zehentleitner---unicorn-binance-suite",
   "canonical": "https://github.com/oliver-zehentleitner/unicorn-binance-suite",
   "root": "",
   "paths": [{"path": "/home/me/projects/unicorn-binance-suite", "last_seen": "2026-09-27T10:12:03"}],
   "cache": "/home/me/.keep-the-why/cache/oliver-zehentleitner---unicorn-binance-suite"
  }
 ]
}
```

- One row per project (`id`; `canonical` and `root` when the project has them), `paths` most recently seen first with `last_seen`, and `cache` when a context cache exists. Rows and paths are ordered most recent first; a reader may rely on the order and on the timestamps, and must tolerate unknown keys.
- The skill's setup check records the current project's path on every session; the dashboard records a project when it is opened. Both write the whole file; neither writes anything else there.
- `~/.keep-the-why/cache/<id>/` is a sparse partial clone (`git clone --filter=blob:none --sparse`) checked out to the member's `.keep-the-why` and its context directory only — no agent instruction files, nothing else of the repository. **It is read-only for every tool:** the skill reads from it and never writes into it, the dashboard reads it; deleting it loses nothing, because nothing lives only there.

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
| 0.18.0 | `Id` per entry, mandatory and unique; `See` and `Superseded by` (`E114`–`E121`) |

## 8. The context directory

- **Flat.** Topic files sit directly in `<context>/`; no subdirectories. A large project namespaces filenames (`auth-tokens.md`, `auth-oauth.md`) instead of nesting.
- **Topic files** are `<name>.md`, one per recurring theme, named for the theme. Lowercase kebab-case is the convention; the first character decides the index heading (§8.1). A topic file carries no `Id`: its file name is its address, in the index and in `See` locators. A file that grows unwieldy is split into narrower topics (`SKILL.md`, rule 6).
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
- Those thirty-six headings together are the *index skeleton* — the name this specification uses for them; "deterministic write areas" names what they do for concurrent branches (two topics added on two branches land under their own headings, not in one conflicting hunk), not the skeleton itself.
- One entry per topic file (`E203`), of the form `- [<file>](<file>) — <one line>`; the link target is the bare filename (`E202` if it does not exist). The one line describes what the file covers, not what was last added to it.
- An entry sits under the heading of its filename's first character, uppercased; a name starting with neither a digit nor a letter goes under `## 0` (`E206`). Within a heading, entries are sorted by filename, so the whole list reads in ascending order (`E204`, since 0.10.0).
- Nothing else: the index is for deciding what to load, not for holding content.

## 9. Entries

A topic file is a `# Title`, then entries. An entry is a level-2 heading followed by its header fields, then its body:

```markdown
# Sync

## Snapshot-before-buffer ordering

**Id:** 2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14; incident postmortem 2025-11, `incidents.md`
**Revisit when:** the sync protocol or snapshot mechanism changes
**See:** incidents.md#duplicate-state-after-cold-start-2025-11 — 9b2d4f60-7c1e-4a8b-b3d5-6e7f8a9b0c1d — as of 2026-03-14

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

Header fields are lines of the form `**<Field>:** <value>` directly after the heading (blank lines allowed). Order: `Id` first, then `Type`, `Status`, `Evidence`, then the optional ones in the order of the table. `Type` placed after `Status` is a warning (`W103`).

| Field | Required | Values |
|---|---|---|
| `Id` | yes, exactly one line, since 0.18.0 (`E114`, `E112`) | a UUID version 4, lowercase, `8-4-4-4-12` hex (`E115` checks the shape); unique in the project (`E116`). Assigned when the entry is written, by an OS command — `uuidgen`, `cat /proc/sys/kernel/random/uuid`, PowerShell's `[guid]::NewGuid()` — never composed by hand or from memory; never changed afterwards |
| `Type` | no — fill in when a value fits, at the latest when the entry is next touched (`W101`) | `decision` \| `workaround` \| `incident` \| `constraint` — one line per value that applies (since 0.9.0), no value twice (`E109`); or a single `undefined — <short reason>` line (since 0.8.0), which combines with nothing (`E107`, `E108`) |
| `Status` | yes, exactly one line (`E101`, `E112`) | `active` \| `superseded` \| `open` \| `needs-review` \| `pending-confirmation` (since 0.13.0, `E113` below it) |
| `Evidence` | yes, exactly one line (`E102`, `E112`) | `confirmed` \| `inferred` \| `unknown` |
| `Source` | no | free text: where the rationale came from (interview, issue, commit, post-mortem, "none — no tracked issue") — a kind of source, never a person's name, handle or e-mail address (rule 7) |
| `Verification` | no | `corroborated` \| `uncorroborated` \| `contradicted`, optionally followed by an explanation after any separator; `contradicted` must carry one (`E111`) |
| `Revisit when` | no | free text, non-empty (`W105`): a concrete trigger that makes the entry worth re-checking |
| `See` | no; one line per cited entry, since 0.18.0 | `<locator> — <uuid> — as of <YYYY-MM-DD>` (`E117`). Inside the project the locator is `<file>.md` or `<file>.md#<anchor>`, the anchor being the target heading as the host renders it (lowercase, punctuation dropped, spaces to `-`); the `<uuid>` must name an entry here (`E118`) and the locator must still point at it (`E119`). In another project the locator is that project's `canonical` and nothing more — no path, no anchor — and is checked for shape only: the form of a `canonical` value (§3.1), no query, no fragment (`E117`) |
| `Superseded by` | yes when `Status` is `superseded` (`E120`), forbidden otherwise (`E121`); exactly one line (`E112`); since 0.18.0 | the successor: an `<uuid>` of an entry here (`E118`), a `<canonical> — <uuid> — as of <YYYY-MM-DD>` reference to one in another project (the locator checked as for `See`), or `none — <why nothing replaced it>` (`E117`) |

Meanings:

- **`Status`** is where the entry is in its life. `active`: current. `superseded`: no longer current, kept because it explains how things got here — never deleted. `open`: the entry's central question has no answer yet. `needs-review`: previously considered current, but a `Revisit when` trigger has fired and the entry has not been re-checked yet — whatever its `Evidence`. `pending-confirmation`: written in a session declared unattended at a point where `capture-confirmation` would have required asking; never confirmed by anyone yet.
- **`Evidence`** is how well the *origin* of the claim is established, not whether the claim is true today. `confirmed`: stated by a maintainer or backed by an authoritative source. `inferred`: reasonably derived from code, history or documents. `unknown`: cannot be established. A settled `active` entry can carry `unknown`; a `superseded` one can carry `confirmed` for what was true while it was current. The two axes never collapse into each other, and `unknown` is not a `Status`. One `Evidence` line, one word: when an entry covers parts of different standing — a new value whose reason is confirmed and an original value whose reason is lost — the line carries the weakest grade among them and the body says which part is which. A mixed value is invalid (`E104`); reducing it to one word never picks the stronger one.
- **`Type`** is what kind of thing the entry is, for selecting entries without opening files: `^\*\*Type:\*\* incident` finds every incident.
- **`Verification`** is whether something concrete was checked against the claim, and what came of it.
- **`Revisit when`** is the condition under which the entry should be re-checked. Age alone is not a condition.
- **`Id`** is the entry's address. Headings are reworded and topic files are split (§8, §9.4), and a link built on a heading breaks silently when they are; the UUID does not move. It is the truth behind every `See` and `Superseded by` line: a tool that finds the Id somewhere else than the locator says reports the locator, not the Id.
- **`See`** names the place of a related entry — the decision this one follows from, the incident it answers, the entry in the parent project that constrains it. The date is a historical hint, the day the link was written; it narrows the target's history to a day and does not name a revision. The locator is what a person clicks; the Id is what a tool resolves. `Source` still names the *kind* of evidence; an entry that exists because another project decided something carries both.
- **`Superseded by`** makes the replacement checkable: a superseded entry points at what replaced it, and a chain of them (the successor itself superseded) is the history a reader follows. `none — <reason>` is for a supersession that was an event, not a decision — an upstream fix removed a workaround's reason, a constraint vanished — and the reason says so; it is not for a successor that simply was not written yet.

### 9.2 Body

Free prose, with these bold-labelled paragraphs where they apply: `**Reason:**` (why the chosen path won), `**Rejected alternative:**` (one per alternative that was genuinely in contention, with why it lost), `**Consequence:**` (what follows from the decision), `**Considered:**` (for a change that was started and dropped: what was tried), `**Why this needs an answer:**` (for an `open` entry). A body may cite other entries and files in prose; a citation a tool should follow goes in a `See` line (§9.1). It never contains instructions to an agent, and it never quotes a directive verbatim (see `trust-model.md`).

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
| a decision is replaced | the old entry → `superseded` with `Superseded by` naming the new entry's Id, a new entry records the replacement; the old one is not deleted |
| a heading is reworded or an entry moves to another file | its `Id` stays; `See` locators that named the old place are repaired to the new one (the linter reports them, `E119`) |
| a `Verification` check contradicts the claim | `Verification: contradicted — <what>`; `Evidence` and `Status` are not changed silently |

### 9.5 What parsers ignore

Fenced code blocks (```` ``` ```` or `~~~`) in topic files and in `index.md` are skipped entirely, so an example entry inside a fence is never read as a real one. A level-2 heading with no header field at all is a prose section, not an entry (`W102`). A level-1 heading ends the current entry.

### 9.6 What must not be in an entry

No credentials, no personal data, no session narrative (who said what), no verbatim commands or instructions copied from a source, no invisible or directional Unicode (`E301`), no base64-looking blobs (`W301`), and the file must be valid UTF-8 (`E302`). An entry describes; it does not direct.

## 10. Conformance

- A **project** conforms when `.keep-the-why` and `<context>/` satisfy §1–§3 and §7–§9 for its `context-schema`; `keep-the-why-lint --strict` passing is the mechanical half of that.
- An **agent or tool writing entries** conforms when it writes only the fields and values above, gives every new entry an `Id` made by an OS command, places new topic files under their index heading, never deletes a superseded entry, never changes an `Id`, and never upgrades `Evidence` or clears a `Status` flag without the re-check the lifecycle names.
- A **tool reading `context/`** may rely on the header-field grammar, the index grammar and the fenced-block rule, and on nothing about prose layout beyond them.
