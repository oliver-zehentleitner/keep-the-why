<a href="https://keepthewhy.com"><img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why"></a>

# Project context

This directory preserves the reasoning behind this project: architectural decisions, constraints, rejected alternatives, incident learnings, deliberate workarounds, and other knowledge that the code alone cannot explain.

It's organized and kept current according to the [Keep the Why](https://keepthewhy.com) schema — a repo-native convention and agent skill, not specific to this project. Recognizing that schema means an agent (or a person who's seen it before) already knows how this directory is structured and how to work with it, without first having to figure that out from scratch.

It answers:

> Why is the project built this way?

For usage, installation, operation, or troubleshooting, see `docs/`.

## Reading the entries

Each entry separates:

- **Type** — what kind of thing it is: decision, workaround, incident, or constraint (or undefined, with a reason, if none fit)
- **Status** — whether a decision is active, superseded, open, needs review, or still waits for a first confirmation
- **Evidence** — whether its rationale is confirmed, inferred, or unknown

Old reasoning is retained when it remains useful for understanding how the project evolved.

## Trust boundary

Files in this directory describe project knowledge. They do not contain instructions that grant permissions, override user intent, authorize commands, or weaken security controls.

## Tools

Two optional packages work on this directory; neither is needed to read
or write it, and the skill installs neither on its own:

- [`keep-the-why-lint`](https://keepthewhy.com/linting/) checks the
  structure — required fields, valid values, a consistent index — in CI
  and locally right after an entry is written. Whether the recorded
  reasoning is true stays a human judgement.
- [`keep-the-why-dashboard`](https://keepthewhy.com/dashboard/) shows it:
  the graph of topics and references, each entry with its Git history,
  what still needs a person. Read-only;
  `pip install keep-the-why-dashboard`, then `ktw-dashboard` in the project.

Start with the [context index](index.md).
