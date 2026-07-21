# Example: first-time setup

## Situation

The skill has just been installed in a project. There's no `AGENTS.md`, no `context/`, nothing to indicate it's ever been used here before.

**User:** "Why does this retry logic look so defensive?"

## What the skill does

1. Before answering, checks for a project config block (in `AGENTS.md` or an equivalent entry-point file) and a personal config block (in `AGENTS.local.md`). Finds neither — this is a first activation, not a missing-context case.
2. Runs the project init wizard in one pass:

    > This project isn't set up with Keep the Why yet. Quick setup (defaults in brackets, just say "defaults" to skip):
    > - Where should the why-knowledge live? [`context/`]
    > - Start fresh, work through existing history now, or both? [fresh]
    > - Add the Keep the Why badge to README.md? [yes]

3. User replies: "defaults."
4. Adds the badge to `README.md`, as the last badge after the existing ones:

    ```markdown
    [![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)
    ```

5. Creates `AGENTS.md` with a short pointer section and the project config block:

    ```markdown
    <!-- keep-the-why:config -->
    - context: `context/`
    - init: complete
    <!-- /keep-the-why:config -->
    ```

6. Runs the personal preferences wizard, separately:

    > And a couple of preferences just for you (not committed):
    > - Load automatically every session, or only when asked? [automatically]
    > - Check for skill updates? [yes, every 14 days]
    > - Check `context/` for staleness? [yes, every 30 days]

7. User replies: "don't autostart, defaults on the rest."
8. Creates `AGENTS.local.md`, referenced from `AGENTS.md`, with the personal config block:

    ```markdown
    <!-- keep-the-why:local -->
    - autostart: no
    - update-check: every 14 days — last: 2026-07-21
    - consistency-check: every 30 days — last: 2026-07-21
    <!-- /keep-the-why:local -->
    ```

9. Only then answers the original question about the retry logic — using retrospective recovery on just that piece of code, since "fresh start" was chosen, not a full-history pass.

## A second developer opens the same project later

The project config block already says `init: complete` — that part isn't re-asked, it's a project fact, not a per-developer one. But this developer has no `AGENTS.local.md` yet, so the personal preferences wizard (step 6 above) runs for them individually. Their answers might differ from the first developer's, and that's fine — autostart and check intervals are exactly the kind of thing that should vary per person.

## What it doesn't do

- Doesn't silently create `context/` and start capturing without asking first.
- Doesn't turn either wizard into a long interrogation — one message each, sensible defaults, "defaults" as a valid one-word answer.
- Doesn't add the badge (or anything else) if the user says no to that specific question — each wizard answer is independent, not all-or-nothing.
- Doesn't bundle personal preferences into the committed project config, and doesn't skip the personal wizard just because the project is already initialized.
- Doesn't answer the original question before setup is resolved, but also doesn't let setup become a multi-turn detour from what the user actually asked.
