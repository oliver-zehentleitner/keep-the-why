# Retrospective analysis

Applying the skill to an existing repository that has little or no rationale documentation — including long-lived "legacy" codebases.

## Don't start by explaining everything

The instinct is to read the codebase and produce a comprehensive-looking write-up of what everything does. Resist this. A confident, complete-looking document that's actually full of inference dressed up as fact is worse than admitting the gaps — it gets trusted and then turns out to be wrong exactly where it mattered.

The actual goal of this mode: **find what the code cannot explain, and be honest about what's confirmed vs. inferred vs. unknown for everything else.**

## Where to look for evidence, in rough priority order

1. **Git history** — commit messages, especially ones referencing a bug, an incident, or a specific reason for a change. `git log -p` and `git blame` on suspicious-looking lines often surface the actual triggering event.
2. **Issue tracker / PR discussions**, if accessible — decisions and rejected alternatives are frequently argued out there and never make it into the code or docs.
3. **Existing docs, however thin** — even a stale README or an old design doc usually has some signal.
4. **The code itself** — comments, naming, structure. Weakest source for *why* (it mostly tells you *what*), but useful for identifying candidates: unusual branches, defensive checks that look unnecessary, magic numbers, seemingly redundant abstractions.
5. **People** — see `interview-playbook.md`. Used when the above doesn't resolve something, not as the first resort.

## Search order isn't trust order

The list above is where to *look* first, not which source to *trust* most when two disagree. A commit message can be wrong or stale; a maintained architecture doc or a maintainer confirming something directly can outweigh a five-year-old commit that no longer reflects reality. Roughly:

- **Discovery** — code, git blame/history, issues: cheap to search, good for finding candidates, weakest as authority.
- **Confirmation** — maintained docs, an accepted decision record, a maintainer stating something directly: what actually settles a "confirmed" label.
- **Conflict handling** — when discovery and confirmation disagree (the code does X, a doc or a person says Y), don't silently pick one. Record both, mark the conflict explicitly, and treat it as an open question rather than resolving it by assumption.

## Building the gap list

Work through the codebase (or the relevant subsystem, if scoping to one) and build a list of candidates: things that look surprising, defensive, redundant, or otherwise unexplained. For each, try to resolve it from evidence sources 1–4 before deciding it needs a question for a human.

Classify every entry — confirmed, inferred, unknown — per the core rules. It's fine, and expected, for a first retrospective pass to leave a nontrivial number of entries as "unknown, needs interview" rather than force an answer.

## Scoping a large or unfamiliar codebase

For a codebase too large to analyze end-to-end in one pass:

- prioritize the areas most likely to cause damage if misunderstood (auth, data integrity, anything touched by a recent incident, anything with unusual/defensive-looking code)
- prioritize areas with low bus factor — code only one contributor seems to understand, or that hasn't been touched in years by anyone still active
- it's fine to document incrementally, subsystem by subsystem, rather than all at once

## Output

Same as continuous mode: topic-organized entries in `context/`, each classified, each linked to its evidence where practical (a commit hash, an issue link, a file reference) so a future reader can verify rather than just trust.

## Confirming before writing

This mode routinely produces several candidate entries from a single pass rather than one at a time. Before writing any of them, the project's `capture-confirmation` setting still applies (automatic, always ask, or only when unclear — see "The confirmation model" in `setup.md`), same as continuous capture. Where `confirmation-flow` applies: `sequential` presents each candidate one at a time and waits for an answer before the next; `batch` presents the whole gap list together as a numbered review. Both are equally valid — respect whichever the developer set, this mode doesn't call for one over the other.
