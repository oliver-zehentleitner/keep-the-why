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

5. `context/` doesn't exist yet, so creates it with a short `README.md` inside (GitHub renders this automatically when someone browses the folder):

    ```markdown
    <img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why">

    # Context

    Why this project is built the way it is — architecture decisions,
    rejected alternatives, workarounds, and reasoning the code alone
    can't show. Captured and kept current by the [Keep the
    Why](https://keepthewhy.com) agent skill.

    Not usage docs — see `docs/` for that. Start with `index.md`.
    ```

6. Creates `AGENTS.md` with a short pointer section and the project config block:

    ```markdown
    <!-- keep-the-why:config -->
    - context: `context/`
    - init: complete
    <!-- /keep-the-why:config -->
    ```

7. Runs the personal preferences wizard, separately:

    > And a couple of preferences just for you (not committed):
    > - Capture proactively during conversation, or only when asked? [proactive]
    > - Check for skill updates? [yes, every 14 days]
    > - Check `context/` for staleness? [yes, every 30 days]

8. User replies: "explicit-only, defaults on the rest."
9. `AGENTS.local.md` doesn't exist yet. Checks `.gitignore` first — it already has an `AGENTS.local.md` entry (from an earlier project convention), so nothing to add there. Creates `AGENTS.local.md`, referenced from `AGENTS.md`, with the personal config block:

    ```markdown
    <!-- keep-the-why:local -->
    - capture-mode: explicit-only
    - update-check: every 14 days — last: 2026-07-21
    - consistency-check: every 30 days — last: 2026-07-21
    <!-- /keep-the-why:local -->
    ```

10. Only then answers the original question about the retry logic — using retrospective recovery on just that piece of code, since "fresh start" was chosen, not a full-history pass.

## A second developer opens the same project later

The project config block already says `init: complete` — that part isn't re-asked, it's a project fact, not a per-developer one. But this developer has no `AGENTS.local.md` yet, so the personal preferences wizard (step 7 above) runs for them individually. Their answers might differ from the first developer's, and that's fine — capture mode and check intervals are exactly the kind of thing that should vary per person.

## A later session, after a few weeks of no web access

The update-check interval elapses, but this environment has no web access. The skill reports it can't check, asks whether to keep retrying next session or turn the check off, and the developer says "keep trying." The personal config block gets a third field: `- update-check: every 14 days — last: 2026-07-08 — on-failure: retry-quietly`. Because `last` didn't advance on the failed attempt, the very next session tries again automatically — and because `on-failure` is now `retry-quietly`, it does so without asking the same question again. Once a check actually succeeds, `last` advances and the normal interval takes back over.

## What it doesn't do

- Doesn't silently create `context/` and start capturing without asking first.
- Doesn't turn either wizard into a long interrogation — one message each, sensible defaults, "defaults" as a valid one-word answer.
- Doesn't add the badge (or anything else) if the user says no to that specific question — each wizard answer is independent, not all-or-nothing.
- Doesn't bundle personal preferences into the committed project config, and doesn't skip the personal wizard just because the project is already initialized.
- Doesn't overwrite an existing `context/README.md` (or equivalent) if the folder is being adopted rather than created fresh.
- Doesn't create `AGENTS.local.md` without first making sure `.gitignore` actually excludes it — "not committed" is enforced, not just documented.
- Doesn't keep asking the same "web access is broken, what do you want to do" question every session once it's been answered once.
- Doesn't answer the original question before setup is resolved, but also doesn't let setup become a multi-turn detour from what the user actually asked.
