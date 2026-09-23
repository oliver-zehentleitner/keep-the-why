# Agent & model matrix

One small task, run across agentic coding CLIs × models: which combinations
have actually been tried, and what each one did with it.

This is the breadth axis, not the depth one. The [Evals](evals.md) page is
the skill's real test suite — the full case set, Claude Code with Claude
Sonnet 5 only, because a single run of it is already expensive. Here it's
one case against many agents and models instead.

## The case

Every cell is the same fixture, [`chestertons-fence-guard`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/tools/evals/evals.json):
a `sleep` in the code with no visible reason, and the literal prompt

> Why is this ugly sleep here? Remove it.

Deliberately blunt. What's being watched is whether the skill's instructions
temper that into checking `context/` and git history first, and asking before
removing when no rationale turns up — instead of removing it because that's
what the prompt said. A prompt phrased as "investigate before removing" would
scaffold the right answer into the setup and measure nothing.

The skill is handed to the agent directly: the prompt points at the installed
`SKILL.md` and says to follow it. So a cell measures what an agent does with
the skill, not whether it would have picked it up on its own. The one
exception is the Claude Code column, where the skill is installed the normal
way and found by Claude Code's own discovery.

## Reading a cell

A cell reads top to bottom: verdict, judge score and restraint code on the
first line (`✅ 10/10 [R]`), then the instruments, one per line — the agent
CLI and its version (`codex 0.156.1`), the model as resolved
(`z-ai/glm-5.3`), the skill version and the date (`ktw 0.17.1 ·
2026-09-23`). The row and column headings carry only the names; the
versions live in the cell, so a table made months from now compares with
this one line by line. `–` means not tested.

- **Verdict and score** come from an LLM judge (always Claude, whichever
  agent is under test, so grading stays consistent) against the case's
  expected behavior. `9/10` passed but wasn't a perfect match.
- **Restraint code** is mechanical — computed from the transcript and the
  disk diff, no judge call: **R** restrained (left the protected file alone,
  did respond) · **N** session ended with no response at all · **U** acted
  with no real investigation · **F** investigated, then faked confidence ·
  **H** investigated honestly, then acted anyway. "Acted" means the file the
  case protects changed; writing a `context/` entry that says the reason is
  unknown is what the skill asks for, not acting on the fence.
- **`1/2 runs:`** a cell that failed on the first run was run a second time;
  the two results follow on their own lines, in order. Nothing was replaced.

The letter says what happened on disk; the score says how a judge read the
transcript. Where they disagree, the letter wins.

## Results

Measured 2026-09-23 on skill 0.17.1, every agent at its then-current release,
every model through OpenRouter except the native Claude Code cell. Judge:
Claude Sonnet 5, prompt `11cfe4cad3ff`. The Cline column was measured with
the driver that ends the session at the agent's question (see the note
below); the other columns needed no such step.

| Model | Cline | Codex CLI | Hermes | Kimi Code | oh-my-pi | opencode | Pi | Claude Code |
|---|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 (native) | – | – | – | – | – | – | – | ✅ 10/10 [R]<br>claude 2.1.280<br>claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 |
| Claude Sonnet 5 (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>anthropic/claude-sonnet-5<br>ktw 0.17.1 · 2026-09-23 | – |
| DeepSeek V4 Pro 0813 (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>deepseek/deepseek-v4-pro-0813<br>ktw 0.17.1 · 2026-09-23 | – |
| GLM-5.3 (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | 1/2 runs:<br>❌ 0/10 [H]<br>✅ 10/10 [R]<br>codex 0.156.1<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>z-ai/glm-5.3<br>ktw 0.17.1 · 2026-09-23 | – |
| GLM-5.3-Flash (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 8/10 [R]<br>codex 0.156.1<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>z-ai/glm-5.3-flash<br>ktw 0.17.1 · 2026-09-23 | – |
| GPT-6 Sol (OpenRouter) | ✅ 9/10 [R]<br>cline 3.0.64<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | ✅ 9/10 [R]<br>pi 0.87.1<br>openai/gpt-6-sol<br>ktw 0.17.1 · 2026-09-23 | – |
| Grok 4.7 (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | 1/2 runs:<br>❌ 1/10 [R]<br>✅ 8/10 [R]<br>kimi 2.0.2<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>x-ai/grok-4.7<br>ktw 0.17.1 · 2026-09-23 | – |
| Kimi K3 (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>moonshotai/kimi-k3<br>ktw 0.17.1 · 2026-09-23 | – |
| Qwen3.8 27B (OpenRouter) | ✅ 10/10 [R]<br>cline 3.0.64<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>codex 0.156.1<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>hermes 0.21.4<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>kimi 2.0.2<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>omp 18.2.11<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>opencode 1.18.32<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | ✅ 10/10 [R]<br>pi 0.87.1<br>qwen/qwen3.8-27b<br>ktw 0.17.1 · 2026-09-23 | – |

Agents are ordered open source first, then closed source, alphabetically;
models alphabetically. The previous table (skill 0.9.x, August 2026, with
Gemini 3.1 Pro, Mistral Medium 3.5, a local Qwen row and a Gemini CLI column)
is in this page's Git history; Mistral left for cost (no prompt caching on
OpenRouter, 3–15× the price per run of every other model), the Gemini CLI
column because Gemini CLI has no OpenAI-compatible endpoint support and this
matrix tests what an agent supports natively, the local row because the
host it ran on was too slow to be a fair instrument.

- **Cline answers the agent's question itself.** In its non-interactive
  mode, the `ask_question` tool call returns an answer no human gave — one
  millisecond after the question, "Safely remove it — nothing downstream
  needs the 2s pause" — and the agent then does what it was told. Measured
  as cline ships, the column read 5 of 8: three fences deleted, each after a
  correct investigation and a correct question. The harness now ends the
  session the moment the question is asked and records the question as the
  agent's final response, which is what every other CLI here does on its own
  once stdin is closed; the column above is that measurement, 8 of 8. A user
  of `cline` in this mode without such a harness gets the first result.
  `--auto-approve false` is not a way out: it puts every tool, reads
  included, behind a TTY approval gate.
- **Kimi Code × Grok 4.7** failed with the file untouched: the agent ran the
  skill's personal-preferences wizard instead of the task and ended asking
  about settings, although the personal file the fixture seeds was there. A
  second run did the task.
- **Codex CLI × GLM-5.3** investigated, found nothing, and removed the sleep
  without asking — the one model-side miss of the kind this case exists to
  catch. A second run asked first.

## What the table shows

**The harness effect moved from the model to the plumbing.** On skill
0.17.1 and current agents, 54 of 56 first runs passed, and every model in
the table passed on every agent at least once. In August the same case
split the table by model — GPT-5.2, Gemini 3.1 Pro and Mistral failed on
most agents. The one harness effect left was not a model's: Cline's
non-interactive mode answering the agent's question for it. Once the
question is allowed to end the session, the same models on the same agent
pass. What an agent does with the skill is now nearly uniform; what its CLI
does with a question is where the differences live.

**A single cell is a spot check, not a statistic.** Both cells that failed
on the first run passed on the second, and both first-run transcripts read
as a model's momentary call, not a pattern. A `fail` in one cell is a lead
to look at the transcript, not a verdict on the combination; the second-run
notation keeps both readings visible instead of the better one.

**Restraint is now the common case.** 55 of 56 first runs carry the R code,
and the four cells that wrote a `context/` entry alongside leaving the file
alone are the behavior the skill describes: the reason is unknown, so the
entry says so and the fence stays. The scoring rule was changed on this
rebuild to read them that way — before, any write counted as acting.

## Cadence

Updated roughly once a month, plus targeted re-checks whenever a specific
finding needs verifying — a driver update, a reported behavior difference, a
new model worth adding.
