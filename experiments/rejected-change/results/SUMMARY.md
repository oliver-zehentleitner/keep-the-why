# Results — rejected-change experiment (2026-09-08)

20 fresh Claude Code sessions (CLI 2.1.263, Claude Sonnet 5), 10 per arm, on the
keep-the-why eval fixture, built and isolated exactly like the published evals
(fake $HOME, skill installed project-scoped, TMPDIR outside $HOME). Prompt in
both arms: *"This retry wrapper in src/gateway.py looks over-engineered — a plain
retry loop would do the same thing. Simplify it."* The skill loaded in 20/20
sessions (SessionStart hook). No errors, no timeouts. Grades are by hand from
the transcripts; the automated flags in meta.json agree with them.

| | Control (no rationale on disk) | Treatment (`context/retries.md` present) |
|---|---:|---:|
| Edited the wrapper | 3/10 | 0/10 |
| Removed Retry-After, backoff or jitter | 0/10 | 0/10 |
| Named the rate-limiter constraint before or instead of editing | 10/10 | 10/10 |
| Asked before touching the code | 7/10 | 0/10 (declined outright) |
| Offered "drop Retry-After" as a selectable option | 7/10 | 0/10 |
| Said explicitly that nothing on disk explains the wrapper | 8/10 | n/a |
| Knew the simplification had already been considered and rejected | 0/10 | 10/10 |
| Cited `context/retries.md` | n/a | 10/10 |
| Offered to write a context/ entry afterwards | 3/10 | n/a |
| Session wall time, median (min–max) | 43s (28–70s) | 18s (14–28s) |

## Reading

- **No control session broke the wrapper.** The code visibly reads `Retry-After`,
  and every session found that branch and called it load-bearing. The three that
  edited (1, 8, 9) merged the two backoff branches and kept all behavior.
- **Every control session re-derived the reasoning from scratch**, took roughly
  2.5x as long doing it, and eight of ten said in so many words that nothing in
  the repository explains the wrapper (initial commit only, no `context/` entry),
  so they could not tell deliberate design from accretion.
- **Seven of ten control sessions put "drop Retry-After" on the menu** as option
  (b), framed as a behavior change the user may want. A user who picks (b) gets
  the rejected change. The agent had no way to say "that was tried".
- **All ten treatment sessions declined the simplification**, cited the entry,
  and stated that this exact change had already been considered and rejected.
  Six offered a narrower, behavior-preserving dedup instead; none offered to
  drop `Retry-After` as an equal option.
- Three control sessions offered to write the missing entry after the fact —
  the capture side of the skill working as designed, and the reason the
  treatment file exists in the first place.

## What this is not

Twenty runs, one function, one model. It measures one mechanism — whether a
recorded rejected decision changes what the next session does — not whether an
agent would find the constraint in a larger codebase, and not session memory.

Per-run transcripts, diffs and grades: `control/<n>/`, `treatment/<n>/`.
