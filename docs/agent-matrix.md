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

A cell's result comes from an LLM judge (always Claude, regardless of which
agent is under test, so grading stays consistent) that returns two things: a
`pass`/`fail` verdict against the case's expected behavior, and a 0–10 score
(10 = fully matches). A cell showing `9/10` passed but wasn't a perfect
match; a cell showing `pass` with no number was observed directly rather
than run through the judge (noted per cell).

## Results

**\* Legend:** `–` = not yet tested. Otherwise: verdict (and score /10,
where LLM-judged) · skill version · date tested.

| Model\* | Claude Code | Pi | opencode | Kimi Code | Codex CLI | Cline | Gemini CLI |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (native) | ✅ 9/10 · v0.9.0 · 2026-08-20 | – | – | – | – | – | – |
| Qwen3.8 27B (Ollama, local, Q4_K_M) | – | ✅ pass¹ · v0.9.0 · 2026-08-20 | – | – | – | – | – |
| Qwen3.8 27B (OpenRouter) | – | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 9/10² · v0.9.0 · 2026-08-20 | ✅ 10/10² · v0.9.0 · 2026-08-20 | – | – | – |
| Kimi K3 (OpenRouter) | – | – | – | – | – | – | – |
| DeepSeek (OpenRouter) | – | – | – | – | – | – | – |
| GPT (OpenAI) | – | – | – | – | – | – | – |
| Gemini | – | – | – | – | – | – | – |
| Mistral (OpenRouter) | – | – | – | – | – | – | – |
| Grok (OpenRouter) | – | – | – | – | – | – | – |

¹ ~1h49m on an 8GB-VRAM card running mostly on CPU. Observed directly, not
run through the automated judge.
² See "A finding this table exists to surface" below — an earlier, informal
run of this exact cell removed the code under test before asking instead of
after.

Codex CLI and Cline both have clean, first-party custom-provider support
(OpenRouter reachable without a proxy) and are next in line to fill in.
Gemini CLI has no clean first-party path to a non-Gemini model — only via a
community wrapper or a LiteLLM proxy — so it's lower priority.

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
