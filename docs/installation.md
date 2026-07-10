# Installation

Keep the Why is a `SKILL.md` file, following the open, cross-agent skill format — not tied to one vendor. No build step, no external service, no database, no MCP server.

## Where to put it

The folder name must stay `keep-the-why` (has to match `name` in the frontmatter). Clone it into whichever agent's skills directory applies:

| Agent | Project-scoped | Personal |
|---|---|---|
| Claude Code | `.claude/skills/keep-the-why` | `~/.claude/skills/keep-the-why` |
| Codex CLI | `.codex/skills/keep-the-why` | `~/.codex/skills/keep-the-why` |
| Gemini CLI | `.gemini/skills/keep-the-why` | `~/.gemini/skills/keep-the-why` |
| Cursor | `.cursor/skills/keep-the-why` | — (no personal directory) |

Some agents also honor a shared `.agents/skills/keep-the-why` path instead of a vendor-specific one — check your agent's own docs for whether it's supported; where it is, one copy covers every tool that reads it.

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git <target-directory>/keep-the-why
```

Start a new session afterward so the skill is picked up.

## Without a skill-compatible agent

`docs/` and `context/` (the structure the skill produces in *your* project — see [repository structure](repository-structure.md)) are plain Markdown — no skill runtime is required to read them. Anything that browses or indexes a repository (a wiki generator, a documentation site builder, or just a person reading the files on GitHub) works with the output directly. The skill automates keeping this current; the result is still useful on its own even where the skill itself isn't installed.

## Updating

```bash
cd <target-directory>/keep-the-why
git pull
```

## Verifying it loaded

Start a session in a project where the skill is installed and ask something that should trigger it, e.g. "why does this workaround exist, and can you document it?" If it doesn't seem to activate, double-check that `SKILL.md` sits directly inside the skill folder (not nested deeper) and that the folder name matches `name: keep-the-why` in the frontmatter exactly.
