# Setup

How the skill detects whether a project is already set up, runs the one-time init wizard when it isn't, and what happens on every session afterward.

## Two config blocks, two different scopes

Setup state splits across two files, matching the existing `AGENTS.md`/`AGENTS.local.md` boundary (see `methodology.md`): what's true about the *project* versus what's a personal workflow choice.

**Project config**, in the entry-point file (`AGENTS.md` by default, or whatever tool-specific file the project already uses instead, e.g. `CLAUDE.md`), committed, shared by everyone:

```markdown
<!-- keep-the-why:config -->
- context: `context/`
- init: complete
<!-- /keep-the-why:config -->
```

**Personal config**, in `AGENTS.local.md`, not committed, one per developer:

```markdown
<!-- keep-the-why:local -->
- autostart: yes
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:local -->
```

Where the why-knowledge lives and whether the project has been set up at all are facts about the project — everyone should see the same answer, so they're committed. Autostart and how often to run the timer checks are about how *this one developer* wants to work day to day — one person might want autostart and weekly checks, another might not want either, and neither is more correct. Splitting them also means the update-check/consistency-check timestamps don't turn into a shared field that every developer's session is racing to update.

## Detection and the two independent wizards

- **Project block missing** → run the project init wizard (below). This is deliberately not just "does `AGENTS.md` exist" — plenty of projects have one already for unrelated reasons, and treating that as "already initialized" would silently skip the wizard forever.
- **Project block present, `init: complete`** → project is set up. Don't re-run this part regardless of who's asking — it's a project property, not a per-developer one. Once committed, every other developer or session inherits it silently.
- **Project block present, `init: declined`** → set up was explicitly declined for this project. Don't re-ask.
- **Personal block missing** (independent of the project block's state) → run the personal preferences wizard (below). This is why a project already marked `init: complete` can still prompt a *new* developer once — the project is set up, but this particular person hasn't stated their own preferences yet.
- **Personal block present** → use it, no re-asking.

## Project init wizard (once per project)

1. Create or update the entry-point file with the project config block.
2. Ask, in one pass:
   - Where should the why-knowledge live? Default `context/`; anything else is fine.
   - How do you want to start: capture from now on only, work through existing history now (retrospective recovery), sit down for an interview now, or some combination?
   - Add the Keep the Why badge to this project's `README.md`? If yes, insert `[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)` near the top, alongside any other badges — same snippet for every project, see `keepthewhy.com/badge/`.
3. Run whichever starting mode was chosen.
4. If declined entirely, write `init: declined` and stop — no further project-level questions, ever, unless asked again. (The personal wizard below is independent and can still run.)

## Personal preferences wizard (once per developer)

1. Ask, in one pass:
   - Autostart every session, or load manually when asked? Default: automatically.
   - Check for skill updates automatically? If yes, what interval (default: 14 days).
   - Check `context/` for staleness automatically? If yes, what interval (default: 30 days).
2. Write the answers to the `AGENTS.local.md` personal block. If `AGENTS.local.md` doesn't exist yet, create it and make sure the entry-point file points to it (see `methodology.md`).

Both wizards: offer the defaults as a fast path ("just use the defaults" should be a one-word answer), but leave room for different choices, and record any deviation explicitly rather than leaving it implied.

## Timer check (every session, for whoever has a personal config)

Two independent timers, both opportunistic — checked when the skill is already active in a session, not on any real background schedule (skills don't run outside a session):

**Update check.** If `update-check` is enabled and the interval has elapsed since `last`: compare the installed `version` (`SKILL.md` frontmatter) against the latest release's `tag_name`. Query the GitHub API, not the HTML releases page — turn `repository` (also frontmatter) into an API URL by replacing `github.com/` with `api.github.com/repos/` and appending `/releases/latest`, e.g. `https://api.github.com/repos/oliver-zehentleitner/keep-the-why/releases/latest`. Returns clean JSON (`tag_name`, `published_at`, ...) instead of requiring the agent to parse an HTML redirect. This needs the agent's own web access — the skill itself has none (see "What this skill is not").

If checking isn't possible (no web access this session): don't fail silently forever. The first time this happens, say so and ask how to handle it — keep retrying each session, or turn `update-check` off. Respect the answer and don't re-ask every session after that; a check that's been silently broken since the day it was set up isn't a check, it's a false sense of one. Update `last` regardless of outcome, so the interval logic doesn't retry on every single message.

**Consistency check.** If `consistency-check` is enabled and the interval has elapsed: look for entries whose `Revisit when` condition (see `repository-structure.md`) has actually been triggered — not just entries that are merely old. Age alone isn't a defect; an untriggered old entry is still accurate. Scope the check to what `context/index.md` already summarizes rather than opening every topic file — the index exists precisely so this kind of check stays cheap. If something's genuinely triggered, surface it and ask whether to address it now. Update `last` regardless of outcome.

Keep both checks quiet when there's nothing to report. The point is catching real drift, not adding a second source of noise on top of the problem this skill exists to solve.
