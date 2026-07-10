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
    ├── index.md
    ├── architecture.md
    ├── <topic>.md            # one per recurring theme, named for the theme, not the file it touches
    └── incidents.md
```

Adjust freely. A one-file script doesn't need six `docs/` files; a large suite might need `context/` split by subsystem with its own sub-index. The shape should track the project's actual complexity, not a template.

## `AGENTS.md` — minimal example

```markdown
# AGENTS.md

This project uses Keep the Why to preserve the reasoning behind its code.

- Usage docs: see `docs/index.md`
- Why things are the way they are: see `context/index.md`

Read `context/index.md` before making non-trivial changes to understand
prior decisions and avoid re-litigating or accidentally reverting them.
```

Keep it short. Anything longer belongs in `docs/` or `context/`, not here — `AGENTS.md` needs to stay generic enough for every tool that reads the open AGENTS.md convention, not just this skill.

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

Not every entry needs every field — use what's relevant. The status/confirmed-or-inferred markers and the rejected-alternative are the two things worth keeping even in a minimal entry, since they're what prevents the next person (or agent) from re-deriving or re-breaking the same thing.

## Retrofitting an existing project

When a project already has documentation that doesn't match this shape:

1. Don't restructure everything at once. Start by adding a `context/` layer next to whatever `docs/` already exists.
2. Migrate content only when touching it anyway, not as a dedicated big-bang pass.
3. If the existing structure is already good (clear, current, distinguishes how from why in some other way), don't replace it just to match this template. Adapt this methodology to it instead.
