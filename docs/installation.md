# Installation

Keep the Why is a `SKILL.md` file, following the open, cross-agent skill format — not tied to one vendor. No build step, no external service, no database, no MCP server.

## Trust and scope

Before installing anything that runs inside an agent, know what you're actually getting:

- **No executable code.** The skill package (`skills/keep-the-why/`) is instructions only — `SKILL.md`, `references/*.md`, `examples/*.md`, `evals/evals.json`. No scripts, no binaries.
- **No network access of its own.** There's nothing to run, so there's nothing that calls out anywhere. Whatever network access exists is your agent's own, not something this skill adds.
- **No external services.** No database, no MCP server, no account, no API key.
- **Install a tagged release, not `main`.** `main` is where active development happens and isn't guaranteed release-ready at any given moment — installing without pinning tracks it directly. A `latest` tag always points to the newest release, moved automatically by CI whenever one ships. Every install method below shows how to pin to it (or to an exact version, for full reproducibility).
- **Updating is explicit**, never automatic — see "Updating" below.

None of that substitutes for actually reading `SKILL.md` yourself before installing — see "Recommended: GitHub CLI" below for `gh skill preview`, which lets you do exactly that.

## Recommended: skills CLI

With [`skills`](https://skills.sh/) (runs via `npx`, requires [Node.js](https://nodejs.org/en/download) — `npx` ships with it, no separate install step), pinned to a release via a GitHub tree URL:

```bash
npx skills add https://github.com/oliver-zehentleitner/keep-the-why/tree/latest/skills/keep-the-why
```

Replace `latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) (e.g. `v0.1.0`) to pin to a specific version instead of always the newest. The plain shorthand form tracks `main` directly instead:

```bash
npx skills add oliver-zehentleitner/keep-the-why
```

Either form prompts for which of its 70+ supported agents (Claude Code, Codex, OpenCode, and more) and scope (project or personal) to install for, then installs via symlink or copy, your choice. Also listed on [skills.sh](https://skills.sh/oliver-zehentleitner/keep-the-why/keep-the-why).

## Also recommended: GitHub CLI

With [`gh`](https://cli.github.com/) v2.90.0 or later — `gh skill` is [in public preview](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) and subject to change:

```bash
gh skill preview oliver-zehentleitner/keep-the-why keep-the-why
```

GitHub's own guidance: skills aren't verified by GitHub and may contain prompt injections, hidden instructions, or malicious scripts — inspect before installing. Keep the Why ships instructions only, no executable scripts. Then, pinned to a release:

```bash
gh skill install oliver-zehentleitner/keep-the-why keep-the-why@latest
```

Replace `latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) (e.g. `v0.1.0`) to pin to a specific version instead of always the newest (`--pin latest` / `--pin v0.1.0` work the same way, as a flag instead of a suffix). Dropping the version tracks `main` directly:

```bash
gh skill install oliver-zehentleitner/keep-the-why keep-the-why
```

Either form prompts for which agent and scope (project or personal) to install for, and installs only the skill package (`skills/keep-the-why/` in this repo) — not the whole repository. Run `gh skill install --help` for non-interactive flags.

## Fallback: manual clone

If neither CLI is available. The skill lives under `skills/keep-the-why/`, not at the repo root — clone to a scratch location and copy just that folder, rather than cloning the whole repo straight into your agent's skills directory (which would nest an embedded git repository inside yours and pull in docs/, mkdocs config, and CI files you don't need). Pinned to a release:

```bash
git clone --branch latest https://github.com/oliver-zehentleitner/keep-the-why.git /tmp/keep-the-why
cp -r /tmp/keep-the-why/skills/keep-the-why <target-directory>/keep-the-why
rm -rf /tmp/keep-the-why
```

Replace `latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) (e.g. `v0.1.0`) to pin to a specific version instead of always the newest. Dropping `--branch latest` clones `main` directly instead.

The folder name must stay `keep-the-why` (has to match `name` in the frontmatter). `<target-directory>` is whichever agent's skills directory applies:

| Agent | Project-scoped | Personal | Last verified |
|---|---|---|---|
| Claude Code | `.claude/skills/keep-the-why` | `~/.claude/skills/keep-the-why` | 2026-07-10 |
| Gemini CLI | `.gemini/skills/keep-the-why` | `~/.gemini/skills/keep-the-why` | 2026-07-10 |
| GitHub Copilot | `.github/skills/keep-the-why` | `~/.copilot/skills/keep-the-why` | 2026-07-10 |
| Cursor | `.cursor/skills/keep-the-why` | — (no personal directory) | 2026-07-10 |
| Cline | `.cline/skills/keep-the-why` | `~/.cline/skills/keep-the-why` | 2026-07-10 |

These paths change as agent tooling evolves — if one doesn't work, check the agent's current docs rather than assuming this table is still accurate. **Codex CLI**, Antigravity, Amp, OpenCode, Warp, and more read the shared `.agents/skills/keep-the-why` path at project scope instead of a vendor-specific one — Codex specifically scans `.agents/skills` from your current working directory up to the repository root (per [OpenAI's Codex skills docs](https://developers.openai.com/codex/skills)) — and `~/.agents/skills/keep-the-why` personally. Also compatible with Windsurf, Goose, Roo Code, Trae, Factory, JetBrains Junie, and other tools supporting the open Agent Skills format — the directory convention varies, check your tool's own docs.

Start a new session afterward so the skill is picked up.

## Without a skill-compatible agent

`docs/` and `context/` (the structure the skill produces in *your* project — see [repository structure](repository-structure.md)) are plain Markdown — no skill runtime is required to read them. Anything that browses or indexes a repository works with the output directly, including read-only tools that never run the skill themselves — for example **[DeepWiki](https://deepwiki.com/)** (Cognition, the makers of Devin), which generates a browsable wiki for any public repo by analyzing its code *and* existing docs, citing them directly. A project with a populated `context/` gives DeepWiki (and anything like it) real rationale to cite instead of having to infer everything from code alone. The skill automates keeping this current; the result is still useful on its own even where the skill itself isn't installed anywhere.

## Updating

Re-run whichever install command you used the first time. If you pinned to `latest`, that's enough — it always resolves to the newest release. If you pinned to an exact version, swap in the new tag. A plain `git pull` doesn't work if you copied the folder out of a scratch clone rather than cloning directly into place.

Start a new session afterward, same as a fresh install — a session already in progress keeps whatever `SKILL.md` it already loaded and won't pick up the update mid-conversation. To confirm the update actually took, check the `metadata.version` field in your installed `skills/keep-the-why/SKILL.md`, or ask your agent to report it.

This is separate from whether your project's own `context/` needs anything done to it. Updating the skill replaces its own files wholesale — nothing to do on your side just because a release changed how `SKILL.md` describes itself internally. A release only asks something of your project when it changes the *format* of `context/` entries, tracked via `context-schema` in your `AGENTS.md` — see `setup.md` and `migrations.md`. The two are independent: a release can update the skill's own frontmatter shape (as `0.3.1` did) without touching `context-schema` at all.

## Verifying it loaded

Start a session in a project where the skill is installed and ask something that should trigger it, e.g. "why does this workaround exist, and can you document it?" If it doesn't seem to activate, double-check that `SKILL.md` sits directly inside the skill folder (not nested deeper) and that the folder name matches `name: keep-the-why` in the frontmatter exactly.
