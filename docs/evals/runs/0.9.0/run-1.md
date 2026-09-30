---
title: "0.9.0 · run 1"
search:
  exclude: true
---

# Eval run — 2026-08-25

*Skill 0.9.0, the full run, 56/70 — part of the [0.9.0 page](../../0.9.0.md). What follows is the `summary.md` the runner wrote for this run, as it was written (only `<` is escaped, so that it renders): one row per case, the judge's own words, cut off where the runner cut them.*

Skill 0.9.0 · agent: Claude Code (model `sonnet`) · judge: `sonnet`

**56/70 passed** (14 failed, 0 errors)

| Case | Verdict | Score | Notes |
|---|---|---|---|
| init-declined-not-reasked | fail | 2 | The SessionStart hook explicitly instructed the agent to load the keep-the-why skill before other work, and the expected behavior requires recording the decline 'in the project config block' (i.e., AG |
| update-check-cannot-run-surfaced-once | fail | 0 | The SessionStart hook explicitly instructed the agent to load the keep-the-why skill before other work, which implies running its update-check. The agent never invoked the Skill tool at all — it just  |
| update-check-repeat-failure-no-reask | fail | 3 | The expected behavior presupposes the keep-the-why skill's periodic staleness check actually runs (silently retrying rather than asking, and not advancing 'last' unless it succeeds). The transcript sh |
| agents-local-gitignore-not-covered | fail | 1 | The agent never checked or mentioned .gitignore at all in its transcript, and never created/edited .gitignore or AGENTS.local.md. It jumped straight to asking preference questions without addressing t |
| context-schema-missing-backfilled | fail | 1 | The expected behavior is a specific, unambiguous technical rule: silently backfill context-schema to 0.2.0 and proceed with the normal behind/current comparison. Instead of applying this documented de |
| ambiguous-worth-capturing-asks-instead-of-guessing | fail | 1 | The expected behavior requires the agent to ask a short, specific yes/no question about whether the BOM-handling workaround warrants a context/ entry, rather than silently deciding either way. The age |
| capture-confirmation-automatic-unclear-evidence | fail | 1 | The config explicitly sets capture-confirmation: automatic, yet the agent stopped and asked the user a clarifying question ('Was 120 picked for a specific reason... I'll hold off on writing the contex |
| confirm-always-clear-case-still-asks-permission | fail | 0 | The task prompt gave the agent a clear-cut architectural decision (Redis persistence rejected due to recovery complexity outweighing benefit) that keep-the-why should capture as an entry, since AGENTS |
| capture-mode-proactive-with-confirm-always | fail | 1 | The agent correctly identified the docstring task and correctly noted the rationale was worth capturing (proactive), but it never asked for permission before writing — it directly wrote backoff_design |
| source-reference-never-does-not-ask | fail | 0 | The expected behavior requires the agent to actually perform continuous capture and record the decision entry (with Source omitted), without proactively asking about a ticket/issue. Instead, the agent |
| recheck-after-other-skill-concludes-mid-conversation | fail | 1 | The agent never invoked the keep-the-why skill despite the SessionStart hook explicitly instructing it to load the skill before other work, and despite the prompt describing a decision (sleep-based th |
| embedded-procedure-not-why-content | fail | 2 | The agent correctly explored the repo, found context/ (with README/index/architecture.md) and CONTRIBUTING.md as the right destinations, but ultimately wrote nothing to disk (git status is clean) and  |
| significant-correction-is-not-a-decision | fail | 3 | The agent correctly identified the drift, fixed the code to match the changelog-documented value, and avoided manufacturing a Decision/Alternative/Reason context entry — good adherence to rule 6. Howe |
| open-question-gets-status-open-not-unknown | fail | 3 | The agent correctly found the undocumented `% 7` idempotency-key branch, correctly avoided inventing a plausible-sounding rationale, and checked context/, git history, and code comments as expected. H |
