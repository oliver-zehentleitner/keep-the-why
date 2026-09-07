# Repository structure

Concrete guidance for applying the structure described in `methodology.md`.

## Default layout

```text
project/
├── AGENTS.md
├── AGENTS.local.md          # not committed
├── .keep-the-why             # this skill's own project config, committed
├── docs/
│   ├── index.md
│   ├── setup.md
│   ├── usage.md
│   ├── testing.md
│   └── troubleshooting.md
└── context/
    ├── README.md              # short, GitHub renders it when someone browses the folder cold
    ├── AGENTS.md               # guard: invoke this skill before editing, don't hand-write the schema
    ├── CLAUDE.md               # @AGENTS.md import
    ├── index.md
    ├── architecture.md
    ├── <topic>.md            # one per recurring theme, named for the theme, not the file it touches
    └── incidents.md
```

This skill's own personal config lives at `~/.keep-the-why/<id>.md`, outside the project entirely — never part of the repo, not shown above. See `references/setup.md`.

Adjust freely. A one-file script doesn't need six `docs/` files. `context/` stays flat — no subdirectories — even for a large project; if topic files alone stop scaling, namespace filenames instead (e.g. `auth-tokens.md` and `auth-oauth.md`, or `tokens-auth.md` and `oauth-auth.md` — prefix or suffix, whichever groups and sorts more usefully for that project) rather than nesting `context/auth/`. The shape should track the project's actual complexity, not a template.

## Which file does this belong in?

A project accumulates several files that all explain *something*: README, `docs/`, `CONTRIBUTING.md`, `context/`, `AGENTS.md`, `AGENTS.local.md`, and often a separate `CHANGELOG.md` (Keep the Why doesn't generate this one, but routing decisions still need to account for it). Content ending up in the wrong one — or copied into more than one — is exactly the kind of redundancy this skill should prevent, not add to.

The routing question is always **who is reading this, and what do they need to do next**:

| File | Reader | Question it answers |
|---|---|---|
| `README.md` | Someone evaluating whether to use this at all | What is this, should I care, how do I get started |
| `docs/` | Someone actively using it | How do I configure, operate, or troubleshoot this |
| `CONTRIBUTING.md` | Someone about to change the code | How do I set up a dev environment, what are the conventions, how does a PR get reviewed |
| `context/` | Anyone (human or agent) about to change something and needing to know why first | Why is this built the way it is, what was tried and rejected |
| `CHANGELOG.md` | Someone tracking what changed between versions | What changed, in which release |
| `AGENTS.md` | Any agent working in the repo | Where to look — a pointer, not the content itself |
| `AGENTS.local.md` | This one specific developer | Personal, local, not relevant to anyone else |

When recording something, resolve it to exactly one of these — then have every other file that would naturally mention it *point* to that one, not restate it. A README's contributing section should be a one-line link to `CONTRIBUTING.md`, not a partial copy of its dev-setup steps; `docs/installation.md` (for end users installing a release) and `CONTRIBUTING.md`'s dev-setup section (for contributors setting up from source) can overlap in steps without one having to explain the other's context — link between them if the overlap is substantial enough that keeping both in sync matters.

**An embedded procedure isn't why-content, even when it surfaces alongside a real decision.** A `context/` entry can legitimately explain *why* something is true (a platform limitation, a constraint) while also carrying a *workaround* for it — but the workaround itself ("if X, do Y") is an instruction, not rationale, and belongs wherever the table above already routes instructions (`CONTRIBUTING.md` for a dev/maintainer procedure, `docs/` for an end-user one), not inside the `context/` entry. The same split applies to a rule that has no rationale behind it at all — "keep the CHANGELOG's headings deduplicated," "sort these alphabetically because it reads cleaner" — record the rule where its reader needs it (`AGENTS.md` if it's something an agent working in the repo should just follow, `CONTRIBUTING.md` if it's aimed at contributors); don't manufacture a Decision/Reason/Rejected-alternative structure for a preference that has none.

When something genuinely doesn't fit the table above (e.g. security disclosure process, a code of conduct), that's a signal it's a different kind of artifact — governance or legal, not comprehension — and outside what this skill routes for. Don't force it into `context/` just because there's nowhere else obvious to put it.

## `AGENTS.md` — example

```markdown
# AGENTS.md

- Usage docs: see `docs/index.md`
- Why things are the way they are: see `context/index.md`
- If `AGENTS.local.md` exists in this repo, read that too — personal/local notes.

Read `context/index.md` before making non-trivial changes to understand
prior decisions and avoid re-litigating or accidentally reverting them.
```

Keep `AGENTS.md` short. Anything longer belongs in `docs/` or `context/`, not here — `AGENTS.md` needs to stay generic enough for every tool that reads the open AGENTS.md convention, not just this skill. It doesn't carry this skill's config block, or even a pointer to it — that lives entirely in `.keep-the-why` instead (see below), so `AGENTS.md` stays that generic, tool-agnostic pointer with nothing skill-specific baked into it at all. Whether and how a project mentions Keep the Why to a human reading `AGENTS.md`, a README, or anywhere else is that project's own editorial call — not something this skill writes in on its own; see the badge question in `setup.md`'s project init wizard.

## `.keep-the-why` — project config example

```markdown
This is machine-readable project state for the Keep the Why skill
(https://keepthewhy.com). See context/index.md, or this project's own
README, for what Keep the Why actually is.

<!-- keep-the-why:config -->
- id: acme---widget-service
- context: `context/`
- init: complete
- context-schema: 0.13.0
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

Committed, one per project. The prose above the block is for a human who opens the file cold; the skill reads only the block. Every field, its values and defaults, the `id` grammar and the pin conditions: `references/specification.md`. What the fields do, how `id` is generated at init and why it is never re-derived: `setup.md`. A project can add a `personal-defaults` block and the `pinned-version`/`pinned-path` pair; both are specified and explained in the same two places.

## `~/.keep-the-why/<id>.md` — personal config example

```markdown
<!-- keep-the-why:personal -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:personal -->
```

Never committed, never part of the repo at all — one file per project per developer per machine, keyed by the project's `id`. Every field, including the lines that only appear later (`migration-prompt`, `source`, `session`): `references/specification.md`. Why these settings are personal while `capture-confirmation` and `source-reference` are project-wide: `setup.md`, "Two config files, two different scopes".

## `context/index.md` — example

```markdown
# Context index

## 0

## 1

…one heading per digit, through 9…

## 9

## A

- [architecture.md](architecture.md) — why the system is shaped this way

## B

## C

- [compatibility.md](compatibility.md) — why certain old-looking code paths still exist

## D

…one heading per letter, all the way to Z, most of them empty…

## S

- [sync.md](sync.md) — synchronization design, snapshot/buffer ordering

## T

…

## Z
```

Keep entries to one line each. This file exists so an agent can decide what to load, not to hold the content itself.

The grammar — the thirty-six headings, placement by the filename's first character, sort order within a heading — is in `references/specification.md`; the example above is cut short, a real index has every heading. The skeleton exists so that two branches adding topic files can't collide in the index: a heading line always separates their insertions, however small the list. An existing project with a flat or unsorted index rebuilds it once, mechanically, now rather than next time touched — see `references/migrations.md`.

## Topic file — example shape

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

Not every entry needs every field, but treat the decision as a fork, not a single point: what was chosen, and what specifically was rejected and why. Status, Evidence, and the rejected-alternative are the things worth keeping even in a minimal entry — the rejected alternative especially, since "we chose X" without "we didn't choose Y, because Z" is usually the less useful half of the story. It's what prevents the next person (or agent) from re-deriving or re-breaking the same thing (see Core rule 4 in `SKILL.md`). Status and Evidence are independent (Core rules 2 and 5) — a `superseded` entry can still show `confirmed` for what was true while it was active.

Field definitions — every field, every value, what each means, and the lifecycle between them — are in `references/specification.md`; this file shows how they read in practice.

`open` is easy to reach for the wrong word on — it's a Status, not an Evidence level, and answers a different question than `Evidence: unknown` does. `open` means the entry's central question has no answer yet. `unknown` means a *settled* claim's rationale can't be traced or confirmed. A genuinely open question usually carries both, since there's neither an answer nor a rationale for one:

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

But the two axes stay independent even here: a settled, `active` decision can also carry `Evidence: unknown` (rule 1's case for a claim nobody can currently back up), just as a `superseded` entry can carry `Evidence: confirmed` for what was true while it was active.

Reading `confirmed` as "verified true" is the one misreading worth guarding against: Evidence is about the *origin* of a claim, not whether it holds today — that is what **Verification** and **Revisit when** exist for. A `Type` goes on new entries whenever a value clearly fits, one `**Type:**` line per value that applies; existing entries pick one up the next time they're touched, not through a backfill pass — same principle as "Retrofitting an existing project" below.

**Source** isn't limited to confirmed entries — it's useful at any Evidence level, including documenting where you looked for an entry that ended up `unknown`. **Verification**, when there's something concrete to check a confirmed or inferred claim against, goes the same place Source does:

```markdown
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14
**Verification:** contradicted — the interview said retries max out at 3;
the actual retry loop in `client.py` caps at 5. Flagged for re-confirmation,
not silently corrected either way.
```

**Verification** and **Revisit when** are worth adding once a decision has a concrete trigger for going stale (a dependency, a protocol version, an external constraint that could change) or something concrete to check against. They're not mandatory fields for everything — per the proportionality gate in `SKILL.md`, add them when there's a real answer, not as filler. This is also the mechanism for the "rationale decays" risk named in the README: a **Revisit when** condition gives a future reader (or agent) something concrete to check, rather than just hoping someone remembers to re-verify. What a triggered condition does to `Status`, and what resolving it looks like, is the lifecycle table in `references/specification.md`.

## Retrofitting an existing project

When a project already has documentation that doesn't match this shape:

1. Don't restructure everything at once. Start by adding a `context/` layer next to whatever `docs/` already exists.
2. Migrate content only when touching it anyway, not as a dedicated big-bang pass.
3. If the existing structure is already good (clear, current, distinguishes how from why in some other way), don't replace it just to match this template. Adapt this methodology to it instead — new entries this skill writes there follow its own field set; existing records keep their own format until touched for another reason (item 2) and don't get retro-tagged with `Type`/`Status`/`Evidence` as a setup step.
