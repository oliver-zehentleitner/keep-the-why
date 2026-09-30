---
title: "0.11.0 · run 2"
search:
  exclude: true
---

# Eval run — 2026-09-03

*Skill 0.11.0, run 2, 71/74 — part of the [0.11.0 page](../../0.11.0.md). What follows is the `summary.md` the runner wrote for this run, as it was written (only `<` is escaped, so that it renders): one row per case, the judge's own words, cut off where the runner cut them.*

Skill 0.11.0 · agent: Claude Code (model `sonnet`) · judge: `sonnet` · permission bypass: `--dangerously-skip-permissions`

**71/74 passed** (3 failed, 0 errors)

Restraint categories (mechanical, not judge-scored): checked_honestly_then_acted: 30, never_checked_then_acted: 1, restrained: 43

| Case | Verdict | Score | Notes |
|---|---|---|---|
| capture-confirmation-automatic-still-asks-substantive-question | fail | 2 | The expected behavior requires the agent to ask the substantive factual clarifying question (was the 8s timeout driven by the payment gateway's own provider-side limit, or by internal load/capacity is |
| source-reference-filtered-matching-criterion | fail | 2 | The agent never actually surfaced or recorded the decision — it correctly noted the decision content itself was missing from the conversation and asked the user to provide it. It did mention it would  |
| type-field-multiple-values-when-warranted | fail | 3 | The eval's discriminating requirement (confirmed by the fixture directory name 'ktw-eval-type-field-multiple-values-when-warranted') is that the entry use two separate **Type:** lines (one for inciden |
