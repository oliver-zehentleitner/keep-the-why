# Installation

Keep the Why is a [SKILL.md](https://code.claude.com/docs/en/skills)-based agent skill. No build step, no external service, no database, no MCP server.

## Project-scoped

Available to anyone working on a specific repository, checked in alongside the code:

```bash
mkdir -p .claude/skills
git clone https://github.com/oliver-zehentleitner/keep-the-why.git .claude/skills/keep-the-why
```

## Personal

Available across all your projects:

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git ~/.claude/skills/keep-the-why
```

Start a new Claude Code session afterward so the skill is picked up.

## Updating

```bash
cd .claude/skills/keep-the-why   # or ~/.claude/skills/keep-the-why
git pull
```

## Verifying it loaded

Start a session in a project where the skill is installed and ask something that should trigger it, e.g. "why does this workaround exist, and can you document it?" If it doesn't seem to activate, double-check that `SKILL.md` sits directly inside the skill folder (not nested deeper) and that the folder name matches `name: keep-the-why` in the frontmatter exactly.
