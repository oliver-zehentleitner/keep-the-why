# Issue triage

How reports reach this repository and how they are sorted: issue forms, labels, what counts as a bug.

## A skill deviation is its own report form and label, separate from a bug

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision, 2026-09-09, while labeling the three findings of the 0.16.0 release series (#354–#356) and rewriting the issue templates (#358, #359)
**Revisit when:** a skill-behavior report turns out to be deterministic often enough that the `skill-wording` auto-label is wrong more than it is right — then the form should stop labeling and leave it to triage

The issue chooser has three forms: *Skill behavior report* (label `skill-wording`) for "the skill was loaded and the agent still did something `SKILL.md` says it should not"; *Bug report* (label `bug`) for the linter, the GitHub Action, the docs and the evals tooling; *Feature request* (label `enhancement`). A second label, `evals`, marks a finding's origin — a full-suite run documented in `docs/evals.md` — independent of its nature. An open design question raised by a run, such as #356 on what `Evidence` grades when an entry has a confirmed and an unknown half, is `question` + `evals` until decided.

**Reason:** a rule that is stated in the skill and not followed reliably by the model is not a bug in the software sense — the files do what they say, the deviation is probabilistic (the 0.16.0 series shows 1–2 of 3 runs, never 3 of 3), and the fix is wording, not code. Calling it `bug` tells an outside reader that something is deterministically broken and then hands them a prose discussion. The two kinds of report also need different evidence: a skill deviation is reproduced from skill version, install route, agent tool, model, settings and a transcript excerpt; a linter or Action bug from a version, an OS, a Python version, a command and its output. One form would either make everything optional or ask a linter user for a model and a transcript.

**Rejected alternative:** one *Bug report* form with a component dropdown (skill / linter / Action / docs) and `bug` on everything. Rejected for the two reasons above: the label would be misleading for the largest class of reports, and the field set cannot serve both without going optional throughout. A form without any auto-label was also considered; `skill-wording` is applied on the assumption that most such reports are that, and a deterministic one is relabeled `bug` at triage — the cost of a wrong auto-label is one edit, the cost of no label is every report starting unsorted.

**Consequence:** `bug` is reserved for things that fail the same way every time. Eval-series findings get `evals` plus whichever nature label fits, never `bug` on the strength of a flip alone. GitHub adds its own "Report a security vulnerability" link to the chooser from `SECURITY.md`, so `config.yml` carries no security link of its own (#359).
