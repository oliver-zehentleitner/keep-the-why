# Example: developer handover (interview mode)

Two variants of the same mode, depending on the knowledge holder and how they communicate best — see "Two techniques" in `references/interview-playbook.md`.

## Variant A: targeted questions

**User:** "Our lead developer retires next month. Prepare an interview based on the areas of the repository only she understands."

## What the skill does

1. Runs retrospective analysis first (see `references/retrospective-analysis.md`) to build a gap list for the repository, or the relevant subsystems if scoped.
2. Cross-references the gap list against ownership signals — `git blame`/`git log --author`, commit frequency by area — to identify which gaps are specifically things this one person is likely to know and no one else has touched.
3. Prioritizes that intersection by risk and decision weight (see `references/interview-playbook.md`), producing a short, concrete question list instead of a generic "walk me through the system" request. Example output:

    ```markdown
    ## Interview prep: <name>, retiring 2026-08

    Priority 1 (high risk, exclusive knowledge):
    - Why does the billing reconciliation job run before the nightly
      export instead of after? (No commit explains the ordering; code
      comment says "must run first" with no reason given.)
    - The `LEGACY_CUSTOMER_IDS` allowlist in `billing/exceptions.py` —
      what determines membership, and is it still needed?

    Priority 2 (moderate risk):
    - The retry backoff in `sync/client.py` uses a nonstandard curve
      (not exponential). Deliberate, or historical accident?

    Priority 3 (nice to have, lower urgency):
    - ...
    ```

4. After the interview, updates the relevant `context/` topic files with confirmed answers, and leaves any unanswered items visibly marked as still open, rather than dropping them.

## What it doesn't do

- Doesn't ask the retiring developer to re-explain things already clear from the code — that wastes limited time.
- Doesn't treat the interview as a one-shot dump; if scope is large, it's fine to prioritize and accept that lower-priority items may not get covered before the deadline.

## Variant B: free narration

**Situation:** a developer has maintained a core system — say, 15 years on the same banking backend, built in the 90s — for their entire tenure. Their knowledge is broad, tacit, and not organized around specific gaps; a targeted question list would force them to guess what's being asked about instead of just telling what they know.

**User:** "She's willing to just sit down and talk through the system for a couple of hours. Capture what comes up."

## What the skill does

1. Still runs retrospective analysis first, but uses the gap list to prioritize and cross-check afterward, not to script the conversation.
2. Opens with an invitation, not a question: "Tell me about this system — start wherever makes sense to you."
3. Lets the conversation run without redirecting it toward the gap list. A tangent about a payment format from a system that was decommissioned a decade ago might be exactly where the rationale for a still-active workaround surfaces.
4. Extracts decision-forks as they come up in the narration — what was tried, what was chosen, what was rejected, why — using the normal `context/` entry structure, not a transcript.
5. Asks a clarifying follow-up only to pin down something ambiguous or confirm a claim, not to steer the story back to a prepared agenda.
6. After the session, checks the gap list against what got covered. Anything still open becomes a short, targeted follow-up — Variant A's approach, applied to what's left — rather than another open-ended session.

## What it doesn't do

- Doesn't interrupt every few minutes to redirect toward "more relevant" topics — that's exactly the instinct that suppresses the tangents where tacit knowledge tends to surface.
- Doesn't skip the gap-list cross-check afterward just because the conversation felt thorough; free narration reliably covers some things well and misses others, same as any interview technique.
- Doesn't produce a single giant "transcript" topic file — extracted content still gets routed into the normal topic-organized `context/` structure, same as any other capture.
