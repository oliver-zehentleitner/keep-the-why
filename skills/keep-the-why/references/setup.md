# Setup

How the skill detects whether a project is already set up, runs the one-time init wizard when it isn't, and what happens on every session afterward.

## Detection

Look for a Keep the Why config block in the project's entry-point file — `AGENTS.md` by default, or whatever tool-specific file the project already uses instead (e.g. `CLAUDE.md`), consistent with the "adapt to what's already there" principle in `repository-structure.md`. The block looks like this:

```markdown
<!-- keep-the-why:config -->
- context: `context/`
- init: complete
- autostart: yes
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:config -->
```

- **Block found, `init: complete`** — already set up. Skip the wizard, go straight to the normal workflow, but still run the timer check (below) every session.
- **Block found, `init: declined`** — set up was explicitly declined. Don't re-ask. Skip straight to normal workflow (the skill still activates and works per-conversation, just without the init questions or timers).
- **No block found** — run the init wizard. This is deliberately not just "does `AGENTS.md` exist" — plenty of projects have one already for unrelated reasons, and treating that as "already initialized" would silently skip the wizard forever.

Init is a **project property, not a per-developer one**: once the config block is committed, every other developer or session inherits it silently. Don't re-run the wizard just because a different person or agent is now working in the repo.

## Init wizard (runs once)

1. Create or update the entry-point file with the config block.
2. Ask, in one pass, not as a multi-turn interrogation:
   - Where should the why-knowledge live? Default `context/`; anything else is fine.
   - How do you want to start: capture from now on only, work through existing history now (retrospective recovery), sit down for an interview now, or some combination?
   - Autostart every session, or load manually when asked?
   - Check for skill updates automatically? If yes, what interval (default: 14 days).
   - Check `context/` for staleness automatically? If yes, what interval (default: 30 days).
3. Always offer the defaults above as the fast path ("just use the defaults" should be a one-word answer), but leave room for different choices, and record any deviation from default in the config block so it's visible later, not just implied.
4. Anything genuinely personal (not shared team preference) belongs in `AGENTS.local.md`, referenced from the committed entry-point file — not in the config block itself.
5. Run whichever starting mode was chosen.
6. If the user declines setup entirely, write `init: declined` and stop — no further questions this project, ever, unless they ask again.

## Timer check (every session, regardless of init state)

Two independent timers, both opportunistic — checked when the skill is already active in a session, not on any real background schedule (skills don't run outside a session):

**Update check.** If `update-check` is enabled and the interval has elapsed since `last`: compare the installed `version` (`SKILL.md` frontmatter) against the latest release's `tag_name`. Query the GitHub API, not the HTML releases page — turn `repository` (also frontmatter) into an API URL by replacing `github.com/` with `api.github.com/repos/` and appending `/releases/latest`, e.g. `https://api.github.com/repos/oliver-zehentleitner/keep-the-why/releases/latest`. Returns clean JSON (`tag_name`, `published_at`, ...) instead of requiring the agent to parse an HTML redirect. This needs the agent's own web access — the skill itself has none (see "What this skill is not"). If checking isn't possible right now (no web access this session), skip silently and try again next time; don't nag about being unable to check. Update `last` regardless of outcome.

**Consistency check.** If `consistency-check` is enabled and the interval has elapsed: look for entries whose `Revisit when` condition (see `repository-structure.md`) has actually been triggered — not just entries that are merely old. Age alone isn't a defect; an untriggered old entry is still accurate. Scope the check to what `context/index.md` already summarizes rather than opening every topic file — the index exists precisely so this kind of check stays cheap. If something's genuinely triggered, surface it and ask whether to address it now. Update `last` regardless of outcome.

Keep both checks quiet when there's nothing to report. The point is catching real drift, not adding a second source of noise on top of the problem this skill exists to solve.
