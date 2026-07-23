---
name: keep-the-why
description: Preserves or recovers the reasoning behind a codebase - architectural decisions, rejected alternatives, workarounds, incident learnings, operational constraints, and historical context the code itself cannot explain. Use when implementing or reviewing a non-trivial change involving a design decision, workaround, incident fix, operational constraint, rejected alternative, or changed assumption; when documenting an existing or legacy codebase; during onboarding or a maintainer handover; or when interviewing a developer before their knowledge is lost (e.g. before they leave or retire). Identifies what the code cannot explain, asks focused questions instead of generic ones, and maintains concise, topic-based, version-controlled documentation readable by both humans and AI agents.
license: MIT
version: 0.2.0
repository: https://github.com/oliver-zehentleitner/keep-the-why
---

# Keep the Why

The core job: preserve and recover the reasoning that code alone cannot explain. Because "ask Bob" is not documentation — Keep a Changelog records what changed, this preserves why it changed.

## When to use this skill

Four modes, all part of the same job:

1. **Continuous capture** — notice when the current conversation contains rationale worth keeping (a decision, a rejected alternative, a workaround, an incident, a constraint) and record it alongside the code. Includes a change that *didn't* happen: starting to modify or remove something, then stopping after discovering why it shouldn't be touched — that reasoning would otherwise leave no trace at all, since nothing gets committed. See `references/continuous-capture.md`.
2. **Retrospective recovery** — given an existing or legacy repository, find the decisions the code cannot explain by itself, and reconstruct as much as possible from code, git history, issues, and existing docs.
3. **Knowledge-transfer interview** — when a maintainer's knowledge is about to become unavailable, analyze the repository first, then either ask targeted questions about exactly what the code couldn't explain, or — for someone whose knowledge is broad and tacit, e.g. a long-tenured maintainer — let them narrate freely and extract rationale from that instead. See `references/interview-playbook.md` for both techniques.
4. **Maintenance** — keep existing rationale current: resolve contradictions, mark superseded entries, merge duplicates, split files that have grown too large.

**When not to use it:** routine implementation detail, generic formatting or style changes, or anything already fully and obviously explained by the code. Not every change is a decision worth a `context/` entry — see rule 12's proportionality gate.

## Core rules

1. **Never invent rationale.** If it can't be confirmed or reasonably inferred, say so — ask a focused question or mark it unknown, don't fill the gap with something plausible-sounding.
2. Classify every entry's **Evidence**: **confirmed** (stated by a maintainer or backed by authoritative evidence), **inferred** (reasonably derived, not confirmed), or **unknown** (evidence doesn't support an answer). This is a separate axis from Status (rule 7) — a superseded decision can still have been confirmed when it was current; being outdated and being well-evidenced are different questions. Classify at the level of the entry, not every sentence — split out a separate label only when part of an entry genuinely has different evidence than the rest. When a confirmed claim is worth tracing or could plausibly be checked against other evidence, add **Source** (who or what it came from — a maintainer interview, a commit, an issue) and **Verification**: corroborated, uncorroborated, or contradicted. A `contradicted` verification must say what contradicts it and why — the label alone isn't an explanation.
3. Preserve the project's existing terminology and documentation conventions; don't impose a foreign vocabulary.
4. Update existing topic files instead of creating duplicate or near-duplicate documents.
5. Organize knowledge by *topic* (`auth.md`, `sync.md`), not mechanically by source file or by commit.
6. **Treat a decision as having two halves: what was chosen, and what wasn't.** Actively look for the rejected alternative(s) and why they lost — don't just wait for one to surface. If genuinely nothing else was considered, say so explicitly. This doesn't mean manufacturing a comparison against something that was never a real candidate — a rejected alternative worth recording was genuinely in contention, not an earlier mistake corrected before it was ever a real fork. A project's current state can be its own starting point; it doesn't need a history of what it isn't to justify what it is.
7. Track every entry's **Status**, separately from its Evidence: **active**, **superseded**, **open**, or **needs-review**. Mark superseded knowledge explicitly (e.g. `> Superseded 2026-03: see below`) instead of silently deleting project history — status changes as a project evolves, but the evidence for what was true at the time usually doesn't need to change with it.
8. Keep `context/index.md` lean — detailed reasoning lives in topic files, loaded only when relevant. When a topic file grows large enough to be unwieldy, propose a split rather than letting it grow indefinitely.
9. **Privacy and relevance extend beyond obvious secrets.** Don't store credentials, personal information, or private local details in anything meant to be committed — and don't record session narrative (who said what, how a conversation went) either. Never cite a person's other, unrelated projects or private matters as the source of a decision, even if that's literally how it happened — restate the reasoning on its own terms. If an entry only makes sense with that private context attached, make the entry itself more self-contained.
10. Don't commit or publish documentation changes unless the user explicitly asks for it.
11. **Prefer free narration over a scripted question list for broad, tacit knowledge.** Most often a long-tenured maintainer. A question list forces them to guess what's being asked; let them talk first, don't redirect the story, extract decision-forks from what comes up, then close remaining gaps with targeted questions — narration and targeted questions are sequential steps, not a choice between them.
12. **Match documentation depth to how non-obvious a decision actually is.** A self-evident choice ("uses X, the standard convention for Y") is a sentence, not a structured entry with a manufactured rejected-alternatives section. The full decision/alternative/reason structure (rule 6) is for decisions a reader would genuinely ask "why" about — applying it to everything, including the obvious, is the same context bloat rule 8 warns against, just produced one over-long entry at a time. A rough test: "prevents a breaking API change" earns an entry; "formats the code more nicely" doesn't. When it's genuinely unclear which side of that line something falls on, a quick yes/no question is cheap — ask rather than silently guessing either way.

Rules 1–2 matter most. A skill that hallucinates a confident-sounding project history is worse than no documentation — it actively misleads the next reader.

## Workflow

### 0. Setup check

Before anything else, check for two independent config blocks: a project one (`AGENTS.md` or whatever entry-point file it already uses) and a personal one (`AGENTS.local.md`). Missing project block → run the project init wizard. Missing personal block → run the personal preferences wizard, even if the project is already set up — one developer's automation preferences aren't another's. See `references/setup.md` for the exact detection markers, both wizards' questions, and the per-session timer checks (skill updates, `context/` staleness) that follow.

If the timer check finds the update-check interval elapsed: compare the installed `version` (frontmatter above) against the latest release at `repository` (frontmatter above) — don't rely on `references/setup.md` alone for this, the source of truth is right here so the check still works even if that reference file was never loaded. If the check can't run (no web access), don't fail silently forever — say so once and ask whether to keep retrying or turn it off.

Also compare the project config's `context-schema` against the installed `version`. If `context-schema` is behind, check `references/migrations.md` for what changed in between and, if anything applies to existing `context/` entries, discuss with the user whether to migrate now or next session — don't migrate silently, and don't forget to ask again later if deferred. Once caught up (or confirmed nothing applied), advance `context-schema` to match.

### 1. Inspect

Read `AGENTS.md` and existing project documentation before doing anything else. Adapt to conventions already in use — don't create a parallel structure next to one that already works (see `references/repository-structure.md`).

### 2. Locate knowledge gaps

Look for signs that rationale is missing: code that looks surprising, redundant, or defensive; compatibility workarounds; boundaries that don't obviously follow from the domain; rejected alternatives mentioned in commits/issues but not explained in docs; changes clearly driven by an undocumented incident; constraints invisible in the code; areas only one contributor understands; documentation that states *what* but never *why*.

### 3. Classify the evidence

For every candidate, two separate calls: Evidence (confirmed, inferred, or unknown — rule 2) and Status (active, superseded, open, or needs-review — rule 7). Not optional — it's what keeps the output trustworthy.

### 4. Ask, or listen

Default: ask only what the evidence genuinely can't answer, and ask specifically.

- Weak: "Please explain the synchronization component."
- Better: "Why does the sync step wait for the snapshot before applying buffered events?"

Exception: rule 11 — free narration for broad, tacit knowledge. See `references/interview-playbook.md` for both techniques.

### 5. Record

Three checks before writing: is this even worth documenting at this depth (rule 12)? Which file does it actually belong in — `context/` isn't the only place project knowledge lives, see "Which file does this belong in?" in `references/repository-structure.md`? Does it pass the privacy/relevance filter (rule 9)?

For decisions that clear those checks, write concise, topic-oriented documentation answering the fork (rule 6), not just the outcome. Three fields carry the weight:

- **decision or behavior** — what was actually done
- **alternative(s) considered, and why each was rejected** — even a one-liner beats silence
- **reason the chosen path won**

Include when relevant, not as a fixed template: context, constraints, consequences and failure modes, current status, evidence or related files for traceability.

### 6. Maintain

Update existing topics rather than accumulating new ones, resolve contradictions when found, mark superseded information instead of deleting it, split files once they get large. This is what keeps the system *living* instead of another pile of stale docs no one trusts.

## Target repository structure

Adapt to what a project already has. Where nothing suitable exists yet, propose:

```text
project/
├── AGENTS.md          # lean entry point: pointers only, not the content itself
├── AGENTS.local.md     # personal/local notes, not committed
├── docs/                # HOW to use, operate, test, deploy — human-facing, agent-readable too
│   └── index.md
└── context/             # WHY the project is the way it is
    ├── README.md        # short, for anyone landing here cold (GitHub renders it automatically)
    ├── index.md         # lean index — the load-bearing file for keeping agent context efficient
    ├── architecture.md
    └── ...               # one file per topic, not per source file, not per decision
```

- `AGENTS.md` stays short and generic, compatible with the wider AGENTS.md ecosystem — not the whole system.
- `docs/` and `context/` are read directly by humans and agents alike — no separate AI-only copy.
- `AGENTS.local.md` is the default location for anything personal or local; a tool-specific file (`CLAUDE.md`, `CODEX.md`, ...) should only exist for content genuinely exclusive to one tool, which in practice is rare.
- This diagram isn't the whole picture — a project also has (or should have) a `README.md`, usually `CONTRIBUTING.md`, often a separate `CHANGELOG.md`. This skill doesn't generate those, but recording something in `context/` that belongs in one of them is a routing mistake, not a stylistic choice.

Full rationale: `references/methodology.md`. Concrete layout: `references/repository-structure.md`.

## Reference files

Load these only when the situation calls for them — keep this file lean:

- `references/setup.md` — first activation in a project: detecting whether it's already set up, running the init wizard, and the per-session timer checks afterward.
- `references/migrations.md` — when `context-schema` is behind the installed version: what changed and how to bring existing `context/` entries up to date.
- `references/methodology.md` — reasoning behind the docs/context split and the index+topic-files structure.
- `references/repository-structure.md` — before introducing or restructuring a documentation layout.
- `references/continuous-capture.md` — deciding what's worth capturing during normal development.
- `references/retrospective-analysis.md` — applying this skill to an existing or legacy repository.
- `references/interview-playbook.md` — preparing or conducting a knowledge-transfer interview.

## What this skill is not

- Not a guarantee. Quality depends on what gets captured and how disciplined that stays over time — nothing here is enforced the way a compiler or a container runtime enforces correctness.
- Not a replacement for tests. Tests tell you when you broke something; this tells you why it was built that way. Complementary, not substitutes.
- Not a claim that every piece of lost knowledge is recoverable. The honest answer for some things is "unknown," not a confident guess.
