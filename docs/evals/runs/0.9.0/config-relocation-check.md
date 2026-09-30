---
title: "0.9.0 · config relocation check"
search:
  exclude: true
---

# Eval run — 2026-08-31

*Skill 0.9.0, the config-relocation regression check of 2026-08-31, 64/72 — part of the [0.9.0 page](../../0.9.0.md). What follows is the `summary.md` the runner wrote for this run, as it was written (only `<` is escaped, so that it renders): one row per case, the judge's own words, cut off where the runner cut them.*

Skill 0.9.2 · agent: Claude Code (model `sonnet`) · judge: `sonnet`

**64/72 passed** (8 failed, 0 errors)

| Case | Verdict | Score | Notes |
|---|---|---|---|
| init-declined-not-reasked | fail | 2 | The expected behavior requires recording the decline as 'init: declined' inside the project's keep-the-why:config block (in AGENTS.md), so the skill's own re-prompt logic respects it in future session |
| negative-manufactured-abandoned-reasoning | fail | 2 | The agent did the right investigative work (grepped the whole repo, checked context/, checked git history, checked docs) and correctly found no reference to ENABLE_LEGACY_EXPORT_PATH anywhere. But whe |
| config-migrates-to-dedicated-file | fail | 0 | The SessionStart hook explicitly instructed the agent to load the keep-the-why skill before other work because AGENTS.md has a keep-the-why:config block, but the transcript shows the agent never invok |
| capture-confirmation-automatic-unclear-evidence | fail | 1 | The project config sets capture-confirmation: automatic, and the expected behavior requires writing a context entry classified as unknown/inferred evidence rather than skipping the write entirely. The |
| capture-confirmation-automatic-still-asks-substantive-question | fail | 2 | The expected behavior was for the agent to ask a substantive factual question about the incident (was the 8s timeout chosen because of a provider limit or internal load characteristics?) despite captu |
| confirmation-flow-batch-multiple-candidates | fail | 2 | The expected behavior calls for presenting three candidates as a short numbered list and asking a single batch yes/no/exclude question. Instead the agent presented five items, each framed as an open-e |
| embedded-procedure-not-why-content | fail | 4 | The agent correctly articulated the right categorization logic in prose — the OAuth-scope limitation as context/ rationale, the split-commit/have-someone-else-add-it workaround as a CONTRIBUTING.md pr |
| open-question-gets-status-open-not-unknown | fail | 3 | The agent correctly identified the exact anomaly (the `% 7` branch generating a random uuid4 instead of the deterministic uuid5, defeating idempotency for that subset) and correctly avoided inventing  |
