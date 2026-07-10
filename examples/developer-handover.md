# Example: developer handover (interview mode)

## Situation

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
