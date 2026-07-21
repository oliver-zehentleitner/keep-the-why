# Example: first-time setup

## Situation

The skill has just been installed in a project. There's no `AGENTS.md`, no `context/`, nothing to indicate it's ever been used here before.

**User:** "Why does this retry logic look so defensive?"

## What the skill does

1. Before answering, checks for a `keep-the-why:config` block in `AGENTS.md` or an equivalent entry-point file (see `references/setup.md`). Finds none — this is a first activation, not a missing-context case.
2. Runs the init wizard in one pass rather than a long back-and-forth:

    > This project isn't set up with Keep the Why yet. Quick setup (defaults in brackets, just say "defaults" to skip):
    > - Where should the why-knowledge live? [`context/`]
    > - Start fresh, work through existing history now, or both? [fresh]
    > - Load automatically every session, or only when asked? [automatically]
    > - Check for skill updates? [yes, every 14 days]
    > - Check `context/` for staleness? [yes, every 30 days]

3. User replies: "defaults, but don't autostart — I'll ask for it."
4. Creates `AGENTS.md` with a short pointer section and the config block:

    ```markdown
    <!-- keep-the-why:config -->
    - context: `context/`
    - init: complete
    - autostart: no
    - update-check: every 14 days — last: 2026-07-21
    - consistency-check: every 30 days — last: 2026-07-21
    <!-- /keep-the-why:config -->
    ```

5. Only then answers the original question about the retry logic — using retrospective recovery on just that piece of code, since "fresh start" was chosen, not a full-history pass.

## What it doesn't do

- Doesn't silently create `context/` and start capturing without asking first.
- Doesn't turn the setup into a long interrogation — one message, sensible defaults, "defaults" as a valid one-word answer.
- Doesn't re-run this wizard the next time anyone opens the project — `init: complete` in the committed config block is a project-wide fact, not a per-developer one.
- Doesn't answer the original question before setup is resolved, but also doesn't let setup become a multi-turn detour from what the user actually asked.
