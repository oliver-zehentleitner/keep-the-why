---
name: keep-the-why
description: Use this skill to preserve or recover the reasoning behind a codebase - architectural decisions, rejected alternatives, workarounds, incident learnings, operational constraints, and historical context that the code itself cannot explain. Apply it continuously while making changes during normal development, when documenting an existing or legacy codebase, during onboarding or a maintainer handover, and when interviewing a developer before their knowledge is lost (e.g. before they leave or retire). The skill identifies what the code cannot explain, asks focused questions instead of generic ones, and maintains concise, topic-based, version-controlled documentation that both humans and AI agents can read.
license: MIT
---

# Keep the Why

Because "ask Bob" is not documentation.

Keep a Changelog records what changed. Keep the Why preserves why it changed.

The core job: **preserve and recover the reasoning that code alone cannot explain.**

## When to use this skill

Four modes, all part of the same job:

1. **Continuous capture** — during normal development, notice when the current conversation contains rationale worth keeping (a decision, a rejected alternative, a workaround, an incident, a constraint) and record it alongside the code.
2. **Retrospective recovery** — given an existing or legacy repository, find the decisions the code cannot explain by itself, and reconstruct as much as possible from code, git history, issues, and existing docs.
3. **Knowledge-transfer interview** — when a maintainer's knowledge is about to become unavailable (leaving, retiring, changing teams), analyze the repository first, then ask that person specifically about the gaps analysis couldn't fill.
4. **Maintenance** — keep existing rationale documentation current: resolve contradictions, mark superseded entries, merge duplicates, split files that have grown too large for efficient agent context loading.

## Core rules

1. **Never invent rationale.** If it can't be confirmed or reasonably inferred, say so — don't fill the gap with something plausible-sounding.
2. Always distinguish **confirmed** (stated by a maintainer or backed by authoritative evidence) from **inferred** (reasonably derived, not confirmed) from **unknown** (evidence doesn't support an answer). Label every non-trivial claim.
3. Ask focused questions when evidence can't explain *why* — never pad the gap with invented plausible-sounding reasoning.
4. Preserve the project's existing terminology and documentation conventions; don't impose a foreign vocabulary.
5. Update existing topic files instead of creating duplicate or near-duplicate documents.
6. Organize knowledge by *topic* (e.g. `auth.md`, `sync.md`), not mechanically by source file or by commit.
7. **Treat a decision as having two halves: what was chosen, and what wasn't.** A "why" that only explains the chosen path is usually half the story. When recording a decision, actively look for the rejected alternative(s) and why they lost — don't just wait for one to surface on its own. If genuinely nothing else was considered, say that explicitly rather than silently omitting the question. This doesn't mean manufacturing a comparison against something that was never a real candidate — a rejected alternative worth recording is one that was genuinely in contention, not an earlier mistake corrected before it was ever a real fork in the road. A project's current state can be its own starting point; it doesn't need a history of what it isn't to justify what it is.
8. Mark superseded knowledge explicitly (e.g. a `> Superseded 2026-03: see below` note) instead of silently deleting project history.
9. Keep the index lean. Detailed reasoning lives in topic files that get loaded only when relevant — the index itself should stay small enough to not bloat every agent session's context window.
10. When a topic file grows large enough to be unwieldy, say so and propose a split — don't let it grow indefinitely.
11. **Don't store secrets, credentials, personal information, or private local details in anything meant to be committed — and this extends to session narrative, not just obvious secrets.** Record the objective technical reasoning behind a decision, not a transcript of who said what or how the conversation went. Never cite a person's other, unrelated projects, employer, or private matters as the source of a decision, even if that is literally how it happened — restate the reasoning on its own terms instead. If a decision only seems to make sense with that private context attached, that's a signal the entry itself needs to be made more self-contained, not that the private context should be included anyway.
12. Don't commit or publish documentation changes unless the user explicitly asks for it.
13. Prefer a small, useful update over a speculative or exhaustive rewrite.

Rules 1–3 matter most. A skill that hallucinates a confident-sounding project history is worse than no documentation at all — it actively misleads the next reader (human or agent).

## Workflow

### 1. Inspect

Read `AGENTS.md` and any existing project documentation before doing anything else. Identify the conventions already in use. Don't create a parallel structure next to one that already works — adapt to what's there (see `references/repository-structure.md`).

### 2. Locate knowledge gaps

Look for signs that rationale is missing:

- code that looks surprising, redundant, or unnecessarily defensive
- compatibility workarounds
- boundaries or abstractions that don't obviously follow from the domain
- rejected alternatives mentioned in commits, issues, or PR discussions but not explained in docs
- changes clearly driven by an incident, without the incident being documented
- constraints that are operational or business-driven and invisible in the code itself
- areas only one contributor seems to understand
- documentation that states *what* but never *why*

### 3. Classify the evidence

For every candidate piece of knowledge: is it confirmed, inferred, unknown, or superseded? See rule 2. This classification is not optional — it's what keeps the output trustworthy.

### 4. Ask (when in interview or retrospective mode)

Only ask what the evidence genuinely can't answer. Ask specifically, not generically.

- Weak: "Please explain the synchronization component."
- Better: "Why does the sync step wait for the snapshot before applying buffered events?"

A generic questionnaire produces generic, low-value answers. A targeted question — grounded in something specific the agent already found and couldn't explain — gets the actual reasoning. See `references/interview-playbook.md`.

### 5. Record

Before writing anything, resolve *which file* it actually belongs in — `context/` is not the only place project knowledge lives, and duplicating something already covered by the README, `docs/`, or `CONTRIBUTING.md` creates the same staleness risk this skill exists to avoid. See "Which file does this belong in?" in `references/repository-structure.md` when it's not obvious. Most of what this skill records belongs in `context/`, but not all of it does.

Also apply Core rule 11's filter here: is this objectively relevant to understanding the project, or is it session/process narrative that happens to explain how the decision came about? Write the former; leave the latter out even if it's the more complete story of how the conversation actually went.

Write or update concise, topic-oriented documentation. Every entry should answer the fork, not just state the outcome — see Core rule 7. Three fields are core, not optional extras:

- **decision or behavior** — what was actually done
- **alternative(s) considered, and why each was rejected** — even a one-line "X was considered but dropped because Y" is worth more than silence
- **reason the chosen path won**

Include the rest when relevant, not as a fixed template applied everywhere:

- context / the problem being solved
- constraints
- consequences and failure modes
- current status (active / superseded)
- evidence or related files, for traceability

### 6. Maintain

Don't treat documentation as finished. Update existing topics rather than accumulating new ones, resolve contradictions when found, mark superseded information instead of deleting it, and split files once they get large. This is what keeps the system *living* instead of turning into another pile of stale docs no one trusts.

## Target repository structure

Adapt to what a project already has. Where nothing suitable exists yet, propose:

```text
project/
├── AGENTS.md          # lean entry point: pointers only, not the content itself
├── AGENTS.local.md     # personal/local notes, not committed
├── docs/                # HOW to use, operate, test, deploy — human-facing, agent-readable too
│   └── index.md
└── context/             # WHY the project is the way it is
    ├── index.md         # lean index — the load-bearing file for keeping agent context efficient
    ├── architecture.md
    └── ...               # one file per topic, not per source file, not per decision
```

- `AGENTS.md` stays short and generic, compatible with the wider AGENTS.md ecosystem — it should not become the whole system.
- `docs/` and `context/` are read directly by humans and agents alike — no separate AI-only copy.
- `AGENTS.local.md` is the default location for anything personal or local; a tool-specific file (`CLAUDE.md`, `CODEX.md`, ...) should only exist for content genuinely exclusive to one tool, which in practice is rare.
- This diagram isn't the whole picture — a project also has (or should have) a `README.md`, usually a `CONTRIBUTING.md`, and often a separate `CHANGELOG.md`. This skill doesn't generate those, but recording something in `context/` that actually belongs in one of them is a routing mistake, not a stylistic choice. See `references/repository-structure.md`.

Full rationale for this shape: `references/methodology.md`. Concrete file layout guidance: `references/repository-structure.md`.

## Reference files

Load these only when the situation calls for them — keep this file itself lean:

- Read `references/methodology.md` for the reasoning behind the docs/context split and the index+topic-files structure.
- Read `references/repository-structure.md` before introducing a new documentation layout, or before restructuring an existing one.
- Read `references/continuous-capture.md` when working through normal development and deciding what's worth capturing.
- Read `references/retrospective-analysis.md` when applying this skill to an existing or legacy repository.
- Read `references/interview-playbook.md` when preparing or conducting a knowledge-transfer interview.

## What this skill is not

- Not a guarantee. Documentation quality still depends on what gets captured and how disciplined that stays over time — nothing here is enforced the way a compiler or a container runtime enforces correctness.
- Not a replacement for tests. Tests are how you know you broke something; this is how you know *why* it was built that way in the first place. Both matter, they're complementary, not substitutes.
- Not a claim that every piece of lost knowledge is recoverable. Some things really are gone. The honest answer in that case is "unknown," not a confident guess.
