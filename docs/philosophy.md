# Philosophy

## One job, done with what's already there

Keep the Why solves one narrowly scoped problem: preserve the reasoning behind technical decisions — what was tried, what was rejected, what constraints came from outside the code — so it survives past the conversation that produced it.

It doesn't build new infrastructure to do this. It connects things a project already has:

- the reasoning that comes up while working with an agent
- Markdown
- the repository's existing structure
- Git history
- branches and pull requests
- code review
- the coding agent already in use
- the humans who read the repository

Nothing here is a parallel system living beside the project. It's a way of using what's already there for one purpose that wasn't covered yet.

## Why simple

> No daemon. No database. No account. Just Markdown, Git, and the why your project would otherwise lose.

Every one of those absences is a deliberate choice, not a missing feature:

- **No database** — `context/` is files. Anything that can read a repository can read it; nothing needs a driver, a schema migration tool, or a running service to open it.
- **No daemon** — nothing runs in the background, watching for changes or making decisions on its own. The skill acts when an agent session is active, using it, and stops when the session ends. This isn't only an infrastructure preference: a CI/CD step running after code is pushed is already too late. The reasoning that matters — the alternative that was considered, the constraint that surfaced, the reason a workaround exists — happened earlier, in the conversation with the coder or agent doing the work. CI has no way to reconstruct what was never written down; it can check that a `context/` entry exists, not invent one. Capturing it has to happen where the reasoning actually occurs, not as a downstream check on the result.
- **Nothing lives behind a UI** — there's nothing to log into, and no screen that holds information the files don't. There *is* a dashboard, and it is the test of this sentence rather than an exception to it: `keep-the-why-dashboard` reads `context/` and the Git history and draws them — who recorded what, when a status changed, what still needs a person — for as long as you look, and holds nothing the repository doesn't. Close it and nothing is gone.
- **No account, no vendor lock-in** — the format is plain Markdown under a project's own version control. Moving to a different agent, or no agent at all, doesn't strand anything.
- **No second synchronization problem** — `context/` versions, branches, merges, and reverts exactly the way the code around it does, because it's committed alongside it, not synced to it from somewhere else.

This isn't minimalism for its own sake. Each thing not built is one less thing that can be down, one less account to manage, one less format only one tool understands, and one less reason the "why" ends up trusted less than the code sitting right next to it.

Two tools do exist, and they are the exceptions that show where the line is. `keep-the-why-lint` checks the *structure* of what was written — required fields, valid values, a consistent index — in CI after a push, or locally right after the agent wrote an entry. It runs and exits. It holds no state, needs no service, captures nothing, and nothing in the format depends on it; a project that never runs it is a complete Keep the Why project. It exists because the one part of this that *can* be deterministic should be: an agent will get a field name wrong now and then, and "the reasoning is preserved" should not rest on nobody noticing. The why itself still comes from the conversation; the linter only guarantees that what came out of it has the shape a later reader — human or agent — can rely on. [`keep-the-why-dashboard`](dashboard.md) is the same kind of thing for reading: a viewer over the files and the Git history, served on your machine while you look or exported as one static page, never a place where anything is entered or kept. Both are optional, both are one `pip install` away, and the format depends on neither.

## What this means for scope

A project's why-knowledge is a narrow enough problem that it doesn't need a platform. Keep the Why is not, and isn't trying to become:

- a project management or task-tracking system
- an agent activity feed or session recorder
- a workflow or orchestration framework for agents
- a cloud service, or a UI that becomes the place where reasoning lives — the dashboard it ships reads; it does not hold
- a full development framework

Staying a small, composable piece — one skill, one job — is what keeps it usable alongside whatever else a project or a team already relies on, instead of asking anyone to replace it.

## Where the structure goes from here

The current shape of `context/` — Evidence and Status as separate axes, topic files over one-file-per-decision, continuous capture alongside retrospective recovery and interviews — is a well-reasoned starting point, not a claim that it's the final, optimal structure. It gets refined by real use and real feedback, not by adding features on a schedule. The goal is a stable, trustworthy methodology, not a growing feature list.

> Keep the Why is a repo-native convention and agent skill that preserves the reasoning behind software decisions, for humans and AI agents alike. It introduces no new platform, database, daemon, account, or workflow — it uses Markdown and Git, so versioning, synchronization, review, collaboration, and long-term ownership come from infrastructure the project already has; its linter and its dashboard read that Markdown and Git and hold nothing of their own. Its scope is deliberately narrow: preserve the why, structure it reliably, and improve that structure through real-world use and feedback.
