# Setup

How the skill detects whether a project is already set up, runs the one-time init wizard when it isn't, and what happens on every session afterward.

## Two config files, two different scopes

Setup state splits across two files, one committed and shared, one personal to a developer and a machine: what's true about the *project* versus what's a personal workflow choice. Neither lives inside the project's entry-point file (`AGENTS.md`, `CLAUDE.md`, or whatever a project already uses) — see "Why dedicated files, not entry-point blocks" in `context/config-format.md` for why, and `references/migrations.md` for bringing an existing project from the previous location to this one.

**Project config**, in `.keep-the-why` at the project root, committed, shared by everyone:

```markdown
This is machine-readable project state for the Keep the Why skill
(https://keepthewhy.com). See context/index.md, or this project's own
README, for what Keep the Why actually is.

<!-- keep-the-why:config -->
- id: oliver-zehentleitner---keep-the-why
- context: `context/`
- init: complete
- context-schema: 0.10.0
- capture-confirmation: confirm-when-unsure
- source-reference: never
<!-- /keep-the-why:config -->
```

The header line is there for anyone who opens this specific file directly and has no other context for what it is — write it once, at creation, whether the file is freshly created or produced by migrating an existing project (below). It's not something the skill itself reads or depends on, same as the rest of this file's prose isn't. Whether and how a project otherwise mentions Keep the Why to a human — a README section, the badge — is that project's own call, not something this skill writes into its entry-point file; see "Project init wizard" below.

`id` uniquely identifies this project across machines, clones, and worktrees — it's what a developer's personal file is keyed by (see "Personal config" below), and it's written once, at init, then never re-derived. Two forms:

- **A git remote exists:** `<owner>---<repo>` from the `origin` remote URL, normalizing both `/` (GitHub's own separator) and any other filesystem-unsafe characters to `-` — e.g. `origin` pointing at `github.com/oliver-zehentleitner/keep-the-why` gives `oliver-zehentleitner---keep-the-why`.
- **No git remote:** `<uuid>---<folder-name>`, where `<uuid>` is generated once with a single OS command (`uuidgen` on macOS/Linux; PowerShell's `[guid]::NewGuid()` on Windows — a one-off invocation, not a shipped script) and `<folder-name>` is the project directory's current name at the moment of generation.

Being stored rather than recomputed each session is the point: a renamed repo, a moved clone, or a fork all keep the same `id`, so the personal file at `~/.keep-the-why/<id>.md` (below) stays correctly matched to this project regardless of what happens to its path or remote afterward. If a project later needs to genuinely split in two, generate a fresh `id` for the new one rather than reusing the original — that's a deliberate, rare action, not something the skill does on its own.

`context-schema` records the latest skill version this project's `context/` has been checked and migrated against — not an independent format-version number of its own. It's still tracked separately from the installed skill's `metadata.version` (SKILL.md frontmatter) because a release can bump `metadata.version` with nothing in `references/migrations.md` applying to this project at all — in that case `context-schema` simply advances to match, with nothing to migrate. A release changing no `context/` entry format isn't the same test, though — a structural convention, a config default, or a storage-location change can still need action without touching entry format at all (see "Context schema and migrations" below).

`capture-confirmation` governs whether writing to `context/` needs permission first, independently of whether an entry is warranted at all (that's rules 1, 9, and 13, unaffected by this setting). It's project-wide, not personal — unlike *when* the skill looks for capture opportunities (see `capture-mode` below), *how much gets written without asking* affects what everyone else sees committed to a shared folder, so it's a project decision. See "The confirmation model" below for the values and how they interact with the other settings.

`source-reference` governs whether the skill actively *asks* for a related issue, ticket, or post-mortem link when recording an entry, rather than only capturing a Source (rule 2 in `SKILL.md`) that surfaces naturally. Project-wide, same reasoning as `capture-confirmation` — it changes what gets asked during a shared workflow, not an individual's personal habits.

A project can optionally also carry a `personal-defaults` block, offered to new developers instead of the full personal wizard — see "Personal defaults, and the global ask-vs-accept policy" below.

A project can optionally pin `.keep-the-why` to an exact vendored skill version instead of whatever's installed on a given machine — see "Pinned versions" below.

**Personal config**, at `~/.keep-the-why/<id>.md` — outside the project entirely, one file per project per developer per machine, never committed, never part of the repo:

```markdown
<!-- keep-the-why:personal -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: every 14 days — last: 2026-07-21
- consistency-check: every 30 days — last: 2026-07-21
<!-- /keep-the-why:personal -->
```

Where the why-knowledge lives, whether the project has been set up at all, and how much confirmation writing needs are facts about the project or its quality bar — everyone should see the same answer, so they're committed, in `.keep-the-why`. Capture mode, how multiple confirmations get presented, and how often to run the timer checks are about how *this one developer* wants to work day to day — one person might want proactive capture and weekly checks, another might not want either, and neither is more correct; they live outside the repo entirely, in `~/.keep-the-why/<id>.md`.

`capture-mode` says `proactive` rather than `autostart` deliberately — a Skill has no session-level autostart hook to promise (see "What this skill is not" in `SKILL.md`); what's actually configurable is whether the skill, once active in a conversation, looks for capture opportunities on its own or waits to be asked. `proactive` describes that behavior honestly; `explicit-only` is the alternative. This is a different question from `capture-confirmation` — `capture-mode` decides whether the skill goes looking in the first place, `capture-confirmation` decides what happens once it's found something.

`confirmation-flow` governs how *multiple* things needing a response get presented, whenever more than one comes up at once — `sequential` (one at a time, wait for an answer before the next) or `batch` (a numbered list, confirm or reject individually or all at once). This isn't limited to candidate `context/` entries (typical in retrospective recovery or after an interview session) — the exact same question applies to both wizards' own questions, which is why they read this same setting instead of hardcoding one presentation style for everyone. It doesn't change *whether* confirmation is needed — that's still `capture-confirmation` — only how it's presented when there's more than one thing at once.

A personal file can also carry a `source` field, when its values came from a project's `personal-defaults` block rather than a fresh wizard run — see the next section.

## Personal defaults, and the global ask-vs-accept policy

A project can offer suggested personal settings to new developers instead of making every one of them answer the personal wizard from scratch — genuinely useful for a team that's already agreed on how it wants to work. Entirely optional; most projects won't have one.

**Project side**, an additional block in `.keep-the-why`, alongside `keep-the-why:config`:

```markdown
<!-- keep-the-why:personal-defaults -->
- capture-mode: proactive
- confirmation-flow: sequential
- update-check: every 14 days
- consistency-check: every 30 days
<!-- /keep-the-why:personal-defaults -->
```

Same fields as a personal file, minus `last:` timestamps — those are inherently per-developer and get set fresh the moment a developer actually adopts these values, never inherited from the project.

**Global policy**, one file per machine, not per project, at `~/.keep-the-why/config`:

```markdown
<!-- keep-the-why:global -->
- personal-defaults-policy: always-ask
<!-- /keep-the-why:global -->
```

`personal-defaults-policy` decides what happens when a *new* developer (no personal file yet for this project) lands on a project that *does* offer `personal-defaults`:

- **`always-ask`** — show the offered defaults, ask whether to use them as-is or answer the personal wizard instead. Either way, a `~/.keep-the-why/<id>.md` gets created — with `source: project defaults (confirmed <date>)` if accepted, or as an ordinary fresh wizard result if not. Creating the file either way matters: the skill's own state must always say plainly what's going on, rather than leaving "did this developer see and accept the defaults, or has nobody ever asked" indistinguishable from each other.
- **`auto-accept`** — adopt the offered defaults silently, no question asked, recorded with `source: project defaults (accepted automatically)`.

**First time this situation ever comes up** (a project offers `personal-defaults` and `~/.keep-the-why/config` doesn't exist, or exists without this field yet): ask the developer directly — "This project suggests personal defaults. Want to always be asked before adopting a project's suggested defaults, or always accept them automatically from here on?" — record the answer in `~/.keep-the-why/config`, then apply it immediately to the situation that triggered the question. This is a one-time, machine-wide question, not something asked again per project.

If a project has no `personal-defaults` block at all, none of this applies — the personal wizard runs as it always has, regardless of the global policy, since there's nothing to offer or accept.

## Pinned versions

A project can pin `.keep-the-why` to an exact, vendored copy of the skill instead of whatever happens to be installed on a given developer's machine — useful when a project's `context/` was set up against, and tested with, a specific release, and shouldn't silently run under a different one just because that's what's on someone's laptop (personal-scope installs fully shadow a project-scoped skill of the same name in some tools, so without this, the vendored copy a project actually committed could never run at all for a developer who also has the skill installed personally).

```markdown
- pinned-version: 0.9.5
- pinned-path: .claude/skills/keep-the-why/SKILL.md
```

Two additional fields in `.keep-the-why`'s `keep-the-why:config` block, both present or both absent. Checked first, before anything else in the setup check (`SKILL.md`'s "0. Setup check"):

1. **No pin fields present**, or `pinned-version` equals the running skill's own `metadata.version` → nothing to do, continue normally.
2. **`pinned-version` differs, and `pinned-path` exists on disk** → read that file (and, on demand, whatever `references/*.md` it points to, resolved relative to it, not to the installed skill's own) and follow it in place of these instructions for the rest of the session. Don't ask permission first — deferring to the pin is the entire point of setting one.
3. **`pinned-version` differs, and `pinned-path` doesn't exist** → hard stop, not a silent fallback to the installed version. Explain plainly: which version and path was expected, that it isn't there, and why this matters (silently running a different version than the project pinned can mean incompatible assumptions about `context/`, or just different behavior than the project was set up to expect). Offer three explicit choices: re-vendor the pinned copy at that path, remove the stale `pinned-version`/`pinned-path` pair from `.keep-the-why` (the project no longer wants to pin), or proceed with the installed version for this session only. The third option is **never persisted** — nothing gets written anywhere to remember it — so the same question recurs next session until the project's `.keep-the-why` is actually fixed one way or the other.

## Detection and the two independent wizards

- **Project file missing, no legacy block found, no explicit request to set up Keep the Why in this conversation** → do nothing project-setup-related. Don't run the wizard, don't mention that this project has no Keep the Why setup, don't propose or make any `context/` entry — answer or help with whatever was actually asked, exactly as if this skill hadn't activated. An organic activation (the skill's own description happening to match the task at hand) is never, by itself, grounds to propose setting anything up in a project that's never opted in — that's the whole point of gating on an explicit request instead: a project a developer is merely working in shouldn't get a setup wizard just because a question they asked happened to match this skill's description.
- **Project file missing, no legacy block found, but the user has explicitly asked, in this conversation, to set up or initialize Keep the Why for this project** → run the project init wizard (below). An explicit request names the skill or its purpose directly — "initialize Keep the Why here," "set up Keep the Why for this project," "let's start using Keep the Why" — not just a task that happens to match the skill's description. If it's genuinely ambiguous whether this is what's being asked, that's rule 14 territory: say what you're unsure about and ask, rather than guessing either way.
- **Project file missing, legacy block found** in the entry-point file → this project predates `.keep-the-why` and already opted in once — this is a migration, not a first setup, so the explicit-request gate above doesn't apply here; see "Migrating to `.keep-the-why`" in `references/migrations.md` instead of the fresh wizard.
- **Project file present, `init: complete`** → project is set up. Don't re-run this part regardless of who's asking — it's a project property, not a per-developer one. Once committed, every other developer or session inherits it silently.
- **Project file present, `init: declined`** → set up was explicitly requested, then declined partway through (see step 7 below), for this project. Don't re-run the wizard from an organic activation — same as the no-file case above, that's already covered by the explicit-request gate, not by this flag. What this flag actually guards against: a *different* explicit request later in the same or a later session re-triggering the wizard from scratch as if nothing had been asked before; treat a fresh explicit request as reason enough to ask again regardless of this flag — declining once doesn't forbid asking a second time, it just means an organic activation still won't ask on its own.
- **Personal file missing** (independent of the project file's state) → check for a legacy personal block in this checkout's `AGENTS.local.md` first (see migrations.md); if genuinely absent too, run the personal preferences wizard (below), consulting `personal-defaults`/the global policy above if the project offers them. This is why a project already marked `init: complete` can still prompt a *new* developer once — the project is set up, but this particular person hasn't stated their own preferences yet.
- **Personal file present** → use all valid stored values as-is, no re-asking for them. This isn't unconditional, though: ask once for any required field that's still missing (e.g. `confirmation-flow` added to the skill after this file was created — see "Missing fields vs. invalid fields" below), and clarify any invalid, contradictory, or ambiguous value per rule 14 rather than silently using it. "No re-asking" applies to settings that are actually present and valid, not to the whole file regardless of its contents.

## Project init wizard (once per project, only after an explicit request)

Reached only via the second bullet above — an explicit request to set up or initialize Keep the Why. Never run this from an organic activation on a project with no `.keep-the-why` and no legacy block.

1. Ask the following, presented according to the developer's `confirmation-flow` if it's already known from a previous session on this machine's `~/.keep-the-why/` files — the setting is stored per project, so a preference set on some other project isn't visible here (`sequential`: one question, wait for the answer, then the next; `batch`: all of them together) — default to `sequential` if this developer has no stored preference yet, since that's `confirmation-flow`'s own default and there's nothing else to go on:
   - Where should the why-knowledge live? Default `context/`; anything else is fine.
   - How do you want to start: capture from now on only, work through existing history now (retrospective recovery), sit down for an interview now, or some combination?
   - Add the Keep the Why badge to this project's `README.md`? If yes, insert `[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)` as the *last* badge in the existing badge row — same snippet for every project, see `keepthewhy.com/badge/`. If there's no existing badge row yet, it's the only one, at the top.
   - How much confirmation before something gets written to `context/`: automatic (no interruption), always ask, or only ask when it's genuinely unclear? Default: only ask when unclear.
   - Should the agent actively ask whether a related issue, ticket, or post-mortem exists when recording something: always, never, or only when a filter criterion you define matches? Default: never.
   - Should this project offer suggested personal-workflow defaults to future developers, instead of every one of them answering the personal wizard from scratch? Default: no. If yes, ask the same questions the personal wizard asks (below) framed as "what should a new developer here start with," and write them to `.keep-the-why`'s `personal-defaults` block rather than to any one developer's own file.
   - **Activation isn't guaranteed by the Skill mechanism itself** (see "Activation reliability is left to each agent tool" in `context/compatibility.md`) — want to set up something stronger for this project, if the current agent's own platform supports it? Default: no.
2. If the previous question was answered yes: check what the *current* agent's own platform actually offers for stronger activation (session-start context injection, forced tool invocation, or similar), and check `references/autostart.md` for a verified example for this platform. That file holds positive examples someone already tested, not a mandate — the current agent still decides what, if anything, to set up, informed by that evidence where it exists rather than only its own from-scratch reasoning. This is deliberately left generic here rather than naming one tool's mechanism as the instruction: don't invent or fake a mechanism for a platform that doesn't actually have one — if genuinely unsure what the current platform supports, say so plainly and ask rather than guessing (rule 14), and if `references/autostart.md` has nothing for this platform yet, that's an honest gap, not a reason to guess at something untested. No standardized, tested-across-every-tool recommendation exists yet — see the tracking issue for where this stands.
3. Generate the project `id` (see "Project config" above) and create `.keep-the-why` with the project config block, including `context-schema` set to the currently installed skill's `metadata.version` (frontmatter in `SKILL.md`) — a freshly created or newly adopted `context/` is up to date with the current format by definition, nothing to migrate. Add the `personal-defaults` block too, if step 1 asked for one.
4. If the why-knowledge folder is being created fresh (not an existing folder being adopted), add a short `README.md` inside it:

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

    GitHub (and most code hosts) render a folder's `README.md` automatically when browsing it, so this is what someone sees first landing in the folder cold, without needing to already know what Keep the Why is. Skip this step if adopting an existing folder that already has its own README or equivalent — don't overwrite it. Also add `AGENTS.md` and `CLAUDE.md` inside the folder — see "Guarding `context/` itself" below — again skipping either one that already exists doing an equivalent job.
5. Leave the project's entry-point file (`AGENTS.md`, or whatever it already uses) alone — nothing about Keep the Why needs to go there. Detection reads `.keep-the-why` directly, regardless of what any entry-point file says; whether to mention Keep the Why to a human reading that file (a line, a link to the badge — see `keepthewhy.com/badge/`) is the project's own editorial call, already covered by the badge question in step 1, not something this skill writes in on its own.
6. Run whichever starting mode was chosen.
7. If declined entirely, write `init: declined` and stop — no further project-level questions, ever, unless asked again. (The personal wizard below is independent and can still run.)

## Guarding `context/` itself

Two small files inside the why-knowledge folder, alongside `README.md`, exist to stop an agent from hand-writing schema-shaped content into `context/` without going through this skill's own checks (Evidence, Status, proportionality, confirmation) — observed happening in practice: a session with the project already fully set up wrote directly to a topic file, schema-shaped, without invoking the skill at all.

`context/AGENTS.md`:

```markdown
Before creating or editing anything in this directory, invoke the keep-the-why skill. Don't write to the schema by hand.
```

`context/CLAUDE.md`:

```markdown
@AGENTS.md
```

Two files, not one, because different tools discover nested memory files differently: Claude Code loads a nested `CLAUDE.md` automatically the first time it reads any file in the directory it lives in, regardless of the session's own working directory — a real, harness-level guarantee, not something the agent has to remember to check. Codex reads only the `AGENTS.md` files on the chain from the repository root to the current working directory, so a nested one only helps when a session's working directory is inside `context/` itself — weaker, but still worth having, and it costs nothing extra. `context/CLAUDE.md` is a one-line `@AGENTS.md` import rather than a second copy of the same instruction, so there's exactly one canonical wording to maintain, following the same interop pattern the top-level `AGENTS.md`/`CLAUDE.md` relationship already uses.

Neither file carries a `keep-the-why:config` block — the project's config lives once, in `.keep-the-why`; a second copy anywhere else would be exactly the kind of contradictory, present-but-unrecognized state rule 14 already treats as needing a question, not a convenience.

Worth naming plainly what this buys and what it doesn't: a nested `CLAUDE.md`/`AGENTS.md` guarantees the instruction gets *injected into context* at the right moment — it doesn't guarantee compliance the way a technical block would. An agent can still, after reading it, choose to write to `context/` directly anyway. A hard, unconditional block would need something like a `PreToolUse` hook denying writes to `context/*.md` outside this skill's own flow — heavier, more script-like, and not something this project currently ships or recommends; the guard above is a strong, cheap nudge, not an enforcement mechanism.

## Personal preferences wizard (once per developer, once per project)

1. Ask the following one at a time, waiting for an answer before the next — this is the developer's very first activation on this project, so `confirmation-flow` (one of the things being asked here) isn't known yet, and `sequential` is its own documented default:
   - Capture proactively during normal conversation, or only when explicitly asked? Default: proactive.
   - When there's more than one thing to confirm at once — including these wizard questions themselves, from here on — do you want them one at a time or as a list you can review together? Default: one at a time.
   - Check for skill updates automatically? If yes, what interval (default: 14 days).
   - Check `context/` for staleness automatically? If yes, what interval (default: 30 days).
2. Write the answers to `~/.keep-the-why/<id>.md`, creating the `~/.keep-the-why/` directory first if it doesn't exist yet on this machine. No `.gitignore` entry needed — the file lives outside the project entirely, so it was never at risk of being committed in the first place.

Both wizards: offer the defaults as a fast path ("just use the defaults" should be a one-word answer, either for a single question or for everything remaining), but leave room for different choices, and record any deviation explicitly rather than leaving it implied. Bundling every question into one message is itself a `confirmation-flow: batch`-style presentation — it's a legitimate choice once that preference is actually known, not the default way of running either wizard.

## The confirmation model

Four independent settings, two different files (see rule 11 in `SKILL.md` for the rule itself; this section is the detail):

| Setting | Question it answers | Values | Where |
|---|---|---|---|
| `capture-mode` | When does the skill look for capture opportunities? | `proactive` \| `explicit-only` | `~/.keep-the-why/<id>.md` (personal) |
| `capture-confirmation` | Once something's found, does writing it need permission first? | `automatic` \| `confirm-always` \| `confirm-when-unsure` | `.keep-the-why` (project) |
| `confirmation-flow` | When more than one thing needs a response at once — pending entry confirmations, or a wizard's own questions — how is that presented? | `sequential` \| `batch` | `~/.keep-the-why/<id>.md` (personal) |
| `source-reference` | Does the skill actively ask for a related issue, ticket, or post-mortem link when recording an entry? | `always` \| `never` \| `filtered: <criteria>` | `.keep-the-why` (project) |

They're orthogonal. Proactive search plus always-ask is a valid, if chattier, combination; explicit-only plus automatic writing is equally valid — searching only on request, then not interrupting once asked. `source-reference` is independent of all three — it decides whether one extra question gets asked, not whether writing needs permission or how multiple pending items are presented.

### `capture-confirmation` values

- **`automatic`** — writes without asking permission, once Evidence (rule 2) and the proportionality gate (rule 13) already say an entry is warranted. This means *don't interrupt to ask permission*, not *don't ask at all* — see "Permission vs. clarification" below — and it never means guessing: evidence that's still genuinely unclear becomes `inferred` or `unknown`, exactly as rule 1 already requires, regardless of this setting.
- **`confirm-always`** — asks before every write, even an unambiguous one. Useful early on, or for a team that wants to review every `context/` change before it lands. A direct instruction that already names the specific change (e.g. "write that down in `sync.md`") counts as confirmation for that one change — don't ask again for something the user just explicitly asked for.
- **`confirm-when-unsure`** (default) — writes directly when Evidence and proportionality are clear; asks only when genuinely unclear whether or how something should be captured. This is the behavior the skill already had before this setting existed (see `continuous-capture.md`'s "'Low-effort' doesn't mean 'never ask'"), now named and configurable instead of only implicit.

### Permission vs. clarification

Two different kinds of question, and `capture-confirmation` only governs one of them:

- **Permission question** — "Should I write this down?" Governed entirely by `capture-confirmation`.
- **Clarifying question** — "Was the timeout from a provider limit or internal load?" A question about the *facts*, asked because a specific answer would meaningfully sharpen the Evidence. Always allowed, always independent of `capture-confirmation` — even in `automatic` mode. `automatic` means the skill doesn't ask for permission once it already has enough to write something honest; it never means the skill stops asking substantive questions that would improve what gets written.

A third kind sits alongside these two: a **source-lookup question** — "Is there an issue, ticket, or post-mortem for this?" It isn't permission (it doesn't ask whether to write anything) and it isn't a clarifying question about the rationale itself (the entry can be written and be entirely correct without ever getting an answer). Whether it gets asked at all is exactly what `source-reference` governs.

### `source-reference` values

- **`always`** — ask whether a related issue, ticket, PR, or post-mortem exists for every new `context/` entry, before writing it.
- **`never`** (default) — don't ask proactively. Source (rule 2) still gets recorded whenever it comes up on its own — this setting only controls whether the skill goes looking for one.
- **`filtered: <criteria>`** — ask only when the developer-defined criteria match the entry in question. Criteria are free text, recorded alongside the setting (e.g. `source-reference: filtered — only for entries in context/incidents.md and context/security.md`, or `filtered — only when Evidence would otherwise be inferred`) — not a fixed taxonomy the skill imposes. Interpret the stated criteria against each candidate entry; if a specific case is genuinely unclear against what's written, that's rule 14 ambiguity — ask which way it falls, don't silently guess either direction.

Whatever the setting, asking is never the same as requiring one to exist. "No, there's nothing tracking this" is a complete, valid answer — recording it as `**Source:** none — no tracked issue or ticket` (or simply omitting Source, since it was never mandatory per rule 2) is correct. Inventing a plausible-sounding ticket reference to satisfy `always` or a matched `filtered` criterion would violate rule 1 exactly the same way inventing rationale would.

`source-reference` doesn't have a personal override in this release, same reasoning and same "test one setting before adding a second axis" precedent as `capture-confirmation` — see `context/config-format.md`.

### Resolution order

An explicit instruction in the current session always wins. After that:

```text
session instruction → personal setting (~/.keep-the-why/<id>.md) → project setting (.keep-the-why) → documented default
```

Examples of session overrides: "just write everything down directly this session," "ask me before every entry today," "show me everything you found as one list," "only make suggestions, don't touch any files yet." A session override doesn't change the stored config unless the user explicitly says to update it — it's scoped to that conversation, not a silent edit to `.keep-the-why` or `~/.keep-the-why/<id>.md`.

A personal override for `capture-confirmation` isn't part of this release — it's project-wide only for now, deliberately, to see how it behaves in practice first (see `context/config-format.md` for why). The resolution order above already leaves room for one later: a personal `capture-confirmation` field in `~/.keep-the-why/<id>.md` would simply slot in between session instruction and the project setting, same pattern as `migration-prompt: <version> declined`.

### `confirmation-flow` values

- **`sequential`** — present one candidate, wait for the answer, then present the next:

    ```text
    Agent: I'd record that Redis is deliberately used as a cache only. OK?
    User: Yes.

    Agent: The decision against Redis persistence I'd document separately. OK?
    User: No.
    ```

- **`batch`** — present several candidates as a short numbered list, then let the user confirm all, reject all, or pick individual numbers:

    ```text
    Agent: I found three things worth recording:

    1. Redis is deliberately used as a cache only.
    2. Persistence was rejected because of recovery complexity.
    3. The TTL value comes from a previous provider limit.

    Should I record all of these, or do you want to exclude any numbers?
    ```

Only confirmed items get written either way. `confirmation-flow` changes nothing about *whether* confirmation is needed — that's `capture-confirmation` — only how it looks once more than one confirmation is pending at the same time.

The same two shapes apply to a wizard's own questions, not just candidate `context/` entries — `sequential` means one question, an answer, then the next; `batch` means the whole question list in one message, the way both wizards used to work unconditionally before this setting existed.

### Scope: all four modes

`capture-confirmation` and `confirmation-flow` apply everywhere the skill is about to write to `context/`, not just continuous capture:

- **Continuous capture** — the usual case: a decision lands mid-conversation, the settings decide the confirmation step before it's written.
- **Retrospective recovery** — once the agent reconstructs a candidate rationale from git history or issues, the same settings apply before it's written. This mode routinely surfaces several candidates from one pass, which is exactly what `confirmation-flow` decides how to present — `sequential` walks through them one at a time, `batch` presents them together; both are equally valid, whichever the developer set.
- **Knowledge-transfer interview** — free narration doesn't get written down unfiltered. The agent still extracts decision-forks, classifies Evidence and checks proportionality for each one, and *then* the same confirmation settings apply per candidate before anything lands in `context/`, exactly as configured — a live dialogue doesn't change which `capture-confirmation` value applies.
- **Maintenance** — resolving contradictions, marking something superseded, splitting a file: the same settings apply before the change is written. `automatic` here never means silently deleting, reinterpreting, or replacing already-confirmed historical information with weaker evidence (rule 11) — maintenance touches existing, previously-confirmed entries, which deserves at least the same scrutiny a new entry gets.

`source-reference` follows the same scope for the three modes that produce genuinely new entries (continuous capture, retrospective recovery, knowledge-transfer interview) — `always` or a matching `filtered` criterion means the source-lookup question is part of recording the candidate, regardless of which mode surfaced it. Maintenance usually doesn't trigger it, since it isn't originating new rationale to source — though adding a missing Source to an already-existing entry during maintenance is the same source-lookup question, on the same terms.

### Missing fields vs. invalid fields — not the same case (rule 14)

**Missing entirely:**

- `capture-confirmation` absent from an existing project's config → backfill to `confirm-when-unsure` the next time the setup check runs, silently. This is legitimate precisely because it's a documented default for a field that doesn't exist yet, and it's already the project's actual behavior today — nothing changes, so there's nothing to ask about.
- `source-reference` absent from an existing project's config → same reasoning, backfill to `never` silently. It's a new question the skill didn't used to ask at all, so "never ask it" is the accurate description of prior behavior, not a guess.
- `confirmation-flow` absent from an existing personal file → this is *not* the same situation, even though it looks similar. There's no prior behavior to preserve, since this axis didn't exist before the setting did. Ask the same one-line question the personal wizard already asks ("one at a time, or as a list?"), once, and record the answer — don't default it silently just because it's convenient to treat it like `capture-confirmation`'s case.

None of these touches the `context/` entry *format*, so none needs the migrate-now/defer/decline flow below — the field is silently backfilled to its documented default either way, since that default already describes the project's actual prior behavior. They're still worth a line in `migrations.md` when the field is added, purely informational ("added in version X, silently backfilled to Y, no action needed"), so the file stays a complete record of what changed per version rather than only the subset that happens to need a prompt.

**Present but invalid, or contradictory:** a field that exists with a value outside the documented set (`confirmation-flow: grouped`), or one recorded more than once with different values, is never treated as if it were missing. Don't guess which value was intended, don't silently apply the documented default, and don't pick one of the conflicting values on your own — even if one looks more "obviously right." Instead:

1. Say plainly that the stored value isn't recognized (or that the values conflict).
2. Name the actual valid options.
3. Ask which one is meant.
4. Don't take any action whose behavior depends on that setting until it's answered — including writing to `context/` if `capture-confirmation` is the field in question.

A likely typo (`confirmation-flow: sequental`) can be named as a probable guess — "did you mean `sequential`?" — but still needs the user's actual confirmation before the config is corrected or anything proceeds on that assumption. Guessing correctly by luck isn't the same as asking, and doesn't get to skip the question rule 14 requires.

This same principle covers ambiguous session instructions, not just config fields: "don't keep asking me, but don't decide anything on your own either" doesn't resolve to any single `capture-confirmation` value — it's internally in tension, not a request for `confirm-when-unsure` or any other specific mode. Point out the tension and ask what's actually wanted, rather than picking the reading that seems closest.

## Timer check (every session, for whoever has a personal config)

Two independent timers, both opportunistic — checked when the skill is already active in a session, not on any real background schedule (skills don't run outside a session):

**Update check.** If `update-check` is enabled and the interval has elapsed since `last`: compare the installed `metadata.version` (`SKILL.md` frontmatter) against the latest release's `tag_name`. Query the GitHub API, not the HTML releases page — turn `metadata.repository` (also frontmatter) into an API URL by replacing `github.com/` with `api.github.com/repos/` and appending `/releases/latest`, e.g. `https://api.github.com/repos/oliver-zehentleitner/keep-the-why/releases/latest`. Returns clean JSON (`tag_name`, `published_at`, ...) instead of requiring the agent to parse an HTML redirect. This needs the agent's own web access — the skill itself has none (see "What this skill is not"). Normalize both sides before comparing — strip a leading `v` from the tag, and compare as semantic versions (`0.9.0` < `0.10.0`), not as strings or floats.

`last` only advances on a check that actually completed (found "up to date" or found a newer version) — not on an attempt that couldn't run at all. That's what makes "keep retrying" and "the interval controls how often this runs" both true at once: a successful check waits out the full interval before trying again; a failed attempt leaves `last` untouched, so the *next* session tries again regardless of how much of the interval has passed.

If checking isn't possible (no web access this session): don't fail silently forever, and don't re-ask about the same ongoing failure every single session either. The first time an attempt fails, say so and ask how to handle it — keep retrying next session, or turn `update-check` off. Record the answer as a third field, e.g. `- update-check: every 14 days — last: 2026-07-08 — on-failure: retry-quietly`. `on-failure` starts unset (meaning: ask, the first time it's needed); once set to `retry-quietly`, keep attempting silently on future failures without asking again; if set to `disabled`, stop checking and drop `update-check` to `no`. `retry-quietly` describes how to handle *this* failing streak, not a permanent preference — once a check succeeds again, clear `on-failure` so a future failure asks fresh rather than staying quiet about an unrelated outage.

**Consistency check.** If `consistency-check` is enabled and the interval has elapsed: look for entries whose `Revisit when` condition (see `repository-structure.md`) has actually been triggered — not just entries that are merely old. Age alone isn't a defect; an untriggered old entry is still accurate. `context/index.md` only holds one-line summaries, not `Revisit when` conditions themselves (rule 8), so don't scope the search there — instead, grep under the project config's `context:` location (not a hardcoded `context/`, since the wizard lets that live elsewhere) for `**Revisit when:**` lines, and only open the topic files that actually match. Cheap, deterministic, no second index to keep in sync. If something's genuinely triggered, surface it and ask whether to address it now. Update `last` regardless of outcome.

Keep both checks quiet when there's nothing to report. The point is catching real drift, not adding a second source of noise on top of the problem this skill exists to solve.

## Context schema and migrations (every session, not interval-gated)

Unlike the two timers above, this isn't opportunistic on an elapsed interval — it's a plain version comparison, checked every session:

1. Compare the project config's `context-schema` against the installed skill's `metadata.version`.
2. **Missing entirely** (a project set up before this field existed): backfill it to `0.2.0` — the last version before any `context/` entry format changed — then continue to step 3 as normal.
3. **`context-schema` equal to `metadata.version`** → nothing to do.
4. **`context-schema` ahead of `metadata.version`** (an older skill running on a project set up or migrated by a newer one) → don't treat this like the equal case. Say so once, recommend updating the skill, and avoid writing to existing `context/` entries until it's resolved — an older skill may not correctly understand a newer entry format. This isn't something to migrate away from; it resolves itself once the skill is updated.
5. **`context-schema` behind `metadata.version`** → check whether the personal config already has `migration-prompt: <version> declined` for this exact target version (see below). If so, skip straight to step 6 without asking again. Otherwise check `references/migrations.md` for entries between the two. If none apply, or every applicable entry is purely informational (e.g. a config field silently backfilled to a default — see "Missing fields vs. invalid fields" above), just advance `context-schema` to match `metadata.version`, applying any informational entry's default along the way — no prompt needed. If at least one applicable entry actually requires doing something to the project (a `context/` entry-format change, a structural convention like `context/index.md`'s sort order, or a storage-location migration like the move to `.keep-the-why`): explain what changed and what migrating would involve, then ask whether to migrate now, defer to next session, or stop being asked about this particular version.
   - **Now** → apply the migration steps from `migrations.md` — to the affected `context/` entries, to `context/README.md` itself where a step calls for that (e.g. keeping its "Reading the entries" list in sync with the current field set), and to the project's own state storage where a step calls for that — then advance `context-schema` to `metadata.version`. This is a project-wide fact once done — `context-schema` lives in the committed `.keep-the-why`, not a personal file.
   - **Defer to next session** → leave `context-schema` as is and ask again next session; don't silently drop the question.
   - **Stop asking me** → this is personal, not a project decision: `context/` (or the project's own storage) itself stays unmigrated either way, but *this developer* doesn't want the prompt again for this specific version. Record `migration-prompt: <version> declined` in the personal file (`~/.keep-the-why/<id>.md`), where `<version>` is the target version just declined (e.g. `0.3.0`), not a blanket "never ask again." Other developers without that line still get asked normally, and if a *later* version introduces another migration (e.g. 0.4.0), that's a new prompt this developer sees too.
6. Once migrated (or the prompt is suppressed for this developer), proceed with the rest of the setup check as normal.

When a migration touches an existing entry that doesn't have enough information to fill in a new field confidently (e.g. an old entry marked only "Superseded" with no separate Evidence value recorded) — don't guess. Set the new field to `unknown` and flag the entry for review, consistent with rule 1.
