# Scope

## Continuous capture and retrospective/interview recovery are both core, not just continuous

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

The skill covers four modes: continuous capture, retrospective recovery, knowledge-transfer interview, and maintenance. Retrospective recovery and the interview mode are not secondary or optional — they're as central to the pitch as continuous capture.

**Reason:** early framing of this project (before the skill itself was built) leaned toward "the agent quietly documents rationale as you work" as the core pitch, with retrospective analysis of existing/legacy repositories treated as a nice-to-have extension. The maintainer corrected this directly and gave a concrete motivating scenario: interviewing a long-term developer's knowledge out of a codebase before they retire. That scenario doesn't fit a "continuous, low-effort, byproduct-of-normal-work" framing at all — it's a deliberate, scoped, higher-effort session. Treating it as equally core (rather than a stretch feature) is what led to the skill having a real "interview playbook" (`references/interview-playbook.md`) and ownership-signal-based prioritization logic, not just an afterthought paragraph.

**Note on a risk this created and how it was handled:** broadening scope this way could have made the project's positioning read as unfocused. It was kept coherent by tying both modes back to the same underlying mechanism (classify evidence as confirmed/inferred/unknown; ask only what evidence can't resolve) rather than treating them as two unrelated features bolted together.

## Complementary practices, not a standalone solution — README included, list treated as open

**Status:** active
**Confirmed**

The README positions Keep the Why as one of several practices (README, `docs/`, tests, Keep a Changelog, Keep the Why) that each answer a different question, none of which substitutes for another. The table is explicitly *not* framed as closed — it names what these five have in common (they combat a codebase becoming inaccessible over time) rather than claiming completeness, and separates that from general OSS hygiene (license, contribution process) which matters for different reasons and isn't part of this specific list.

**Reason:** the maintainer asked directly for this framing to be worked in ("für anti legacy concept ist wohl insgesammt wichtig: keep-the-why (context), keep-a-changelog, docs und tests"), after noticing that "Keep the Why" alone could otherwise be read as a complete anti-legacy solution rather than one piece of one. Michael Feathers' "legacy code = code without tests" definition covers only the Tests row of that table — a project can pass that definition and still be legacy in every practical sense if its rationale is inaccessible.

**README added as a fifth entry in a later pass**, same day: the maintainer asked to keep watching for anything else that belongs in the list ("halt die augen offen, ob da noch dinge dazu gehören"). README was added because it answers a distinct question — "what is this, should I care" — that neither `docs/` (how do I use it in depth) nor `context/` (why is it built this way) answers; it's the first-contact artifact, not a duplicate of either. Considered and explicitly rejected for this same list: LICENSE and CONTRIBUTING.md — both are real, legitimate project-health artifacts, but they answer legal/process questions, not comprehension questions, so they don't fit *this* specific "why does the codebase become inaccessible over time" framing. Kept the list open rather than declaring it final.

**Rejected alternative for how to signal open-endedness:** could have left the table exactly as-is (four rows, unstated whether more exist) and let readers infer it might not be exhaustive. Rejected in favor of saying so explicitly in prose, because an unstated assumption is exactly the kind of thing this project argues should be written down rather than left implicit.

## The alternatives-fork is now a first-class part of the skill's own instructions, not just an optional field

**Status:** active
**Confirmed**

`SKILL.md` Core rule 7 and the "Record" workflow step were rewritten to treat "what was chosen" and "what was rejected, and why" as two mandatory halves of a decision entry, not one optional field in a longer list of things to include when convenient.

**Reason:** the maintainer, mid-discussion about a possible logo concept (a stylized "Y" as a fork — two branches for the alternatives, one trunk for the resulting code), redirected the conversation to ask specifically whether the skill's own instructions actually enforced capturing alternatives this way, or whether that was left as one bullet among many that could easily be skipped. Checking the actual `SKILL.md` text confirmed the latter: "rejected alternatives" was listed as one item in an "include what's relevant" list, not something actively sought out. Rewritten so the workflow now asks the agent to look for the rejected side of a decision as a default step, and to say explicitly when nothing else was considered rather than silently omitting the question.

**Rejected alternative:** leave the existing loose "include what's relevant" framing and trust that agents applying the skill would naturally include alternatives when they're obviously relevant. Rejected because "obviously relevant" is exactly the kind of judgment call that quietly degrades over many sessions — the same failure mode the maintainer flagged when asking whether the instruction actually existed in the first place, rather than assuming it did.
