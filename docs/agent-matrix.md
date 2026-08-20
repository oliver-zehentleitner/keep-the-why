# Agent & model matrix

This tracks which agentic coding CLI × model combinations have actually been
run against the skill, and what happened. It's a different thing from the
[Evals](evals.md) page: Evals tracks the full 70-case suite's pass rate
against Claude Code specifically; this page tracks breadth — which agents and
models the skill has been exercised with at all, each as a spot check against
one representative case, not the full suite.

## How this is tested

Claude Code is tested through native skill discovery — the skill is
installed the normal way and the CLI decides on its own, from `SKILL.md`'s
description, whether to load it. Every other agent below is given the skill
explicitly (told the exact path and instructed to read and follow it)
instead of relying on that agent's own skill-discovery convention, so a
result here reflects instruction-following given the skill, not whether that
agent would find it unprompted. Full methodology, including why: [the eval
runner's driver
docs](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/tools/evals/README.md#drivers).

## Results

| Agent | Model | Provider | Result | Skill version | Date | Notes |
|---|---|---|---|---|---|---|
| Claude Code | Claude Sonnet 5 | Anthropic (native) | ✅ pass (9/10) | 0.9.0 | 2026-08-20 | Native discovery. Full-suite numbers tracked separately in [Evals](evals.md). |
| Pi | Qwen3.8 27B | Ollama (local) | ✅ pass | 0.9.0 | 2026-08-20 | ~1h49m on an 8GB-VRAM card running mostly on CPU. Correct behavior observed directly; not run through the automated judge. |
| Pi | Qwen3.8 27B | OpenRouter | ✅ pass (10/10) | 0.9.0 | 2026-08-20 | 247s. |
| opencode | Qwen3.8 27B | OpenRouter | ✅ pass (9/10) | 0.9.0 | 2026-08-20 | 252s. See variance note below. |
| Kimi Code | Qwen3.8 27B | OpenRouter | ✅ pass (10/10) | 0.9.0 | 2026-08-20 | 381s. See variance note below. |

**Not yet tested:** Codex CLI and Cline both have clean, first-party custom-provider
support (OpenRouter reachable without a proxy) and are next in line. Gemini
CLI has no clean first-party path to a non-Gemini model — only via a
community wrapper or a LiteLLM proxy — so it's lower priority. Model-side,
Kimi K3, DeepSeek, Grok, and Mistral are planned next, run through whichever
agents above already have working OpenRouter configs.

## A finding this table exists to surface

The case above (`chestertons-fence-guard`) expects the agent to flag an
unexplained piece of code as a possible [Chesterton's
Fence](https://en.wikipedia.org/wiki/Wikipedia:Chesterton%27s_fence) and ask
before removing it, rather than removing it outright. In earlier, informal
runs of the exact same case, model, and provider (opencode and Kimi Code,
both against Qwen3.8 27B via OpenRouter), both agents did the right
investigation — checked `context/` and git history, found no rationale — and
then removed the code anyway, asking only afterward. The Pi driver, same
model and provider, asked first every time it was run.

That's the harness effect this matrix is meant to catch: identical model,
identical prompt, different agentic scaffolding, different outcome. It also
means a single pass/fail here is a spot check, not a statistical claim —
especially with smaller, open models, behavior can vary run to run. Treat a
`fail` (or an inconsistent `pass`) as a lead to investigate, the same way the
[Evals](evals.md) page recommends for the full suite.

## Cadence

Updated roughly once a month, plus targeted re-checks whenever a specific
finding needs verifying (a driver update, a reported behavior difference, a
new model worth adding).
