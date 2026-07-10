# Installation

Keep the Why is a `SKILL.md` file, following the open, cross-agent skill format — not tied to one vendor. No build step, no external service, no database, no MCP server.

## Where to put it

The folder name must stay `keep-the-why` (has to match `name` in the frontmatter). Clone it into whichever agent's skills directory applies:

| Agent | Project-scoped | Personal | Last verified |
|---|---|---|---|
| Claude Code | `.claude/skills/keep-the-why` | `~/.claude/skills/keep-the-why` | 2026-07-10 |
| Codex CLI | `.codex/skills/keep-the-why` | `~/.codex/skills/keep-the-why` | 2026-07-10 |
| Gemini CLI | `.gemini/skills/keep-the-why` | `~/.gemini/skills/keep-the-why` | 2026-07-10 |
| GitHub Copilot | `.github/skills/keep-the-why` | `~/.copilot/skills/keep-the-why` | 2026-07-10 |
| Cursor | `.cursor/skills/keep-the-why` | — (no personal directory) | 2026-07-10 |
| Cline | `.cline/skills/keep-the-why` | `~/.cline/skills/keep-the-why` | 2026-07-10 |

These paths change as agent tooling evolves — if one doesn't work, check the agent's current docs rather than assuming this table is still accurate. Several other tools (Antigravity, Amp, OpenCode, Warp, and more) read a shared `.agents/skills/keep-the-why` path at project scope instead of a vendor-specific one — check whether yours does before falling back to a vendor path. Also compatible with Windsurf, Goose, Roo Code, Trae, Factory, JetBrains Junie, and other tools supporting the open Agent Skills format — the directory convention varies, check your tool's own docs.

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git <target-directory>/keep-the-why
```

Start a new session afterward so the skill is picked up.

## Without a skill-compatible agent

`docs/` and `context/` (the structure the skill produces in *your* project — see [repository structure](repository-structure.md)) are plain Markdown — no skill runtime is required to read them. Anything that browses or indexes a repository works with the output directly, including read-only tools that never run the skill themselves — for example **[DeepWiki](https://deepwiki.com/)** (Cognition, the makers of Devin), which generates a browsable wiki for any public repo by analyzing its code *and* existing docs, citing them directly. A project with a populated `context/` gives DeepWiki (and anything like it) real rationale to cite instead of having to infer everything from code alone. The skill automates keeping this current; the result is still useful on its own even where the skill itself isn't installed anywhere.

## Updating

```bash
cd <target-directory>/keep-the-why
git pull
```

## Verifying it loaded

Start a session in a project where the skill is installed and ask something that should trigger it, e.g. "why does this workaround exist, and can you document it?" If it doesn't seem to activate, double-check that `SKILL.md` sits directly inside the skill folder (not nested deeper) and that the folder name matches `name: keep-the-why` in the frontmatter exactly.
