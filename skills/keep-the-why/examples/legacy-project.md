# Example: legacy project (retrospective mode)

## Situation

**User:** "Analyze this 15-year-old service and help me document it."

## What the skill does not do

Does not immediately produce a confident-sounding architecture overview covering the whole system. That would mostly be inference dressed up as fact, for a codebase this old and undocumented — misleading rather than helpful.

## What it does

1. Scopes the pass: given the size, prioritizes areas with the highest risk if misunderstood (auth, payment handling, anything with unusually defensive-looking code) rather than attempting full coverage in one session.
2. Works through `retrospective-analysis.md`'s evidence order — git history first, then any old docs, then the code itself — building a gap list.
3. Produces an initial `context/` structure with what it found, explicitly marked:

    ```markdown
    ## Session handling

    **Status:** active
    **Inferred** (from code structure and a 2019 commit message referencing
    "the mobile client issue" — original ticket not accessible)

    Sessions appear to be validated twice: once at the gateway, once in
    the service itself. This looks redundant.

    **Unknown:** whether the double validation is still necessary or is a
    leftover from a since-resolved mobile client bug. A 2019 commit message
    mentions "the mobile client issue" without detail. Needs confirmation
    from someone who worked on this before it can be simplified safely.
    ```

4. Ends the pass with a visible list of open/unknown items, not a false sense of completeness — and flags that some of these are strong candidates for a knowledge-transfer interview if anyone who worked on the original system is still reachable.

## Why this matters

A retrospective pass that confidently explains everything it *thinks* it understands, without marking the difference between confirmed and inferred, actively creates a new kind of legacy problem: documentation nobody double-checks because it looks authoritative, until someone acts on a wrong inference.
