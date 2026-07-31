# FAQ

**Is this affiliated with Keep a Changelog?**
No. The name is a deliberate homage to [keepachangelog.com](https://keepachangelog.com/) — same naming pattern, same spirit of "a lightweight open convention, not a platform" — but there's no official relationship and no shared code or governance.

**Does this replace the README, docs, CONTRIBUTING.md, tests, or a changelog?**
No — see the README's "Where this fits" table (on the [Overview](index.md) page). Keep the Why only covers the "why" layer. Each of the others answers a different question and none of them is optional just because you have the others.

**How is this different from an ADR (Architecture Decision Record)?**
ADRs are typically human-authored, written at a discrete decision point, one file per decision, and treated as frozen once accepted. Their biggest weakness in practice was never the format — it's that writing one depends entirely on someone remembering to do it, under exactly the deadline pressure that makes people skip it first. Keep the Why is continuous and agent-authored from the conversation itself, so capturing the rationale isn't a separate disciplined act anymore — it's a byproduct of the conversation the agent is already having with you. Organized by topic rather than by decision, and entries are living — updated and marked superseded rather than replaced by a new file. See [Methodology](methodology.md) for the full reasoning.

**How is this different from other tools or skills that capture agent rationale?**
Several solve adjacent parts of this problem well. Rather than a name-by-name comparison that's incomplete the moment it's written and stale soon after, see the README's "Related work" section and [Philosophy](https://keepthewhy.com/philosophy/) for how Keep the Why draws its own boundaries: continuous capture, retrospective recovery, and knowledge-transfer interviews, plus ongoing maintenance of what's already there — organized as topic-indexed living docs rather than a shadow tree or one-file-per-decision, with no required external service.

**Does this require a database, MCP server, or network access?**
No. Everything is plain Markdown files committed to the repository.

**Could this run as a CI/CD check instead of during development?**
No — by the time code is pushed and CI runs, the reasoning that mattered (what was tried, what was rejected, why a workaround exists) has usually already happened and isn't recoverable from the diff alone. CI can check that a `context/` entry exists or is well-formed, but it can't invent rationale that was never captured. That's why this runs live, in the conversation with the coder or agent actually making the decision — continuous capture as it happens, or a retrospective/interview session that reconstructs from git history and people — not as a pipeline step reacting to already-finished work. See [Philosophy](philosophy.md), "No daemon."

**Does it guarantee nothing gets lost?**
No — see "What this is not" in the [Overview](index.md) and in `SKILL.md`. Quality depends on what actually gets captured. This reduces the problem, it doesn't eliminate it.

**Does the skill always interrupt me to ask before writing anything?**
Configurable, project-wide, via `capture-confirmation` in `AGENTS.md`: `automatic` (never asks permission, just writes once evidence and proportionality already support it), `confirm-always` (asks before every write), or `confirm-when-unsure` (the default, and what the skill already did before this setting existed — writes directly when things are clear, asks only when genuinely unclear). None of these change whether the skill asks a substantive question about the facts themselves, which stays independent of this setting even in `automatic` mode. See [Setup](setup.md), "The confirmation model."

**Does it link entries to a Jira/GitHub issue or post-mortem?**
It can, via `source-reference` in `AGENTS.md` (project-wide, default `never`): `always` asks whether a related issue, ticket, PR, or post-mortem exists for every new entry; `filtered: <criteria>` asks only when your own free-text criteria match (e.g. only for incident-related topic files). Either way, asking isn't the same as requiring one — "no reference exists" is a complete answer, never invented to fill the field. This is separate from rule 2's Source field itself, which could already hold a reference, just wasn't actively asked for before this setting existed. See [Setup](setup.md), "The confirmation model."

**Does this work alongside Superpowers or other methodology-style skills?**
It's designed to: Keep the Why is a cross-cutting persistence skill, not a workflow orchestrator, so it doesn't compete with a skill that governs brainstorming, planning, systematic debugging, TDD, or code review — that workflow runs first, and Keep the Why only preserves the rationale it produces. In live testing against a real methodology-style framework, this worked correctly once explicitly invoked, but didn't reliably self-trigger the moment a design decision settled mid-conversation — the other framework's own bootstrap held attention through its workflow without prompting a re-check for other skills. If a design or debugging session just concluded and nothing got proposed for `context/`, asking directly ("check whether keep-the-why applies here") is a reasonable, expected fallback, not a sign something's broken. See `context/compatibility.md` in the repo for the full test writeup, and [obra/superpowers#2051](https://github.com/obra/superpowers/issues/2051) for the upstream report.

**What if my project already has a documentation structure I like?**
Keep the Why is meant to adapt to what exists, not replace a working structure with a fixed template. See [Repository structure](repository-structure.md), "Retrofitting an existing project."

**Is this specific to Claude Code?**
No. The skill format (SKILL.md with YAML frontmatter) is an open standard supported by Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor, Windsurf, Antigravity, Amp, Cline, Goose, Roo Code, OpenCode, Trae, Factory, JetBrains Junie, Warp, and others — see [Installation](installation.md) for the current directory-path table. The documentation structure it produces (`AGENTS.md`, `docs/`, `context/`, `AGENTS.local.md`) is plain Markdown and tool-agnostic by design, so it isn't locked to any of them even as the list of supported tools changes.

**Does this work with DeepWiki?**
Yes, in the sense that matters — DeepWiki doesn't need to "support" Keep the Why explicitly, because it already ingests and cites a repo's existing Markdown (confirmed by checking a real DeepWiki page: it cited a repo's README with line-number references). A populated `context/` gives DeepWiki's analysis real rationale to cite instead of inferring everything from code. It won't necessarily preserve the Evidence/Status distinctions (confirmed/inferred/unknown, active/superseded/open/needs-review) in its own generated wiki, though, since that's a Keep the Why-specific convention it doesn't know about — see [Installation](installation.md#without-a-skill-compatible-agent).
