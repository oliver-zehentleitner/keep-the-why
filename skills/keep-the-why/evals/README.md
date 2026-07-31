# Evals

Eval scenarios for this skill: a prompt paired with the expected behavior, in the format Anthropic's own [skill-authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) describes — including negative cases (prompts where the skill should *not* activate, or should stay minimal).

**Status:** an automated runner for these cases lives in the repository at [`tools/evals/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/tools/evals) — deliberately outside this skill package, which ships instructions only (`main` link on purpose: the runner is development tooling that isn't part of any release artifact). It materializes a fixture project per case, runs a real agent session against it, and grades transcript + file changes with an LLM judge. So far it drives one agent (Claude Code); cross-agent results are still the open gap — see "What's useful" in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) for how to help close it.
