# Scope

## Continuous capture and retrospective/interview recovery are both core, not just continuous

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

The skill covers four modes: continuous capture, retrospective recovery, knowledge-transfer interview, and maintenance. Retrospective recovery and the interview mode are not secondary or optional — they're as central to the pitch as continuous capture.

**Reason:** early framing of this project (before the skill itself was built) leaned toward "the agent quietly documents rationale as you work" as the core pitch, with retrospective analysis of existing/legacy repositories treated as a nice-to-have extension. The maintainer corrected this directly and gave a concrete motivating scenario: interviewing a long-term developer's knowledge out of a codebase before they retire. That scenario doesn't fit a "continuous, low-effort, byproduct-of-normal-work" framing at all — it's a deliberate, scoped, higher-effort session. Treating it as equally core (rather than a stretch feature) is what led to the skill having a real "interview playbook" (`references/interview-playbook.md`) and ownership-signal-based prioritization logic, not just an afterthought paragraph.

**Note on a risk this created and how it was handled:** broadening scope this way could have made the project's positioning read as unfocused. It was kept coherent by tying both modes back to the same underlying mechanism (classify evidence as confirmed/inferred/unknown; ask only what evidence can't resolve) rather than treating them as two unrelated features bolted together.

## Four complementary practices, not a standalone solution

**Status:** active
**Confirmed**

The README explicitly positions Keep the Why as one of four practices (tests, `docs/`, Keep a Changelog, Keep the Why) that each answer a different question, none of which substitutes for another.

**Reason:** the maintainer asked directly for this framing to be worked in ("für anti legacy concept ist wohl insgesammt wichtig: keep-the-why (context), keep-a-changelog, docs und tests"), after noticing that "Keep the Why" alone could otherwise be read as a complete anti-legacy solution rather than one piece of one. Michael Feathers' "legacy code = code without tests" definition covers only the tests row of that table — a project can pass that definition and still be legacy in every practical sense if its rationale is inaccessible.

**Added during this pass, not originally in the four-practice framing:** none of the four practices keeps itself honest over time on its own — tests get skipped, docs rot, changelogs get forgotten, and rationale decays (cited: a 2026 study found 23% of AI-generated decisions had stale supporting evidence within two months). This was flagged as an open gap rather than silently ignored — the README names it explicitly instead of implying the four practices are sufficient by themselves.
