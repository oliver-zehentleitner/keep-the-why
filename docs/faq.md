# FAQ

**Is this affiliated with Keep a Changelog?**
No. The name is a deliberate homage to [keepachangelog.com](https://keepachangelog.com/) — same naming pattern, same spirit of "a lightweight open convention, not a platform" — but there's no official relationship and no shared code or governance.

**Does this replace tests, docs, or a changelog?**
No — see the README's "Where this fits" table (on the [Overview](index.md) page). Keep the Why only covers the "why" layer. Tests, usage docs, and Keep a Changelog each answer a different question and none of the four is optional just because you have the others.

**How is this different from an ADR (Architecture Decision Record)?**
ADRs are typically human-authored, written at a discrete decision point, one file per decision, and treated as frozen once accepted. Keep the Why is continuous and agent-authored from the conversation itself, organized by topic rather than by decision, and entries are living — updated and marked superseded rather than replaced by a new file. See [Methodology](methodology.md) for the full reasoning.

**How is this different from git-why, AgDR, or similar projects?**
They're real prior art and worth using too — see the README's "Not a green field" section for specifics. Keep the Why's distinguishing combination is continuous capture *and* retrospective recovery *and* code-guided interviews, organized as topic-indexed living docs, with no required external service.

**Does this require a database, MCP server, or network access?**
No. Everything is plain Markdown files committed to the repository.

**Does it guarantee nothing gets lost?**
No — see "What this is not" in the [Overview](index.md) and in `SKILL.md`. Quality depends on what actually gets captured. This reduces the problem, it doesn't eliminate it.

**What if my project already has a documentation structure I like?**
Keep the Why is meant to adapt to what exists, not replace a working structure with a fixed template. See [Repository structure](repository-structure.md), "Retrofitting an existing project."

**Is this specific to Claude Code?**
The skill format (SKILL.md with YAML frontmatter) is used by Claude Code and is compatible with other agent tools that support the same format. The documentation structure it produces (`AGENTS.md`, `docs/`, `context/`, `AGENTS.local.md`) is plain Markdown and tool-agnostic by design.
