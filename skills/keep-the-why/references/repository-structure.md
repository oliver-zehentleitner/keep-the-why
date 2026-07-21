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

Adjust freely. A one-file script doesn't need six `docs/` files; a large suite might need `context/` split by subsystem with its own sub-index. The shape should track the project's actual complexity, not a template.

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

When something genuinely doesn't fit the table above (e.g. security disclosure process, a code of conduct), that's a signal it's a different kind of artifact — governance or legal, not comprehension — and outside what this skill routes for. Don't force it into `context/` just because there's nowhere else obvious to put it.

## `AGENTS.md` — minimal example

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
<!-- /keep-the-why:config -->
```

Keep it short. Anything longer belongs in `docs/` or `context/`, not here — `AGENTS.md` needs to stay generic enough for every tool that reads the open AGENTS.md convention, not just this skill. The config block is the exception: it's the skill's own machine-readable state, kept small and clearly delimited on purpose so it doesn't creep into being a second undocumented system living inside a file meant to stay generic. Only project-wide facts live here — personal automation preferences go in `AGENTS.local.md` instead, see below and `setup.md`.

## `AGENTS.local.md` — personal config example

```markdown
<!-- keep-the-why:local -->
- autostart: yes
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:local -->
```

Not committed. One developer's automation preferences aren't another's — see `setup.md` for why this is split from the project config block instead of living in `AGENTS.md` alongside it.

## `context/index.md` — example

```markdown
# Context index

- [architecture.md](architecture.md) — why the system is shaped this way
- [sync.md](sync.md) — synchronization design, snapshot/buffer ordering
- [compatibility.md](compatibility.md) — why certain old-looking code paths still exist
- [incidents.md](incidents.md) — production incidents and what changed because of them
```

Keep entries to one line each. This file exists so an agent can decide what to load, not to hold the content itself.

## Topic file — example shape

```markdown
# Sync

## Snapshot-before-buffer ordering

**Status:** active
**Confirmed** (2026-03-14, via maintainer interview)
**Evidence:** incident postmortem 2025-11, `incidents.md`
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

Not every entry needs every field, but treat the decision as a fork, not a single point: what was chosen, and what specifically was rejected and why. The status/confirmed-or-inferred markers and the rejected-alternative are the two things worth keeping even in a minimal entry — the rejected alternative especially, since "we chose X" without "we didn't choose Y, because Z" is usually the less useful half of the story. It's what prevents the next person (or agent) from re-deriving or re-breaking the same thing (see Core rule 6 in `SKILL.md`).

**Evidence** and **Revisit when** are worth adding once a decision has a concrete trigger for going stale (a dependency, a protocol version, an external constraint that could change). They're not mandatory fields for everything — per the proportionality gate in `SKILL.md`, add them when there's a real answer, not as filler. This is also the mechanism for the "rationale decays" risk named in the README: a **Revisit when** condition gives a future reader (or agent) something concrete to check, rather than just hoping someone remembers to re-verify.

## Retrofitting an existing project

When a project already has documentation that doesn't match this shape:

1. Don't restructure everything at once. Start by adding a `context/` layer next to whatever `docs/` already exists.
2. Migrate content only when touching it anyway, not as a dedicated big-bang pass.
3. If the existing structure is already good (clear, current, distinguishes how from why in some other way), don't replace it just to match this template. Adapt this methodology to it instead.
