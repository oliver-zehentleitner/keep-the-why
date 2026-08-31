# Repository structure

Concrete guidance for applying the structure described in `methodology.md`.

## Default layout

```text
project/
├── AGENTS.md
├── AGENTS.local.md          # not committed
├── docs/
│   ├── index.md
│   ├── setup.md
│   ├── usage.md
│   ├── testing.md
│   └── troubleshooting.md
└── context/
    ├── README.md              # short, GitHub renders it when someone browses the folder cold
    ├── index.md
    ├── architecture.md
    ├── <topic>.md            # one per recurring theme, named for the theme, not the file it touches
    └── incidents.md
```

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

This project uses Keep the Why to preserve the reasoning behind its code.

- Usage docs: see `docs/index.md`
- Why things are the way they are: see `context/index.md`
- If `AGENTS.local.md` exists in this repo, read that too — personal/local notes.

Read `context/index.md` before making non-trivial changes to understand
prior decisions and avoid re-litigating or accidentally reverting them.

<!-- keep-the-why:config -->
- context: `context/`
- init: complete
- context-schema: 0.9.2
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

Keep the prose above the config block short. Anything longer belongs in `docs/` or `context/`, not here — `AGENTS.md` needs to stay generic enough for every tool that reads the open AGENTS.md convention, not just this skill. The config block is the exception: it's the skill's own machine-readable state, kept small and clearly delimited on purpose so it doesn't creep into being a second undocumented system living inside a file meant to stay generic. Only project-wide facts live here — personal automation preferences go in `AGENTS.local.md` instead, see below and `setup.md`. `context-schema`, `capture-confirmation`, and `source-reference` are shown here at real, current values rather than omitted — a project's actual config block always has all three, so an example without them would be misleading, not just terse.

## `AGENTS.local.md` — personal config example

```markdown
<!-- keep-the-why:local -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:local -->
```

Not committed. One developer's automation preferences aren't another's — see `setup.md` for why this is split from the project config block instead of living in `AGENTS.md` alongside it. `capture-confirmation` (whether writing needs permission first) is the one setting in this area that's project-wide instead — it lives in `AGENTS.md`'s config block, not here; see "The confirmation model" in `setup.md`.

A `migration-prompt: <version> declined` line can appear here too, but only once a developer has actually said "stop asking me" about a specific `context/` schema migration — it's not part of the default block. Scoped to that one version, not a blanket opt-out; see "Context schema and migrations" in `setup.md`.

## `context/index.md` — example

```markdown
# Context index

- [architecture.md](architecture.md) — why the system is shaped this way
- [compatibility.md](compatibility.md) — why certain old-looking code paths still exist
- [incidents.md](incidents.md) — production incidents and what changed because of them
- [sync.md](sync.md) — synchronization design, snapshot/buffer ordering
```

Keep entries to one line each. This file exists so an agent can decide what to load, not to hold the content itself.

Sort entries alphabetically by filename, and insert new ones in their sorted position rather than appending at the end. Two PRs adding unrelated topic files at the same time then land on different lines instead of both fighting over the last line — the cheapest way to cut down on `index.md` merge conflicts in a repo with concurrent PRs.

An existing project with an unsorted `index.md` should resort it fully, once — see `references/migrations.md`. This isn't the usual "next touched, not a big-bang migration" retrofit rule (below): resorting is mechanical, not per-entry judgment, and the fix doesn't reduce conflicts until the whole list is actually in order.

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

Not every entry needs every field, but treat the decision as a fork, not a single point: what was chosen, and what specifically was rejected and why. Status, Evidence, and the rejected-alternative are the things worth keeping even in a minimal entry — the rejected alternative especially, since "we chose X" without "we didn't choose Y, because Z" is usually the less useful half of the story. It's what prevents the next person (or agent) from re-deriving or re-breaking the same thing (see Core rule 6 in `SKILL.md`). Status and Evidence are independent (Core rules 2 and 7) — a `superseded` entry can still show `confirmed` for what was true while it was active.

**Status** (`active` | `superseded` | `open` | `needs-review`) tracks whether a decision or fact is still current — `active` and `superseded` are the common cases. `open` is for an entry that's a genuinely unresolved question rather than a settled decision: nothing to mark active or superseded yet, only the question and what's known so far. `needs-review` flags something that used to be settled but has a triggered **Revisit when** condition (below) not yet re-checked.

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

**Type** (`decision` | `workaround` | `incident` | `constraint`) categorizes what kind of thing an entry is, independent of Status and Evidence. It exists so a tool or agent can select or filter entries — "every incident," "every workaround" — without loading full topic files to find out, which matters for token cost on a large `context/`. Fill it in on new entries when a value clearly fits — most entries get exactly one `**Type:**` line. An entry that genuinely documents more than one kind of thing (a bundled cleanup note covering a workaround and an unrelated bug fix, or a single fact that's genuinely both) gets one `**Type:**` line per value that applies, rather than picking one or splitting the entry — each line stays exact-`grep`able (`^\*\*Type:\*\* incident`) no matter how many others are present. If none of the four fit, use a single `undefined — <short reason>` line instead of leaving the field blank, so those cases stay `grep`-able as candidates for a future fifth value rather than indistinguishable from entries that never considered Type at all — `undefined` doesn't combine with the other four; it means none of them fit, not some of them. Existing entries pick up a Type the next time they're touched anyway, not through a dedicated backfill pass — same principle as "Retrofitting an existing project" below.

**Source** isn't limited to confirmed entries — it's useful at any Evidence level, including documenting where you looked for an entry that ended up `unknown`. **Verification**, when there's something concrete to check a confirmed or inferred claim against, goes the same place Source does:

```markdown
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03-14
**Verification:** contradicted — the interview said retries max out at 3;
the actual retry loop in `client.py` caps at 5. Flagged for re-confirmation,
not silently corrected either way.
```

**Verification** and **Revisit when** are worth adding once a decision has a concrete trigger for going stale (a dependency, a protocol version, an external constraint that could change) or something concrete to check against. They're not mandatory fields for everything — per the proportionality gate in `SKILL.md`, add them when there's a real answer, not as filler. Evidence itself stays mandatory (Core rule 2) even when Verification and Revisit when aren't needed. This is also the mechanism for the "rationale decays" risk named in the README: a **Revisit when** condition gives a future reader (or agent) something concrete to check, rather than just hoping someone remembers to re-verify. A triggered **Revisit when** sets **Status: needs-review** immediately (Core rule 7) — that flag needs no separate permission, and only that: Evidence doesn't change, and the entry doesn't get superseded or rewritten in the same step; resolving needs-review is a separate, deliberate re-check.

## Retrofitting an existing project

When a project already has documentation that doesn't match this shape:

1. Don't restructure everything at once. Start by adding a `context/` layer next to whatever `docs/` already exists.
2. Migrate content only when touching it anyway, not as a dedicated big-bang pass.
3. If the existing structure is already good (clear, current, distinguishes how from why in some other way), don't replace it just to match this template. Adapt this methodology to it instead.
