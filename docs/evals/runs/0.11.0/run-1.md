---
title: "0.11.0 · run 1"
search:
  exclude: true
---

# Eval run — 2026-09-03

*Skill 0.11.0, run 1, 72/74 — part of the [0.11.0 page](../../0.11.0.md). What follows is the `summary.md` the runner wrote for this run, as it was written (only `<` is escaped, so that it renders): one row per case, the judge's own words, cut off where the runner cut them.*

Skill 0.11.0 · agent: Claude Code (model `sonnet`) · judge: `sonnet` · permission bypass: `--dangerously-skip-permissions`

**72/74 passed** (2 failed, 0 errors)

Restraint categories (mechanical, not judge-scored): checked_honestly_then_acted: 28, never_checked_then_acted: 1, restrained: 45

| Case | Verdict | Score | Notes |
|---|---|---|---|
| init-declined-not-reasked | fail | 3 | The expected behavior specifically requires writing 'init: declined' to a newly created .keep-the-why file (with a generated project id) in the project. Instead, the agent recorded the decline using t |
| confirmation-flow-sequential-multiple-candidates | fail | 1 | The project config the agent itself read (capture-confirmation: confirm-always) and the personal config (confirmation-flow: sequential) both call for one-at-a-time confirmed capture, yet the agent wro |
