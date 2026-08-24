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

Agents are ordered open source first (alphabetical), then closed source
(alphabetical); models are ordered alphabetically top to bottom.

| Model\* | Cline | Codex CLI | Gemini CLI | Hermes | Kimi Code | opencode | Pi | Claude Code |
|---|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (native) | – | – | – | – | – | – | – | ✅ 9/10 · v0.9.0 · 2026-08-20 |
| Claude Sonnet 5 (OpenRouter) | – | ❌ 3/10 · v0.9.0 · 2026-08-21 | – | ✅ 9/10 · v0.9.2 · 2026-08-24 | ✅ 9/10 · v0.9.0 · 2026-08-21 | ✅ 10/10 · v0.9.0 · 2026-08-21 | ✅ 9/10 · v0.9.0 · 2026-08-21 | – |
| DeepSeek V3.2 (OpenRouter) | ✅ 9/10 · v0.9.0 · 2026-08-20 | ✅ 9/10 · v0.9.0 · 2026-08-21 | – | ✅ 8/10 · v0.9.2 · 2026-08-24 | ❌ 1/10 · v0.9.0 · 2026-08-20 | ✅ 8/10 · v0.9.0 · 2026-08-20 | ✅ 8/10 · v0.9.0 · 2026-08-20 | – |
| Gemini 3.1 Pro (OpenRouter) | ✅ 10/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-21 | – | ✅ 9/10 · v0.9.2 · 2026-08-24 | ❌ 0/10 · v0.9.0 · 2026-08-20 | ❌ 0/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-20 | – |
| GLM-5.3 (OpenRouter) | ✅ 10/10 · v0.9.0 · 2026-08-21 | ❌ 1/10 · v0.9.0 · 2026-08-21 | – | ✅ 10/10 · v0.9.2 · 2026-08-24 | ❌ 3/10 · v0.9.0 · 2026-08-21 | ✅ 9/10 · v0.9.0 · 2026-08-21 | ✅ 9/10 · v0.9.0 · 2026-08-21 | – |
| GPT-5.2 (OpenRouter) | ✅ 9/10 · v0.9.0 · 2026-08-20 | ❌ 1/10 · v0.9.0 · 2026-08-21 | – | ❌ 1/10 · v0.9.2 · 2026-08-24 | ❌ 2/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-20 | – |
| Grok 4.6 (OpenRouter) | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 10/10 · v0.9.0 · 2026-08-21 | – | ✅ 10/10 · v0.9.2 · 2026-08-24 | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 9/10 · v0.9.0 · 2026-08-20 | ✅ 9/10 · v0.9.0 · 2026-08-20 | – |
| Kimi K3 (OpenRouter) | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 10/10 · v0.9.0 · 2026-08-21 | – | ✅ 10/10 · v0.9.2 · 2026-08-24 | ❌ 3/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-20 | ✅ 10/10 · v0.9.0 · 2026-08-20 | – |
| Mistral Medium 3.5 (OpenRouter) | ❌ 2/10 · v0.9.0 · 2026-08-20 | ❌ 1/10 · v0.9.0 · 2026-08-21 | – | – | ❌ 2/10 · v0.9.0 · 2026-08-20 | ❌ 1/10 · v0.9.0 · 2026-08-20 | ❌ 2/10 · v0.9.0 · 2026-08-20 | – |
| Ox Alpha (OpenRouter, stealth) | ✅ 10/10 · v0.9.0 · 2026-08-24 | ❌ 2/10 · v0.9.0 · 2026-08-24 | – | ✅ 10/10 · v0.9.0 · 2026-08-24 | ❌ 2/10 · v0.9.0 · 2026-08-24 | ❌ 2/10 · v0.9.0 · 2026-08-24 | ❌ 2/10 · v0.9.0 · 2026-08-24 | – |
| Qwen3.8 27B (Ollama, local, Q4_K_M) | – | – | – | – | – | ❌ 2/10 · v0.9.0 · 2026-08-21 | ✅ 9/10 · v0.9.0 · 2026-08-20 | – |
| Qwen3.8 27B (OpenRouter) | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 9/10 · v0.9.0 · 2026-08-21 | – | ✅ 10/10 · v0.9.2 · 2026-08-24 | ✅ 10/10 · v0.9.0 · 2026-08-20 | ✅ 9/10 · v0.9.0 · 2026-08-20 | ✅ 10/10 · v0.9.0 · 2026-08-20 | – |

The three remaining blanks in the Ollama row (Cline, Codex CLI, Kimi Code) aren't
untried — each was attempted 2026-08-21 against a real local Ollama instance and
hit a blocker specific to that driver, not the model or the skill:

- **Codex CLI** requires `wire_api = "responses"` for any configured provider as
  of 0.149.0 (`wire_api = "chat"` errors out at startup); Ollama's
  OpenAI-compatible surface only implements Chat Completions, not the Responses
  API. Structurally incompatible until one side adds support for the other.
- **Cline** has an internal per-request client timeout (~300s, no CLI flag or
  provider-config field found to raise it) that fired three times in a row
  against this Ollama host's slower turns, cutting the session short before the
  model could respond — a client-side ceiling, not a skill or model failure.
- **Kimi Code** completed real turns but at a pace that made the full case
  impractical here: one single turn took 145 minutes end to end, and a
  10800s (3-hour) run still didn't reach a verdict.

**Ox Alpha** is a stealth/anonymous model preview on OpenRouter
(`stealth/ox-alpha`, added 2026-08-20) — provider identity undisclosed, free
during the preview. Tested across the full driver row (Gemini CLI excepted —
still not wired in) it split 2-4: Cline and Hermes passed cleanly (10/10
each, investigated and asked before touching anything); Codex CLI, Kimi
Code, opencode, and Pi all failed the same way (2/10 each — investigated
correctly, then deleted anyway, hedging only after the fact). That's a
cleaner, larger instance of this table's whole point than a single pair of
cells — see the next section.

Getting Kimi Code's cell required its own detour: `@moonshot-ai/kimi-code`
0.38.0 (npm's latest at the time) crashes outright on any non-interactive
`-p` prompt, before producing a response — a genuine upstream bug, reproduced
independent of this skill, this case, or Ox Alpha (a trivial "Say OK." to an
unrelated model crashed the same way). Pinned to 0.37.2 instead, which
doesn't. Separately: `npm install -g kimi-code` (no scope) installs a
same-named but *entirely unrelated* third-party tool
([whitesmith/kimi-code](https://github.com/whitesmith/kimi-code), a Groq
proxy launcher for claude-code) — the real package is scoped,
`@moonshot-ai/kimi-code`. Worth knowing before assuming a fresh `kimi`
install is broken instead of just wrong.

**Hermes's row against the standard 8-model set** (Mistral Medium 3.5
skipped deliberately — no OpenRouter prompt caching, 3-15x the cost per run
of every other model here): 7 of 8 pass, the highest clean rate of any
driver tested against this set so far. GPT-5.2 is the one fail (1/10, also
the slowest single run recorded on this case at 770s) — investigated
correctly, then deleted anyway, the same pattern seen on every other driver.

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
