# Scope

## Continuous capture and retrospective/interview recovery are both core, not just continuous

**Status:** active
**Confirmed**

The skill covers four modes: continuous capture, retrospective recovery, knowledge-transfer interview, and maintenance. Retrospective recovery and the interview mode are not secondary or optional — they're as central to the pitch as continuous capture.

**Reason:** a narrower framing — "the agent quietly documents rationale as you work," with retrospective analysis of existing/legacy repositories treated as a nice-to-have extension — doesn't cover a real, common scenario: recovering a long-term developer's knowledge from a codebase before they leave or retire. That scenario doesn't fit a "continuous, low-effort, byproduct-of-normal-work" framing at all — it's a deliberate, scoped, higher-effort session. Treating it as equally core, rather than a stretch feature, is what led to the skill having a real interview playbook (`references/interview-playbook.md`) and ownership-signal-based prioritization logic, not just an afterthought paragraph.

**Rejected alternative:** keep retrospective/interview recovery as a secondary, lightly-documented mode, with continuous capture as the sole headline feature. Rejected because the retirement/handover scenario is common enough, and different enough in shape from continuous capture, that treating it as an afterthought would have left the skill without real guidance for one of its most valuable use cases.

**Note on a risk this created and how it was handled:** broadening scope this way could have made the project's positioning read as unfocused. Kept coherent by tying both modes back to the same underlying mechanism — classify evidence as confirmed/inferred/unknown, ask only what evidence can't resolve — rather than treating them as two unrelated features bolted together.

## Complementary practices, not a standalone solution — README included, list treated as open

**Status:** active
**Confirmed**

The README positions Keep the Why as one of several practices (README, `docs/`, tests, Keep a Changelog, Keep the Why) that each answer a different question, none of which substitutes for another. The table is explicitly *not* framed as closed — it names what these five have in common (they combat a codebase becoming inaccessible over time) rather than claiming completeness, and separates that from general OSS hygiene (license, contribution process) which matters for different reasons and isn't part of this specific list.

**Reason:** without this framing, "Keep the Why" alone could be read as a complete anti-legacy solution rather than one piece of one. Michael Feathers' "legacy code = code without tests" definition covers only the Tests row of that table — a project can pass that definition and still be legacy in every practical sense if its rationale is inaccessible.

**README added as a fifth entry in a later pass, same day:** it answers a distinct question — "what is this, should I care" — that neither `docs/` (how do I use it in depth) nor `context/` (why is it built this way) answers; it's the first-contact artifact, not a duplicate of either. Considered and explicitly rejected for this same list: LICENSE and CONTRIBUTING.md — both are real, legitimate project-health artifacts, but they answer legal/process questions, not comprehension questions, so they don't fit this specific "why does the codebase become inaccessible over time" framing.

**Rejected alternative for how to signal open-endedness:** leave the table as-is (rows present, unstated whether more exist) and let readers infer it might not be exhaustive. Rejected in favor of saying so explicitly in prose, because an unstated assumption is exactly the kind of thing this project argues should be written down rather than left implicit.

## The alternatives-fork is a first-class part of the skill's own instructions, not just an optional field

**Status:** active
**Confirmed**

`SKILL.md` Core rule 7 and the "Record" workflow step treat "what was chosen" and "what was rejected, and why" as two mandatory halves of a decision entry, not one optional field in a longer list of things to include when convenient.

**Reason:** an earlier version of `SKILL.md` listed "rejected alternatives" as one item in an "include what's relevant" list — permitted, not actively sought out. That's a weaker guarantee than the project's own positioning implies: a "why" that only explains the chosen path and never asks what else was considered is usually half the story. Rewritten so the workflow asks the agent to look for the rejected side of a decision as a default step, and to say explicitly when nothing else was considered rather than silently omitting the question.

**Rejected alternative:** leave the original loose "include what's relevant" framing and trust that agents applying the skill would naturally include alternatives when they're obviously relevant. Rejected because "obviously relevant" is exactly the kind of judgment call that quietly degrades over many sessions.

## Explicit file-routing guidance added (README vs. docs/ vs. CONTRIBUTING.md vs. context/ vs. CHANGELOG.md)

**Status:** active
**Confirmed**

`references/repository-structure.md` has a "Which file does this belong in?" section, and `SKILL.md`'s Record step points to it. The routing principle: who is the reader, and what do they need to do next (evaluate whether to use this → README; use it → `docs/`; contribute to it → `CONTRIBUTING.md`; understand why before changing something → `context/`; track version history → `CHANGELOG.md`; any agent working in the repo → `AGENTS.md`; this one developer only → `AGENTS.local.md`).

**Reason:** `CONTRIBUTING.md` is a real part of the overall concept — it holds content that belongs there and shouldn't be redundantly re-explained elsewhere — but the skill had no guidance about *when* something belongs in `CONTRIBUTING.md` versus README versus `context/` versus anywhere else. The docs/context split and the AGENTS.md/AGENTS.local.md split were already covered; the broader routing question across the whole file set wasn't.

**Rejected alternative:** treat this as already implicitly covered by the existing docs/context guidance and not add anything new. Rejected because the gap was concrete and demonstrable — nothing in `SKILL.md` or the references said where contributor-facing process content (dev setup, PR conventions) should go versus README or `context/`, so it could plausibly have ended up duplicated across files, the exact failure mode this project exists to prevent elsewhere.

## Session narrative and unrelated private context are out of scope for `context/`

**Status:** active
**Confirmed**

`context/` entries in this repo record objective, technical project rationale — what was decided, what the alternative was, why one won. They don't record who said what, in what words, or reference the maintainer's other, unrelated projects as the origin of a decision, even where that's literally how a decision came about.

**Reason:** an earlier pass of `context/docs-engine.md` and `context/repo-conventions.md` named a specific unrelated private project as the source of the original (later replaced) documentation tooling choice, and several entries quoted conversational messages verbatim. Both leaked information that has nothing to do with this project and wasn't objectively relevant to a future reader trying to understand *this* codebase — it was development-session narrative, not project rationale. Rewritten to state the technical reasoning on its own terms.

**Rejected alternative:** keep the fuller narrative for transparency/authenticity, since it's an accurate record of how the decision actually happened. Rejected because accuracy about the session isn't the same as relevance to the project — Core rule 11 now states this distinction explicitly so it isn't re-learned the same way again.

## `context/naming.md` exists but is excluded from the public site's navigation and build

**Status:** active
**Confirmed**

`context/naming.md` (the naming history: Backstory and Anti-Legacy considered and rejected before Keep the Why) stays in the repository — it's genuine project history and the file-level content is unchanged — but it's excluded from the built site (`mkdocs.yml`'s `exclude_docs`) and removed from the "Why this project is built this way" navigation, rather than published alongside the other context pages.

**Reason:** naming/branding rationale is a different category from the technical "why is the code built this way" content the rest of `context/` covers, and doesn't need to be surfaced in the polished public site the same way. It's still reachable by anyone browsing the repository directly on GitHub — this isn't a deletion, just a decision about what the published site foregrounds.

**Rejected alternative:** delete `context/naming.md` outright, or leave it in the nav unchanged. Neither fit: deleting it would contradict this project's own principle of marking history rather than erasing it (Core rule 8); leaving it in the public nav is what got reconsidered in the first place.
