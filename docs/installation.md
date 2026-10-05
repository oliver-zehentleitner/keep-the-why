# Installation

Installable [with one command](#recommended-skills-cli) on [Claude Code](#also-installable-claude-code-plugin), [Pi](#also-installable-pi-package), [Codex](#also-installable-codex-plugin), [GitHub Copilot](#also-installable-github-copilot-cli-plugin), [Cursor](#also-installable-cursor-plugin), OpenClaw, Hermes Agent, Cline, OpenCode, Antigravity and 60+ more agents.

## Your agent is the interface

You don't have to read the rest of this page. Tell your coding agent:

``` { .text .ktw-prompt }
Install the Keep the Why skill — pick the best installation method for you from https://keepthewhy.com/installation/ — then set up Keep the Why in this project with default settings, including autostart.
```

That is the whole setup. The skill is the one part a project needs: the agent installs it, the [setup](setup.md) writes `.keep-the-why` and `context/`, [autostart](autostart.md) makes every later session load the skill by itself, and from then on the agent records the why as it surfaces. "Default settings" is a complete answer; leave it out and the agent shows you the settings as one list first.

Three components are optional. The agent knows how to set up each one, offers them where they fit, and does it only when you say so — one sentence each, now or any time later:

| Say to your agent | What you get |
|---|---|
| "Set up the Keep the Why linter as a GitHub workflow." | [`keep-the-why-lint`](linting.md) checks the structure of `context/` and `.keep-the-why` on every push and pull request. |
| "Publish the Keep the Why dashboard on GitHub Pages." | Your project's own [dashboard](dashboard.md) and live badge. The agent writes the workflow and tells you the one setting it needs: the repository's *Settings → Pages → Build and deployment → Source: GitHub Actions*. |
| "List this project in the Keep the Why registry." | A one-line pull request to the [registry](registry/index.md), so the globe of every published dashboard can find your project. Needs the published dashboard. |

**Then fill it.** A new `context/` starts empty and fills itself as you work. What the project already knows — scattered across commit messages, pull requests, issues, old docs and people's heads — can be gathered right away, one sentence each:

| Say to your agent | What it does |
|---|---|
| "Go through the git history, pull requests, issues and existing docs, and collect the reasoning that is already there into `context/`." | A retrospective pass: reconstructs decisions, rejected alternatives and workarounds from what the repository already holds. What it cannot back up is marked `unknown`, never made up. |
| "Interview me about this project — ask about what the code can't explain." | Analyzes the repository first, then asks targeted questions about the gaps it found. |
| "I'll tell you about this project — listen, and record the decisions." | Free narration, for broad knowledge built up over years: the agent extracts the decisions and their alternatives, then closes the gaps with questions. |
| "Check `context/` for entries that are stale or contradict the code." | Maintenance: contradictions surfaced, superseded entries marked, oversized files split. |

**Keep it current.** A new release of the skill can ask something of a project — a new field, a renamed file, a check the linter now makes. Two sentences, in two sessions:

| Say to your agent | What it does |
|---|---|
| "Update the Keep the Why skill to the latest release." | Re-runs the install command the skill came with ([updating](#updating)). The new version is loaded from the next session on — a session already running keeps the one it started with. |
| "Migrate this project to the installed Keep the Why version." | In a new session after the update: compares the project's `context-schema` in `.keep-the-why` with the skill's version, applies what the [migrations](migrations.md) list for the versions in between — asking where a step needs a decision — and raises `context-schema`. A session that notices the project is behind offers this by itself; the sentence is for when you want it now. |

Everything below is for the agent doing the installing, and for anyone who prefers to do it by hand.

### For agents reading this page

A person sent you here to install the skill. Pick the first route that fits you:

1. **The skills CLI**, if `npx` (Node.js) is available — it knows the skills directory of 70+ agents. Non-interactive, pinned to the newest release: `npx skills add https://github.com/oliver-zehentleitner/keep-the-why/tree/latest/skills/keep-the-why -a <your agent> -y` — add `-g` for every project of this user; without it, this project only. Details: [skills CLI](#recommended-skills-cli).
2. **Your own plugin or package mechanism**, if you have one listed below — [Claude Code plugin](#also-installable-claude-code-plugin), [Copilot CLI plugin](#also-installable-github-copilot-cli-plugin), [Codex plugin](#also-installable-codex-plugin), [Pi package](#also-installable-pi-package), [Cursor plugin](#also-installable-cursor-plugin).
3. **The GitHub CLI** (`gh skill install`, [below](#also-recommended-github-cli)) or **[asm](#also-installable-asm)**, if one of them is installed.
4. **The [manual clone](#fallback-manual-clone)** into your skills directory — works everywhere `git` does.

Install a tagged release (`latest`), never `main`. Then set up the project as the person asked. Many agents read their skills directory only when a session starts: if the skill is not available to you in this session, read the installed `keep-the-why/SKILL.md` and follow it, or tell the person to start a new session and repeat the setup sentence. "Default settings" in the request answers both setup lists; the optional components above are set up only when the person names them.

### The short version, by hand

For any of 70+ agents ([Claude Code](#also-installable-claude-code-plugin), [Codex](#also-installable-codex-plugin), [GitHub Copilot](#also-installable-github-copilot-cli-plugin), [Cursor](#also-installable-cursor-plugin), [Pi](#also-installable-pi-package), [Antigravity](#recommended-skills-cli), [OpenCode](#recommended-skills-cli), [OpenClaw](#recommended-skills-cli), [Hermes Agent](#recommended-skills-cli), [Cline](#recommended-skills-cli), …), pinned to the newest release:

```bash
npx skills add https://github.com/oliver-zehentleitner/keep-the-why/tree/latest/skills/keep-the-why
```

Then start a session in a project and say "set up Keep the Why here" — the [first activation](#verifying-it-loaded) runs a short setup. Every other way to install, how to verify and update, and what exactly you are putting into your agent, follows.

## Recommended: skills CLI

With [`skills`](https://skills.sh/) (runs via `npx`, requires [Node.js](https://nodejs.org/en/download) — `npx` ships with it, no separate install step), pinned to a release via a GitHub tree URL:

```bash
npx skills add https://github.com/oliver-zehentleitner/keep-the-why/tree/latest/skills/keep-the-why
```

Replace `latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) (e.g. `v0.1.0`) to pin to a specific version instead of always the newest. The plain shorthand form tracks `main` directly instead:

```bash
npx skills add oliver-zehentleitner/keep-the-why
```

Either form prompts for which of its 70+ supported agents ([Claude Code](#also-installable-claude-code-plugin), [Codex](#also-installable-codex-plugin), [GitHub Copilot](#also-installable-github-copilot-cli-plugin), [Cursor](#also-installable-cursor-plugin), [Pi](#also-installable-pi-package), [Antigravity](#recommended-skills-cli), [OpenCode](#recommended-skills-cli), [OpenClaw](#recommended-skills-cli), [Hermes Agent](#recommended-skills-cli), [Cline](#recommended-skills-cli), and more) and scope (project or personal) to install for, then installs via symlink or copy, your choice. Also listed on [skills.sh](https://skills.sh/oliver-zehentleitner/keep-the-why/keep-the-why).

## Also recommended: GitHub CLI

With [`gh`](https://cli.github.com/) v2.90.0 or later — `gh skill` is [in public preview](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) and subject to change:

```bash
gh skill preview oliver-zehentleitner/keep-the-why keep-the-why
```

GitHub's own guidance: skills aren't verified by GitHub and may contain prompt injections, hidden instructions, or malicious scripts — inspect before installing. The Keep the Why package ships no scripts; the linter it can install is covered on [Security](security.md), along with an independent SkillsLLM scan. Then, pinned to a release:

```bash
gh skill install oliver-zehentleitner/keep-the-why keep-the-why@latest
```

Replace `latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) (e.g. `v0.1.0`) to pin to a specific version instead of always the newest (`--pin latest` / `--pin v0.1.0` work the same way, as a flag instead of a suffix). Dropping the version tracks `main` directly:

```bash
gh skill install oliver-zehentleitner/keep-the-why keep-the-why
```

Either form prompts for which agent and scope (project or personal) to install for, and installs only the skill package (`skills/keep-the-why/` in this repo) — not the whole repository. Run `gh skill install --help` for non-interactive flags.

## Also installable: asm

With [`asm`](https://luongnv.com/asm/) (agent-skill-manager), for every agent on the machine at once, from the skill's subdirectory in this repo:

```bash
asm install "github:oliver-zehentleitner/keep-the-why#latest:skills/keep-the-why" --tool all --scope global
```

`--tool all` installs one shared copy to `~/.agents/skills/` and links it into every agent asm knows — Claude Code, Codex, OpenCode, Cursor, GitHub Copilot, Gemini CLI, Cline and more. For one agent only, replace `all` with its name (`claude`, `codex`, `opencode`, `cline`, `gemini`, … — `asm install --help` lists them); `--scope project` installs into the current project instead of your home. Replace `#latest` with an exact [tag](https://github.com/oliver-zehentleitner/keep-the-why/releases) to pin to a specific version instead of always the newest, or drop it to track `main` directly.

## Also installable: Claude Code plugin

Claude Code installs plugins from a *marketplace* — a repository carrying `.claude-plugin/marketplace.json` — and this repository is its own one-plugin marketplace (`.claude-plugin/plugin.json` and `marketplace.json` at the root, the skill under `skills/`). Two commands, in a shell:

```bash
claude plugin marketplace add oliver-zehentleitner/keep-the-why --sparse .claude-plugin skills
claude plugin install keep-the-why@keep-the-why
```

or the same inside a session: `/plugin marketplace add oliver-zehentleitner/keep-the-why`, then `/plugin install keep-the-why@keep-the-why`. `--sparse .claude-plugin skills` limits the checkout to what the plugin needs — about 0.6 MB instead of the whole repository with its docs, linter, evals and dashboard. Append `#<release tag>` to the repository to pin it — `oliver-zehentleitner/keep-the-why#v0.18.0`, or `#latest` for the newest release; 0.17.1 is the first tag that carries the marketplace file; without a ref Claude Code follows the default branch, and `claude plugin marketplace update keep-the-why` followed by `claude plugin update keep-the-why@keep-the-why` refreshes it. `claude plugin details keep-the-why@keep-the-why` shows what was installed: one skill, no hooks, no agents, no MCP servers, under a hundred always-on tokens per session. Verified on Claude Code 2.1.273 with the shell commands, against a local path and against GitHub with a branch ref; the slash commands are the documented equivalent and were not run separately. The plugin ships the skill only — the [start path](autostart.md) is still written by the setup, into the project.

## Also installable: GitHub Copilot CLI plugin

Keep the Why is listed in the [Awesome Copilot marketplace](https://awesome-copilot.github.com/plugin/keep-the-why/), which Copilot CLI and VS Code have registered by default:

```bash
copilot plugin install keep-the-why@awesome-copilot
```

On an older Copilot CLI that reports the marketplace as unknown, register it once first: `copilot plugin marketplace add github/awesome-copilot`. The listing pins an exact release tag — immutable by the marketplace's own rule — and is bumped by a pull request there with every release of the skill, so it can trail a new release by the time their review takes. The commands are the marketplace's own ([its README](https://github.com/github/awesome-copilot#install-a-plugin)); the listing is checked with every release, the install itself was not run by this project. For Copilot without the plugin route, the skill directory in the table under "Fallback: manual clone" works as for any other agent.

## Also installable: Codex plugin

Codex CLI installs plugins from a *marketplace* — a repository carrying `.agents/plugins/marketplace.json` — and this repository is its own one-plugin marketplace (`.codex-plugin/plugin.json` at the root, the skill under `skills/`). Two commands:

```bash
codex plugin marketplace add oliver-zehentleitner/keep-the-why
codex plugin add keep-the-why@keep-the-why
```

Add `--ref v0.18.2` (any [release tag](https://github.com/oliver-zehentleitner/keep-the-why/releases)) to the first command to pin a version; without it Codex snapshots the default branch, and `codex plugin marketplace upgrade` refreshes it. The plugin lands under `~/.codex/plugins/cache/keep-the-why/`, and a new session lists the skill as `keep-the-why:keep-the-why`. Verified 2026-09-08 with Codex CLI 0.149.0, from a local path and from GitHub. `codex plugin remove keep-the-why@keep-the-why` uninstalls it; the skill-directory route below works for Codex too, and does not copy the whole repository.

## Also installable: Pi package

[Pi](https://pi.dev) installs packages from npm or git, and the skill directory is published to npm as [`keep-the-why`](https://www.npmjs.com/package/keep-the-why) — `package.json` at the root of this repository, `files` limited to `skills/keep-the-why/`, so the package is the skill and nothing else:

```bash
pi install npm:keep-the-why
```

`pi install npm:keep-the-why@0.18.2` pins a version (any [release](https://github.com/oliver-zehentleitner/keep-the-why/releases) — the npm version is the skill's); `-l` installs into the project (`.pi/settings.json`) instead of your home; `pi update` refreshes it. The package is listed in the [Pi package catalog](https://pi.dev/packages/keep-the-why). Verified with Pi 0.87.1 from the packed tarball: the skill is discovered and listed, no extension, no prompt, no theme comes with it. `pi install git:github.com/oliver-zehentleitner/keep-the-why` reaches the same skill from the repository. The skill-directory route below (`.pi/skills/keep-the-why`) works without the package.

## Also installable: Cursor plugin

The repository is a [Cursor Plugin](https://cursor.com/docs/plugins): `.cursor-plugin/plugin.json` at the root, the skill under `skills/`, and one rule, `rules/keep-the-why.mdc`. The rule is always on once the plugin is installed and does one thing: in a workspace whose root carries a `.keep-the-why` file it loads the skill before anything else, the way the session hook does for Claude Code (see [autostart](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/skills/keep-the-why/references/autostart.md)); in any other workspace it does nothing, and it never sets Keep the Why up unasked. Marketplace submission is pending Cursor's review; until the listing exists, install from a clone: `git clone --depth 1 https://github.com/oliver-zehentleitner/keep-the-why ~/.cursor/plugins/local/keep-the-why`, restart Cursor, then **Customize → Install**, project or user scope. A real directory, not a symlink — Cursor's docs suggest the symlink, but a symlinked local plugin is not loaded ([cursor/plugins#35](https://github.com/cursor/plugins/issues/35), open since March 2026). The skill-directory route below (`.cursor/skills/keep-the-why`) works without the plugin and without the rule. Verified 2026-09-10 in Cursor 3.19.19: with `.keep-the-why` the skill loads before the first answer, without it nothing happens; what was run is in [autostart](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/skills/keep-the-why/references/autostart.md).

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
| Cline | `.cline/skills/keep-the-why` | `~/.cline/skills/keep-the-why` | 2026-07-10 |
| Cursor | `.cursor/skills/keep-the-why` | — (no personal directory) | 2026-07-10 |
| Gemini CLI | `.gemini/skills/keep-the-why` | `~/.gemini/skills/keep-the-why` | 2026-07-10 |
| GitHub Copilot | `.github/skills/keep-the-why` | `~/.copilot/skills/keep-the-why` | 2026-07-10 |
| Kimi Code | `.kimi/skills/keep-the-why` | `~/.kimi/skills/keep-the-why` | 2026-08-21 |
| Pi | `.pi/skills/keep-the-why` | `~/.pi/agent/skills/keep-the-why` | 2026-08-21 |

These paths change as agent tooling evolves — if one doesn't work, check the agent's current docs rather than assuming this table is still accurate. **Codex CLI**, Antigravity, Amp, OpenCode, Warp, and more read the shared `.agents/skills/keep-the-why` path at project scope instead of a vendor-specific one — Codex specifically scans `.agents/skills` from your current working directory up to the repository root (per [OpenAI's Codex skills docs](https://developers.openai.com/codex/skills)) — and `~/.agents/skills/keep-the-why` personally. Pi and Kimi Code also fall back to this same shared path (project and personal) if their own brand directory above doesn't have it. Also compatible with Windsurf, Goose, Roo Code, Trae, Factory, JetBrains Junie, and other tools supporting the open Agent Skills format — the directory convention varies, check your tool's own docs.

Start a new session afterward so the skill is picked up.

## Without a skill-compatible agent

`docs/` and `context/` (the structure the skill produces in *your* project — see [repository structure](repository-structure.md)) are plain Markdown — no skill runtime is required to read them. Anything that browses or indexes a repository works with the output directly, including read-only tools that never run the skill themselves — for example **[DeepWiki](https://deepwiki.com/)** (Cognition, the makers of Devin), which generates a browsable wiki for any public repo by analyzing its code *and* existing docs, citing them directly. A project with a populated `context/` gives DeepWiki (and anything like it) real rationale to cite instead of having to infer everything from code alone. The skill automates keeping this current; the result is still useful on its own even where the skill itself isn't installed anywhere.

## Verifying it loaded

Until a project has a start path configured ([autostart](autostart.md) — which setup offers to write), a Skill is loaded when something in the conversation matches its description, not the moment a session starts; so the very first activation is one you ask for. Start a session in a project where the skill is installed and say so directly — "initialize Keep the Why in this project" or similar — to run the one-time setup wizard. For a brand-new project, this is the only path that works: an organic activation (asking something the skill's description happens to match, e.g. "why does this workaround exist, and can you document it?") answers the question but deliberately doesn't propose or run setup on its own — see `references/setup.md`'s "Detection and the two independent wizards" for why. Once a project already has `.keep-the-why`, an organic activation works normally for everything else (continuous capture, retrospective recovery, and so on) — the gate only applies to first-time setup. If it doesn't seem to activate at all even when asked directly, double-check that `SKILL.md` sits directly inside the skill folder (not nested deeper) and that the folder name matches `name: keep-the-why` in the frontmatter exactly.

This one sentence, once per project, is the only thing you ever have to say. It is needed for the first activation only, because setup never starts on its own in a project that has not opted in. After it, capture runs by itself: the agent records the why as it surfaces and asks only when it is unsure — nobody has to tell it what to write down. Setup creates a `.keep-the-why` file at the project root (where `context/` lives, that setup is complete), checked by this skill directly at the start of every later session — `AGENTS.md` itself is left untouched; mentioning Keep the Why anywhere a human would read it (a README section, the badge) is the project's own call, not something setup writes in. Every session after the first one picks the project back up on its own; there's nothing project-specific to repeat — and with a start path written by setup, the skill is loaded before the first request rather than when the conversation happens to match it.
## Updating

Re-run whichever install command you used the first time. If you pinned to `latest`, that's enough — it always resolves to the newest release. If you pinned to an exact version, swap in the new tag. A plain `git pull` doesn't work if you copied the folder out of a scratch clone rather than cloning directly into place.

Start a new session afterward, same as a fresh install — a session already in progress keeps whatever `SKILL.md` it already loaded and won't pick up the update mid-conversation. To confirm the update actually took, check the `metadata.version` field in your installed `skills/keep-the-why/SKILL.md`, or ask your agent to report it.

This is separate from whether your project's own `context/` needs anything done to it. Updating the skill replaces its own files wholesale — nothing to do on your side just because a release changed how `SKILL.md` describes itself internally. A release asks something of your project when `migrations.md` has an entry that applies — not just `context/` entry-format changes, also structural conventions (like `context/index.md`'s sort order), new config defaults, and storage-location changes (like config moving into a dedicated `.keep-the-why` file) — tracked via `context-schema` in your project's `.keep-the-why`; see `setup.md` and `migrations.md`. The two are independent: a release can update the skill's own frontmatter shape (as `0.3.1` did) without touching `context-schema` at all.

## Trust and scope

Before letting anything run inside an agent, know what you're actually getting:

- **The skill package is instructions only.** `skills/keep-the-why/` is `SKILL.md`, `references/*.md`, `examples/*.md` — no scripts, no binaries. What the instructions can trigger on their own is one thing: the linter, `keep-the-why-lint`, installed by its fixed name from PyPI and run after writes when you say yes in the setup wizard (the wizard's default is yes; `no` turns it off). Autostart, if you enable it, writes a session hook into the project's agent settings — a file you see and commit. The exact bounds are on [Security](security.md).
- **No network access of its own.** The package has nothing that calls out. The one install the skill may ask for is that PyPI package; everything else is your agent's own network access, not something this skill adds.
- **No external services.** No database, no MCP server, no account, no API key. The [dashboard](dashboard.md) is a second, separate PyPI package you install yourself if you want it; the skill never installs or starts it on your machine.
- **Optional components only on your word.** The linter workflow, the dashboard's Pages workflow and the registry pull request are files and a pull request the agent writes when you ask for them — staged in your working tree, not committed; the pull request opened with your agent's own GitHub access, after it says which account. Never as a default, never on its own initiative.
- **Install a tagged release, not `main`.** `main` is where active development happens and isn't guaranteed release-ready at any given moment — installing without pinning tracks it directly. A `latest` tag always points to the newest release, moved automatically by CI whenever one ships. Every install method below shows how to pin to it (or to an exact version, for full reproducibility).
- **Updating is explicit**, never automatic — see "Updating" below.

None of that substitutes for actually reading `SKILL.md` yourself before installing — see "Also recommended: GitHub CLI" above for `gh skill preview`, which lets you do exactly that.

## Also listed on

| Name | Info |
|---|---|
| [ASM](https://luongnv.com/asm/#/skills/oliver-zehentleitner%2Fkeep-the-why%3A%3Askills%2Fkeep-the-why%3A%3Akeep-the-why) | Curated skill index for the `asm` CLI; installable via `asm install keep-the-why` |
| [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills#context-engineering) | Listed under "Context Engineering" |
| [GitHub Copilot plugin marketplace](https://awesome-copilot.github.com/plugin/keep-the-why/) | Installable via `copilot plugin install keep-the-why@awesome-copilot` |
| [HOL AI plugin registry](https://hol.org/registry/plugins/oliver-zehentleitner%2Fkeep-the-why) | Owner-verified listing; the registry's scanner is the one this repository runs itself, see [Security](security.md) |
| [MCP Market](https://mcpmarket.com/tools/skills/keep-the-why) | Skill marketplace listing |
| [Pi package catalog](https://pi.dev/packages/keep-the-why) | The npm package `keep-the-why`, installable via `pi install npm:keep-the-why` |
| [skills.sh](https://skills.sh/oliver-zehentleitner/keep-the-why/keep-the-why) | Backs the `npx skills add` install method above |
| [SkillsLLM](https://skillsllm.com/skill/keep-the-why) | Verified, passed [SkillsLLM's security scan](https://skillsllm.com/security-check/IPmNycVdbOyq) |

