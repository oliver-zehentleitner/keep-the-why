# Example: first-time setup

## Situation

The skill has just been installed in a project. There's no `.keep-the-why`, no `context/`, nothing to indicate it's ever been used here before, and nobody has said anything about setting it up.

**User:** "Why does this retry logic look so defensive?"

This happens to be a question the skill's own description matches, which is what activates it here — a Skill doesn't turn on just because a session starts. But an organic match on an unrelated question is never grounds to propose setting anything up in a project that's never opted in — see "Detection and the two independent wizards" in `references/setup.md`. So here, the skill checks `.keep-the-why` (missing) and the legacy block (also missing), confirms there's no explicit request to set up Keep the Why anywhere in this conversation, and does nothing project-setup-related: no wizard, no mention that this project has no Keep the Why setup, not even a one-line offer. It just answers the retry-logic question normally, exactly as if this skill had never activated at all.

## A later session, this time asked directly

**User:** "Initialize Keep the Why in this project."

This names the skill and its purpose directly — not a task that happens to match the description, an actual request. That's what clears the gate; see [Installation](https://keepthewhy.com/installation/) for other phrasings that count.

## What the skill does

1. Checks `.keep-the-why` for a pinned version (none — nothing to defer to), then for a project config file (`.keep-the-why`) and a personal config file (`~/.keep-the-why/<id>.md`). Finds neither, and no legacy block in `AGENTS.md`/`AGENTS.local.md` either — this is a genuinely first activation, not a missing-context case and not a migration. This time there's an explicit request in the conversation, so the project init wizard runs.
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
    > **Agent:** Should this project offer suggested personal-workflow defaults to future developers, instead of everyone answering the personal wizard from scratch? [no]
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

4. `context/` doesn't exist yet, so creates it with a short `README.md`, `AGENTS.md`, and `CLAUDE.md` inside (GitHub renders the README automatically when someone browses the folder; the other two guard against hand-writing to the schema without invoking the skill — see `references/setup.md`'s "Guarding `context/` itself"):

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

5. Generates a project `id` (a git remote exists here, so `<owner>---<repo>` from `origin`) and creates `.keep-the-why` with the header every such file gets plus the project config block, `context-schema` set to the currently installed skill version — freshly created, nothing to migrate:

    ```markdown
    This is machine-readable project state for the Keep the Why skill
    (https://keepthewhy.com). See context/index.md, or this project's own
    README, for what Keep the Why actually is.

    <!-- keep-the-why:config -->
    - id: acme---widget-service
    - context: `context/`
    - init: complete
    - context-schema: 0.10.0
    - capture-confirmation: confirm-when-unsure
    - source-reference: never
    <!-- /keep-the-why:config -->
    ```

    Since the previous question about `personal-defaults` was declined, no `personal-defaults` block gets added. `AGENTS.md` itself is left exactly as it already was — nothing about Keep the Why gets written into it; mentioning the skill anywhere a human would read it is this project's own editorial call (the badge question above already covers that), not something setup does on its own.

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

7. `~/.keep-the-why/<id>.md` doesn't exist yet on this machine — creates `~/.keep-the-why/` if needed, then writes the personal config file, no `.gitignore` entry needed since it lives outside the project entirely:

    ```markdown
    <!-- keep-the-why:personal -->
    - capture-mode: explicit-only
    - confirmation-flow: sequential
    - update-check: every 14 days — last: 2026-07-21
    - consistency-check: every 30 days — last: 2026-07-21
    <!-- /keep-the-why:personal -->
    ```

8. Confirms setup is done and asks what to work on first — there's no pending question from this explicit-request turn to answer, unlike the earlier organic activation, which had already answered the retry-logic question directly without any of this running.

## A second developer opens the same project later

The project config already says `init: complete` — that part isn't re-asked, it's a project fact, not a per-developer one. `capture-confirmation` is part of that same project fact: it stays `confirm-when-unsure` for everyone, this developer included, regardless of their own personal preferences. But this developer has no `~/.keep-the-why/<id>.md` yet on their machine, and no legacy `AGENTS.local.md` block to carry over either (this project was set up fresh, under the current scheme), so the personal preferences wizard (step 6 above) runs for them individually, one question at a time again since they have no stored `confirmation-flow` either. Their answers might differ from the first developer's, and that's fine — capture mode, `confirmation-flow`, and check intervals are exactly the kind of thing that should vary per person. Note that `confirmation-flow` is stored per project, in `~/.keep-the-why/<id>.md`, so even if this developer chose `batch` on some other project, that preference isn't visible here — the personal wizard asks its one-line question again and records the answer for this project's own file.

## A later session, after a few weeks of no web access

The update-check interval elapses, but this environment has no web access. The skill reports it can't check, asks whether to keep retrying next session or turn the check off, and the developer says "keep trying." The personal config block gets a third field: `- update-check: every 14 days — last: 2026-07-08 — on-failure: retry-quietly`. Because `last` didn't advance on the failed attempt, the very next session tries again automatically — and because `on-failure` is now `retry-quietly`, it does so without asking the same question again. Once a check actually succeeds, `last` advances and the normal interval takes back over.

## What it doesn't do

- Doesn't silently create `context/` and start capturing without asking first.
- Doesn't bundle every wizard question into one message by default — that's a `batch`-style presentation, valid once a developer's `confirmation-flow` is actually known to prefer it, not the default for a first-ever activation.
- Doesn't turn either wizard into a long interrogation either — sequential still means short, focused questions with sensible defaults, "defaults" as a valid one-word answer that can also cover everything remaining.
- Doesn't add the badge (or anything else) if the user says no to that specific question — each wizard answer is independent, not all-or-nothing.
- Doesn't bundle personal preferences into the committed project config, and doesn't skip the personal wizard just because the project is already initialized.
- Doesn't overwrite an existing `context/README.md`, `AGENTS.md`, or `CLAUDE.md` (or an equivalent) if the folder is being adopted rather than created fresh.
- Doesn't put personal preferences anywhere inside the project at all — `~/.keep-the-why/<id>.md` lives outside it entirely, so there's no `.gitignore` entry to get wrong.
- Doesn't write anything about itself into `AGENTS.md` — whether and how to mention Keep the Why anywhere a human reads it is this project's own call, not something setup adds unasked.
- Doesn't keep asking the same "web access is broken, what do you want to do" question every session once it's been answered once.
- Doesn't propose, mention, or run any project setup from an organic activation on a project with no `.keep-the-why` and no legacy block — not even a low-key "want me to set this up?" offer. Answers the actual question and stops there; setup only starts from an explicit request, in a separate turn if that's when it comes.
- Doesn't let setup become a multi-turn detour from what the user actually asked, once it does run (the explicit-request case) — it's its own self-contained flow, not interleaved with answering an unrelated question from earlier in the conversation.
