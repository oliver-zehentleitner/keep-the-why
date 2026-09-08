# Repository structure

Where things go: the default layout, which file a piece of knowledge belongs in, what the entry-point file looks like, and how to adopt this in a project that already has documentation. What each file must contain — fields, values, grammar, with examples — is `specification.md`.

## Default layout

```text
project/
├── AGENTS.md
├── AGENTS.local.md          # not committed
├── .keep-the-why             # this skill's own project config, committed
├── docs/
│   ├── index.md
│   ├── setup.md
│   ├── usage.md
│   ├── testing.md
│   └── troubleshooting.md
└── context/
    ├── README.md              # short, GitHub renders it when someone browses the folder cold
    ├── AGENTS.md               # guard: invoke this skill before editing, don't hand-write the schema
    ├── CLAUDE.md               # @AGENTS.md import
    ├── index.md
    ├── architecture.md
    ├── <topic>.md            # one per recurring theme, named for the theme, not the file it touches
    └── incidents.md
```

This skill's own personal config lives at `~/.keep-the-why/<id>.md`, outside the project entirely — never part of the repo, not shown above. See `references/setup.md`.

Adjust freely. A one-file script doesn't need six `docs/` files. `context/` stays flat — no subdirectories — even for a large project; if topic files alone stop scaling, namespace filenames instead (e.g. `auth-tokens.md` and `auth-oauth.md`, or `tokens-auth.md` and `oauth-auth.md` — prefix or suffix, whichever groups and sorts more usefully for that project) rather than nesting `context/auth/`. The shape should track the project's actual complexity, not a template.

## Which file does this belong in?

A project accumulates several files that all explain *something*: README, `docs/`, `CONTRIBUTING.md`, `context/`, `AGENTS.md`, `AGENTS.local.md`, and often a separate `CHANGELOG.md` (Keep the Why doesn't generate this one, but routing decisions still need to account for it). Content ending up in the wrong one — or copied into more than one — is exactly the kind of redundancy this skill should prevent, not add to.

The routing question is always **who is reading this, and what do they need to do next**:

| File | Reader | Question it answers |
|---|---|---|
| `README.md` | Someone evaluating whether to use this at all | What is this, should I care, how do I get started |
| `docs/` | Someone actively using it | How do I configure, operate, or troubleshoot this |
| `CONTRIBUTING.md` | Someone about to change the code | How do I set up a dev environment, what are the conventions, how does a PR get reviewed |
| `context/` | Anyone (human or agent) about to change something and needing to know why first | Why is this built the way it is, what was tried and rejected |
| `CHANGELOG.md` | Someone tracking what changed between versions | What changed, in which release |
| `AGENTS.md` | Any agent working in the repo | Where to look — a pointer, not the content itself |
| `AGENTS.local.md` | This one specific developer | Personal, local, not relevant to anyone else |

When recording something, resolve it to exactly one of these — then have every other file that would naturally mention it *point* to that one, not restate it. A README's contributing section should be a one-line link to `CONTRIBUTING.md`, not a partial copy of its dev-setup steps; `docs/installation.md` (for end users installing a release) and `CONTRIBUTING.md`'s dev-setup section (for contributors setting up from source) can overlap in steps without one having to explain the other's context — link between them if the overlap is substantial enough that keeping both in sync matters.

**An embedded procedure isn't why-content, even when it surfaces alongside a real decision.** A `context/` entry can legitimately explain *why* something is true (a platform limitation, a constraint) while also carrying a *workaround* for it — but the workaround itself ("if X, do Y") is an instruction, not rationale, and belongs wherever the table above already routes instructions (`CONTRIBUTING.md` for a dev/maintainer procedure, `docs/` for an end-user one), not inside the `context/` entry. The same split applies to a rule that has no rationale behind it at all — "keep the CHANGELOG's headings deduplicated," "sort these alphabetically because it reads cleaner" — record the rule where its reader needs it (`AGENTS.md` if it's something an agent working in the repo should just follow, `CONTRIBUTING.md` if it's aimed at contributors); don't manufacture a Decision/Reason/Rejected-alternative structure for a preference that has none.

When something genuinely doesn't fit the table above (e.g. security disclosure process, a code of conduct), that's a signal it's a different kind of artifact — governance or legal, not comprehension — and outside what this skill routes for. Don't force it into `context/` just because there's nowhere else obvious to put it.

## `AGENTS.md` — example

```markdown
# AGENTS.md

- Usage docs: see `docs/index.md`
- Why things are the way they are: see `context/index.md`
- If `AGENTS.local.md` exists in this repo, read that too — personal/local notes.

Read `context/index.md` before making non-trivial changes to understand
prior decisions and avoid re-litigating or accidentally reverting them.
```

Keep `AGENTS.md` short. Anything longer belongs in `docs/` or `context/`, not here — `AGENTS.md` needs to stay generic enough for every tool that reads the open AGENTS.md convention, not just this skill. It doesn't carry this skill's config block, or even a pointer to it — that lives entirely in `.keep-the-why` instead (see below), so `AGENTS.md` stays that generic, tool-agnostic pointer with nothing skill-specific baked into it at all. Whether and how a project mentions Keep the Why to a human reading `AGENTS.md`, a README, or anywhere else is that project's own editorial call — not something this skill writes in on its own; see the badge question in `setup.md`'s project init wizard.

## Retrofitting an existing project

When a project already has documentation that doesn't match this shape:

1. Don't restructure everything at once. Start by adding a `context/` layer next to whatever `docs/` already exists — unless the project already keeps decision records somewhere (item 3): then that folder *is* the location, named as such in the wizard, and no parallel `context/` is created beside it.
2. Migrate content only when touching it anyway, not as a dedicated big-bang pass.
3. If the existing structure is already good (clear, current, distinguishes how from why in some other way), don't replace it just to match this template. Adapt this methodology to it instead — new entries this skill writes there follow its own field set; existing records keep their own format until touched for another reason (item 2) and don't get retro-tagged with `Type`/`Status`/`Evidence` as a setup step.
