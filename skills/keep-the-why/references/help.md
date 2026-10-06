# What Keep the Why is, and what you can ask for

Read this before answering someone who asks what Keep the Why is, how it works, or what they can ask the agent to do. Answer from it briefly, in the person's words, and fit the answer to where this project stands: not set up yet → setting up comes first; set up → filling and keeping it current. List the sentences, don't recite this file.

## What Keep the Why is

The why layer of a repository's memory: the reasoning code cannot explain — decisions, rejected alternatives, workarounds, incidents, constraints — kept as plain Markdown in `context/`, next to the code. Not what changed (that is a changelog's job), only why. Git versions it, review happens in the same pull request as the code, and every agent and person with access to the repository reads the same files.

It is built from these parts:

| Part | What it is | Needed? |
|---|---|---|
| The format | `.keep-the-why` (the project's settings) and `context/` (one Markdown file per topic, a lean `index.md`, entries with Id, Type, Status, Evidence) — an open specification, readable without any tool | yes — it is what the skill writes |
| This skill | the instructions that make an agent capture, find, read and maintain the reasoning | yes — the one part a project needs |
| `keep-the-why-lint` | a linter for the structure (fields, values, index), in CI and locally after each write | optional |
| `keep-the-why-dashboard` | a read-only viewer: graph of topics and citations, each entry with its Git history, what still needs a person; locally or published on the project's site | optional |
| The registry and the globe | a list of projects with a published dashboard, and the globe that walks the citations between them | optional |

No database, no service, no account, no telemetry; MIT licensed; works with any agent that reads skills. The quality of the entries depends on the model running the skill: the format and the linter keep the structure, the model decides what it recognizes as a reason and how well it writes it down. The agent is the interface: everything above is one sentence away. Documentation: https://keepthewhy.com.

**How it works day to day:** once set up, the skill loads at the start of every session (autostart). It records the reasoning as it comes up in normal work — including a change that was started and then dropped — and asks only when it is unsure whether or how to record something. Before changing something, the agent reads what `context/` already says about it.

## What you can say

**Set up**

| Say | What happens |
|---|---|
| "Install the Keep the Why skill — pick the best installation method for you from https://keepthewhy.com/installation/ — then set up Keep the Why in this project with default settings, including autostart." | installs the skill and sets the project up in one go |
| "Set up Keep the Why here." | the setup, with the settings shown as one list first |

**Fill it** — what the project already knows

| Say | What happens |
|---|---|
| "Go through the git history, pull requests, issues and existing docs, and collect the reasoning that is already there into `context/`." | a retrospective pass; what cannot be backed up is marked `unknown`, never made up |
| "Interview me about this project — ask about what the code can't explain." | targeted questions about the gaps found in the repository |
| "I'll tell you about this project — listen, and record the decisions." | free narration; the decisions and their alternatives are extracted |
| "Check `context/` for entries that are stale or contradict the code." | maintenance: contradictions surfaced, superseded entries marked, oversized files split |

**Keep it current** — two sentences, in two sessions; a project that pins its own copy updates that copy instead

| Say | What happens |
|---|---|
| "Update the Keep the Why skill to the latest release." | re-runs the install command the skill came with; the new version loads from the next session on |
| "Migrate this project to the installed Keep the Why version." | applies what the migrations list between the project's `context-schema` and the skill's version, asking where a step needs a decision |
| "Pin this project to the Keep the Why version installed here." | copies the skill into the project and writes `pinned-version` and `pinned-path` to `.keep-the-why`: every session follows that copy, whatever version is installed on the machine (`references/setup.md`, "Pinned versions") |
| "Update this project's pinned Keep the Why copy to the latest release." | replaces the copy and moves `pinned-version`; migrating the project follows in the next session, as above |

**Optional components** — offered, set up only when asked

| Say | What happens |
|---|---|
| "Set up the Keep the Why linter as a GitHub workflow." | the structure is checked on every push and pull request |
| "Publish the Keep the Why dashboard on GitHub Pages." | the project's own dashboard and live badge; one repository setting stays the person's (Pages source: GitHub Actions) |
| "List this project in the Keep the Why registry." | a one-line pull request, so every published dashboard's globe can find the project |

**Settings and questions**

| Say | What happens |
|---|---|
| "Anything waiting for confirmation?" | lists entries written while nobody was there to confirm them |
| "Ask me before recording anything." / "Record without asking when it's clear." | changes how much confirmation is needed (`capture-confirmation`) |
| "Why is this built this way?" (about any part of the code) | the agent looks in `context/` first and says what is recorded — or that nothing is |
| "How can I look at what has been recorded?" | the dashboard: `pip install keep-the-why-dashboard`, then `ktw-dashboard` in the project |
| "Something about Keep the Why doesn't work as described." | the issue tracker: https://github.com/oliver-zehentleitner/keep-the-why/issues/new/choose |
