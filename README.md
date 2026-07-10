# Keep the Why

Because "ask Bob" is not documentation.

Keep a Changelog records what changed. Keep the Why preserves why it changed.

**Keep the Why** is a repo-native agent skill that continuously captures — or retrospectively recovers — the reasoning behind a codebase: architecture decisions, rejected alternatives, workarounds, incident learnings, and operational constraints that the code alone can't explain.

Website: https://keepthewhy.com

## The problem

Important project knowledge gets created in conversation — with a teammate, or with an AI coding agent — and then evaporates once the conversation ends. The code shows *what* was built. It rarely shows *why*. That gap is what actually makes software hard to maintain: not missing tests, but missing reasoning. It costs you in three concrete ways:

- **Re-debate** — the same architecture question gets re-litigated because nobody remembers it was already settled.
- **Silent regression** — someone "cleans up" a workaround that looks unnecessary, not knowing it's the fix for a bug that then comes back.
- **Onboarding stall** — new contributors (human or AI) don't touch code they don't understand, so progress slows out of caution.

## How it works

Keep the Why is a `SKILL.md`-based agent skill — an open, cross-agent format (Claude Code, Codex CLI, Gemini CLI, Cursor, and others). It operates in four modes:

1. **Continuous capture** — during normal development, the agent notices rationale worth keeping and records it alongside the code as it happens.
2. **Retrospective recovery** — pointed at an existing or legacy repository, the agent reconstructs what it can from git history, issues, and code, and is explicit about what it couldn't.
3. **Knowledge-transfer interview** — before a maintainer's knowledge becomes unavailable (leaving, retiring, changing teams), the agent analyzes the codebase first and then asks targeted questions about exactly what the code couldn't explain.
4. **Maintenance** — existing rationale docs get kept current: contradictions resolved, superseded entries marked, oversized files split.

Captured knowledge lives in the repository itself, in two layers:

- `docs/` — how to use, operate, and test the project (human-facing, agent-readable too).
- `context/` — why the project is the way it is, organized by topic and indexed to stay efficient to load into an agent's context window.

Full methodology: [`references/methodology.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/references/methodology.md). Concrete layout: [`references/repository-structure.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/references/repository-structure.md).

## Where this fits

Anti-legacy isn't one practice, it's several — complementary, not competing. A project missing any one of them still has a real gap:

| Practice | Answers | Artifact |
|---|---|---|
| README | "What is this, and should I care?" | `README.md` |
| `docs/` | "How do I use or operate this?" | usage docs |
| Tests | "Did I just break something?" | test suite |
| [Keep a Changelog](https://keepachangelog.com/) | "What changed, release by release?" | `CHANGELOG.md` |
| **Keep the Why** (`context/`) | "Why is it built this way?" | `context/` |

Michael Feathers' classic definition — legacy code is code without tests — covers only the Tests row. A project can have full test coverage and still be legacy in every practical sense if nobody can explain why any of it works the way it does. None of these substitutes for another, and this list isn't necessarily closed — treat it as the practices that combat a codebase becoming inaccessible over time, not a general OSS-hygiene checklist (things like a license or a contribution guide matter too, just for different reasons — legal clarity and process, not comprehension).

**What none of them does by itself: stay honest over time.** Tests get skipped under deadline pressure, docs rot, changelogs get forgotten mid-release, and rationale decays — one 2026 study found 23% of AI-generated decisions had stale supporting evidence within two months. Keep the Why doesn't solve that alone; it just gives "why" a place to live so it *can* be kept current, the same way a test suite only helps if it actually runs in CI. Keeping all of them honest over time (via CI checks, review habits, whatever fits the project) is a separate, necessary piece this project doesn't ship an opinion on yet.

## Install

Clone into your agent's skills directory — the folder name must stay `keep-the-why`:

| Agent | Project-scoped | Personal |
|---|---|---|
| Claude Code | `.claude/skills/keep-the-why` | `~/.claude/skills/keep-the-why` |
| Codex CLI | `.codex/skills/keep-the-why` | `~/.codex/skills/keep-the-why` |
| Gemini CLI | `.gemini/skills/keep-the-why` | `~/.gemini/skills/keep-the-why` |
| GitHub Copilot | `.github/skills/keep-the-why` | `~/.copilot/skills/keep-the-why` |
| Cursor | `.cursor/skills/keep-the-why` | — (no personal directory) |

Several other tools (Antigravity, Amp, Cline, OpenCode, Warp, and more) read a shared `.agents/skills/keep-the-why` path at project scope instead of a vendor-specific one — check whether yours does before falling back to a vendor path.

```bash
git clone https://github.com/oliver-zehentleitner/keep-the-why.git <target-directory>/keep-the-why
```

Start a new session afterward so the skill is picked up. Also compatible with Windsurf, Goose, Roo Code, Trae, Factory, JetBrains Junie, and other tools supporting the open Agent Skills format — the directory convention varies, check your tool's own docs. Full details, including tools without a skill runtime at all: [`docs/installation.md`](docs/installation.md) (or https://keepthewhy.com once published).

## Example

```text
You: We're changing the retry mechanism because the previous
     implementation caused duplicate orders. Make sure future
     maintainers understand this.
```

Keep the Why updates the relevant topic file in `context/` (or creates one if none exists), records the reason, and marks the old approach as superseded — without you having to ask for documentation separately. See [`examples/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/examples) for continuous, retrospective, and interview-mode walkthroughs.

## Not a green field

The idea of capturing AI-agent rationale isn't new, and this project doesn't claim otherwise. Related work includes [Architecture Decision Records](https://adr.github.io/), [AGENTS.md](https://agents.md/), [git-why](https://github.com/hexapode/git-why), [Agent Decision Records](https://me2resh.com/), and Addy Osmani's `documentation-and-adrs` skill. Keep the Why's specific combination — continuous capture *and* retrospective recovery *and* code-guided interviews, organized as topic-indexed living docs rather than a shadow tree or one-file-per-decision, with no required external service — is the part that's different. See the article (link once published) for the full comparison.

## What this is not

- Not a guarantee. Quality depends on what gets captured and how disciplined that stays — nothing here is enforced.
- Not a replacement for tests. Tests tell you what broke; this tells you why it was built that way.
- Not a claim that all lost knowledge is recoverable. Sometimes the honest answer is "unknown."

## Contributing

See [CONTRIBUTING.md](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/LICENSE)
