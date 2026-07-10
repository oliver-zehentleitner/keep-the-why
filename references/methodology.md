# Methodology

## Scope: one of several practices, not a replacement for the others

Keep the Why only covers the "why" layer. It deliberately doesn't try to replace a README (what is this, should I care?), tests (did this change break something?), usage docs (how do I run/operate this?), or [Keep a Changelog](https://keepachangelog.com/) (what changed, release by release?) — see the README's "Where this fits" table. A project that adopts Keep the Why but drops its test suite hasn't gotten less legacy, just legacy in a different dimension. Keep the reasoning below scoped accordingly: it's about the `docs`/`context` split specifically, not documentation strategy in general.

## Two layers: docs vs. context

Most projects that document anything at all conflate two different jobs:

- **How do I use this?** — setup, operation, APIs, testing, deployment, troubleshooting.
- **Why is this the way it is?** — architecture rationale, rejected alternatives, incidents, constraints, history.

Keep the Why keeps these as two separate top-level layers, `docs/` and `context/`, rather than mixing them into one undifferentiated `docs/` folder or scattering rationale across code comments and commit messages where it's practically unsearchable.

This maps onto the [Diataxis](https://diataxis.fr/) framework: `docs/` covers how-to and reference material, `context/` covers explanation. Diataxis is an established, well-regarded approach to technical documentation — Keep the Why doesn't reinvent documentation theory, it applies an existing one specifically to the "why" layer that most projects skip entirely.

Both layers are written in plain Markdown, readable by humans and agents alike. There is no separate AI-only copy — an agent reading `context/sync.md` sees exactly what a human reading it in a browser or editor sees. Duplicating content for "the AI's benefit" would just be another thing to keep in sync and let drift.

## Why topic files, not a shadow tree or one-file-per-decision

Two structures are common in prior art for rationale capture, and both have a real weakness:

- **Shadow tree** (one rationale file mirroring each source file, e.g. `.why/src/auth.py.md`): ties documentation structure to file structure, which changes for reasons that have nothing to do with rationale (refactors, renames, file splits). It also fragments a single decision across many files if that decision touched multiple source files.
- **One file per decision** (classic ADR style, `0001-use-postgres.md`, `0002-...`): works well for a handful of major, discrete, one-time architecture decisions. It works poorly for the much larger volume of smaller "why is this weird-looking thing here" knowledge that accumulates over a project's life, and it encourages treating each entry as frozen once written, which is wrong — reasoning can be revisited, appended to, and superseded.

Keep the Why organizes `context/` by **topic** instead: `auth.md`, `sync.md`, `compatibility.md`, `incidents.md` — whatever topics the project actually has. A topic file accumulates related rationale over the project's life and gets updated, not re-created, as understanding deepens or circumstances change. Superseded entries are marked, not deleted — the history of "we used to think X, then Y happened, now we do Z" is itself valuable and often exactly what a new maintainer needs.

## Why the index matters: context-engineering, not just navigation

A project with years of accumulated rationale can easily produce more `context/` content than fits comfortably in an agent's context window. Most documentation-structure advice treats this as a human-navigation problem (a table of contents, a search bar). It's equally a **retrieval problem for the agent itself**: loading everything, every time, wastes context budget on material that's irrelevant to the task at hand.

`context/index.md` is therefore not just a directory listing — it's the file that lets an agent (or a human) figure out *which* topic file is relevant before loading it, and skip the rest. Keeping this index lean and accurate is part of the skill's ongoing maintenance job (see Core rule 9), not a one-time setup step.

## Self-monitoring: react to bloat, don't just accumulate

A topic file that keeps growing eventually stops being useful — both for a human skimming it and for an agent loading it into context. Part of Keep the Why's maintenance job is noticing this and proposing a split (e.g. `sync.md` growing large enough to warrant `sync-initial-load.md` and `sync-incremental-updates.md`) rather than letting any single file become the new bottleneck. No fixed size threshold is prescribed — this is a judgment call based on whether the file is still easy to scan and load efficiently.

## The AGENTS.md / AGENTS.local.md boundary

`AGENTS.md` is a cross-tool, cross-vendor open convention (agents.md), read by many different coding agents. Keep the Why treats it as a **lean entry point only** — a short pointer into `docs/` and `context/`, not the system itself. Stuffing the whole methodology into `AGENTS.md` would make it incompatible with everything else that expects `AGENTS.md` to stay short and generic.

`AGENTS.local.md` is the counterpart for anything personal, local, or not meant to be shared: individual environment quirks, private paths, personal workflow preferences. It is not committed. A tool-specific file (`CLAUDE.md`, `CODEX.md`, etc.) should be the exception, reserved only for content genuinely exclusive to one specific tool — in practice this is rare, and `AGENTS.local.md` should be the default.

## What this deliberately does not prescribe

Different projects need different depth: a small script and a multi-repo suite don't need the same structure. Keep the Why adapts to what a project already has rather than replacing a working structure with a fixed template. The three-tier shape (`AGENTS.md` / `docs`+`context` / `AGENTS.local.md`) is a default to reach for when nothing better already exists, not a mandate.
