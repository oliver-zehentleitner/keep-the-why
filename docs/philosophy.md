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

> No daemon. No database. No dashboard. Just Markdown, Git, and the why your project would otherwise lose.

Every one of those absences is a deliberate choice, not a missing feature:

- **No database** — `context/` is files. Anything that can read a repository can read it; nothing needs a driver, a schema migration tool, or a running service to open it.
- **No daemon** — nothing runs in the background, watching for changes or making decisions on its own. The skill acts when an agent session is active, using it, and stops when the session ends. This isn't only an infrastructure preference: a CI/CD step running after code is pushed is already too late. The reasoning that matters — the alternative that was considered, the constraint that surfaced, the reason a workaround exists — happened earlier, in the conversation with the coder or agent doing the work. CI has no way to reconstruct what was never written down; it can check that a `context/` entry exists, not invent one. Capturing it has to happen where the reasoning actually occurs, not as a downstream check on the result.
- **No dashboard** — there's nothing to log into, and nothing that only lives behind a UI. The information a dashboard would show is the same information sitting in the files themselves.
- **No account, no vendor lock-in** — the format is plain Markdown under a project's own version control. Moving to a different agent, or no agent at all, doesn't strand anything.
- **No second synchronization problem** — `context/` versions, branches, merges, and reverts exactly the way the code around it does, because it's committed alongside it, not synced to it from somewhere else.

This isn't minimalism for its own sake. Each thing not built is one less thing that can be down, one less account to manage, one less format only one tool understands, and one less reason the "why" ends up trusted less than the code sitting right next to it.

## What this means for scope

A project's why-knowledge is a narrow enough problem that it doesn't need a platform. Keep the Why is not, and isn't trying to become:

- a project management or task-tracking system
- an agent activity feed or session recorder
- a workflow or orchestration framework for agents
- a dashboard or a cloud service
- a full development framework

Staying a small, composable piece — one skill, one job — is what keeps it usable alongside whatever else a project or a team already relies on, instead of asking anyone to replace it.

## Where the structure goes from here

The current shape of `context/` — Evidence and Status as separate axes, topic files over one-file-per-decision, continuous capture alongside retrospective recovery and interviews — is a well-reasoned starting point, not a claim that it's the final, optimal structure. It gets refined by real use and real feedback, not by adding features on a schedule. The goal is a stable, trustworthy methodology, not a growing feature list.

> Keep the Why is a small, repository-native skill that preserves the reasoning behind software decisions for humans and AI agents. It does not introduce a new platform, database, daemon, dashboard, or workflow. It uses Markdown and Git, so versioning, synchronization, review, collaboration, and long-term ownership come from infrastructure the project already has. Its scope is deliberately narrow: preserve the why, structure it reliably, and improve that structure through real-world use and feedback.
