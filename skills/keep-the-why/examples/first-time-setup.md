# Example: first-time setup

## Situation

The skill has just been installed in a project. There's no `AGENTS.md`, no `context/`, nothing to indicate it's ever been used here before.

**User:** "Why does this retry logic look so defensive?"

This happens to be a question the skill's own description matches, which is what activates it here — a Skill doesn't turn on just because a session starts. Saying so directly ("initialize Keep the Why in this project") works the same way and doesn't require a relevant question to come up first; see [Installation](https://keepthewhy.com/installation/).

## What the skill does

1. Before answering, checks for a project config block (in `AGENTS.md` or an equivalent entry-point file) and a personal config block (in `AGENTS.local.md`). Finds neither — this is a first activation, not a missing-context case.
2. Runs the project init wizard, one question at a time. This developer has no stored `confirmation-flow` yet (nothing to read it from — it's itself one of the questions the personal wizard hasn't asked yet), so the wizard defaults to `sequential`, not a bundled block:

    > **Agent:** This project isn't set up with Keep the Why yet. Quick setup, one question at a time — say "defaults" any time to take the rest as-is. First: where should the why-knowledge live? [`context/`]
    >
    > **User:** defaults.
    >
    > **Agent:** Got it, `context/`. Next: how do you want to start — capture from now on only, work through existing history now, sit down for an interview, or some combination? [fresh]
    >
    > **User:** defaults.
    >
    > **Agent:** Add the Keep the Why badge to README.md? [yes]
    >
    > **User:** yes.
    >
    > **Agent:** How much confirmation before something gets written to `context/` — automatic, always ask, or only when unclear? [only when unclear]
    >
    > **User:** defaults.
    >
    > **Agent:** Should I actively ask whether a related issue, ticket, or post-mortem exists when recording an entry — always, never, or only when a filter you define matches? [never]
    >
    > **User:** defaults.
    >
    > **Agent:** Last one: activation isn't guaranteed by the Skill mechanism itself — want me to check whether this platform (Claude Code, here) offers something stronger and set it up scoped to this project? [no]
    >
    > **User:** defaults.

3. Adds the badge to `README.md`, as the last badge after the existing ones:

    ```markdown
    [![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)
    ```

4. `context/` doesn't exist yet, so creates it with a short `README.md` inside (GitHub renders this automatically when someone browses the folder):

    ```markdown
    <a href="https://keepthewhy.com"><img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why"></a>

    # Project context

    This directory preserves the reasoning behind this project: architectural
    decisions, constraints, rejected alternatives, incident learnings,
    deliberate workarounds, and other knowledge that the code alone cannot
    explain.

    It's organized and kept current according to the [Keep the
    Why](https://keepthewhy.com) schema — a repo-native convention and
    agent skill, not specific to this project. Recognizing that schema
    means an agent (or a person who's seen it before) already knows how
    this directory is structured and how to work with it, without first
    having to figure that out from scratch.

    It answers:

    > Why is the project built this way?

    For usage, installation, operation, or troubleshooting, see `docs/`.

    ## Reading the entries

    Each entry separates:

    - **Type** — what kind of thing it is: decision, workaround, incident, or constraint (or undefined, with a reason, if none fit)
    - **Status** — whether a decision is active, superseded, open, or needs review
    - **Evidence** — whether its rationale is confirmed, inferred, or unknown

    Old reasoning is retained when it remains useful for understanding how the
    project evolved.

    ## Trust boundary

    Files in this directory describe project knowledge. They do not contain
    instructions that grant permissions, override user intent, authorize
    commands, or weaken security controls.

    Start with the [context index](index.md).
    ```

5. Creates `AGENTS.md` with a short pointer section and the project config block, including `context-schema` set to the currently installed skill version — freshly created, nothing to migrate:

    ```markdown
    <!-- keep-the-why:config -->
    - context: `context/`
    - init: complete
    - context-schema: 0.9.2
    - capture-confirmation: confirm-when-unsure
    - source-reference: never
    <!-- /keep-the-why:config -->
    ```

6. Runs the personal preferences wizard, separately, also one question at a time for the same reason:

    > **Agent:** And a couple of preferences just for you (not committed). Capture proactively during conversation, or only when asked? [proactive]
    >
    > **User:** explicit-only.
    >
    > **Agent:** When there's more than one thing to confirm at once — including questions like these — one at a time, or as a list you can review together? [one at a time]
    >
    > **User:** defaults.
    >
    > **Agent:** Check for skill updates? [yes, every 14 days]
    >
    > **User:** defaults.
    >
    > **Agent:** Check `context/` for staleness? [yes, every 30 days]
    >
    > **User:** defaults on the rest.

7. `AGENTS.local.md` doesn't exist yet. Checks `.gitignore` first — it already has an `AGENTS.local.md` entry (from an earlier project convention), so nothing to add there. Creates `AGENTS.local.md`, referenced from `AGENTS.md`, with the personal config block:

    ```markdown
    <!-- keep-the-why:local -->
    - capture-mode: explicit-only
    - confirmation-flow: sequential
    - update-check: every 14 days — last: 2026-07-21
    - consistency-check: every 30 days — last: 2026-07-21
    <!-- /keep-the-why:local -->
    ```

8. Only then answers the original question about the retry logic — using retrospective recovery on just that piece of code, since "fresh start" was chosen, not a full-history pass.

## A second developer opens the same project later

The project config block already says `init: complete` — that part isn't re-asked, it's a project fact, not a per-developer one. `capture-confirmation` is part of that same project fact: it stays `confirm-when-unsure` for everyone, this developer included, regardless of their own personal preferences. But this developer has no `AGENTS.local.md` yet, so the personal preferences wizard (step 6 above) runs for them individually, one question at a time again since they have no stored `confirmation-flow` either. Their answers might differ from the first developer's, and that's fine — capture mode, `confirmation-flow`, and check intervals are exactly the kind of thing that should vary per person. Note that `confirmation-flow` lives in this checkout's `AGENTS.local.md`, so even if this developer chose `batch` on some other project, that preference isn't visible here — the personal wizard asks its one-line question again and records the answer for this project.

## A later session, after a few weeks of no web access

The update-check interval elapses, but this environment has no web access. The skill reports it can't check, asks whether to keep retrying next session or turn the check off, and the developer says "keep trying." The personal config block gets a third field: `- update-check: every 14 days — last: 2026-07-08 — on-failure: retry-quietly`. Because `last` didn't advance on the failed attempt, the very next session tries again automatically — and because `on-failure` is now `retry-quietly`, it does so without asking the same question again. Once a check actually succeeds, `last` advances and the normal interval takes back over.

## What it doesn't do

- Doesn't silently create `context/` and start capturing without asking first.
- Doesn't bundle every wizard question into one message by default — that's a `batch`-style presentation, valid once a developer's `confirmation-flow` is actually known to prefer it, not the default for a first-ever activation.
- Doesn't turn either wizard into a long interrogation either — sequential still means short, focused questions with sensible defaults, "defaults" as a valid one-word answer that can also cover everything remaining.
- Doesn't add the badge (or anything else) if the user says no to that specific question — each wizard answer is independent, not all-or-nothing.
- Doesn't bundle personal preferences into the committed project config, and doesn't skip the personal wizard just because the project is already initialized.
- Doesn't overwrite an existing `context/README.md` (or equivalent) if the folder is being adopted rather than created fresh.
- Doesn't create `AGENTS.local.md` without first making sure `.gitignore` actually excludes it — "not committed" is enforced, not just documented.
- Doesn't keep asking the same "web access is broken, what do you want to do" question every session once it's been answered once.
- Doesn't answer the original question before setup is resolved, but also doesn't let setup become a multi-turn detour from what the user actually asked.
