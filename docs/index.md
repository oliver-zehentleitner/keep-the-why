---
description: Keep the Why is a repo-native convention and agent skill that preserves the reasoning behind a codebase as project memory, kept in the repo.
hide:
  - navigation
  - toc
---

<div class="ktw-home" markdown>

<div class="ktw-hero" markdown>

<div class="ktw-hero__text" markdown>

<p class="ktw-hero__tagline">Keep a Changelog records what changed. Keep the Why preserves why it changed.</p>

**Keep the Why** is a repo-native convention and agent skill for preserving the reasoning behind a codebase — architecture decisions, rejected alternatives, workarounds, incident learnings, operational constraints that the code alone can't explain — as project memory, kept in the repo. It captures that reasoning as a byproduct of working with your agent, and every later session has it: ask your agent why the code is the way it is and get the real answer, grounded in what was actually decided, not a reconstruction — with rejected approaches known before anyone tries them again.

<p class="ktw-hero__actions">
<a class="md-button md-button--primary" href="installation/">Install</a>
<a class="md-button" href="readme/">Read the README</a>
<a class="md-button" href="https://github.com/oliver-zehentleitner/keep-the-why">GitHub</a>
</p>

</div>

<div class="ktw-hero__demo">
<img src="assets/keep-the-why-readme.gif" alt="Keep the Why captures the reason an attempted retry-wrapper simplification was abandoned, stores it as versioned Markdown in context/retries.md, and lets a later agent session retrieve that reasoning instead of repeating the attempt." loading="lazy">
</div>

</div>

<div class="ktw-section" markdown>

## What it leaves behind

<div class="ktw-entry" markdown>

<p class="ktw-entry__path"><code>context/sync.md</code></p>

### Snapshot-before-buffer ordering

**Type:** decision<br>
**Status:** active<br>
**Evidence:** confirmed<br>
**Source:** maintainer interview, 2026-03-14; incident postmortem 2025-11, `incidents.md`<br>
**Revisit when:** the sync protocol or snapshot mechanism changes

The sync step always waits for a full snapshot before applying any buffered events, even though this adds latency on cold start.

**Reason:** applying buffered events before the snapshot landed caused duplicate-then-overwritten state during a 2025-11 incident. The ordering constraint isn't visible in the code — it looks like it could safely be parallelized, and someone tried exactly that once.

**Rejected alternative:** run snapshot and buffer replay in parallel, then reconcile. Rejected because reconciliation logic was hard to get right and the incident showed it wasn't actually needed if ordering was enforced instead.

</div>

<p class="ktw-caption">One entry, one topic file, plain Markdown in the repository — reviewed in the same pull request as the code it explains. Every entry says how well its claim is backed (<code>Evidence</code>) and whether it still holds (<code>Status</code>); "unknown" is a valid answer. <a href="repository-structure/">Field reference →</a></p>

</div>

<div class="ktw-section" markdown>

## How it works

<div class="ktw-cards" markdown>

<div class="ktw-card" markdown>

### Capture

The agent notices rationale as it surfaces — a decision, an alternative that lost, a workaround, a change that was started and abandoned — and writes it down with your confirmation. No separate documentation step. Works retrospectively on an existing repository too.

[Continuous capture →](continuous-capture/) · [Retrospective →](retrospective-analysis/)

</div>

<div class="ktw-card" markdown>

### Keep

Everything lives in `context/`, one file per topic, versioned with the code. A lean index tells an agent what to load. No daemon, no database, no service — anything that can read a repository can read it.

[Repository structure →](repository-structure/) · [Philosophy →](philosophy/)

</div>

<div class="ktw-card" markdown>

### Check

`keep-the-why-lint` validates the structure in CI — required fields, valid values, index consistency, hidden content — and says plainly what it cannot check: whether a recorded reason is true. That part stays with review.

[Linting →](linting/) · [Security →](security/)

</div>

</div>

</div>

<div class="ktw-section ktw-trust" markdown>

## Tested, measured, stated plainly

{% include-markdown "../README.md" start="<!-- ktw-tested-with:start -->" end="<!-- ktw-tested-with:end -->" %}

**Latest full run:** {% include-markdown "evals.md" start="<!-- ktw-latest:start -->" end="<!-- ktw-latest:end -->" %} — with the four numbers a pass count runs together, the per-case verdicts, and the caveats: [Evals →](evals/)

<p class="ktw-trust__badges">
<a href="https://skillsllm.com/security-check/IPmNycVdbOyq"><img src="https://skillsllm.com/security-check/badge.svg?owner=oliver-zehentleitner&repo=keep-the-why" alt="Security: SkillsLLM"></a>
<a href="https://github.com/marketplace/actions/keep-the-why-lint"><img src="https://img.shields.io/badge/GitHub%20Marketplace-keep--the--why--lint-2088FF?logo=githubactions&logoColor=white" alt="GitHub Marketplace: keep-the-why-lint"></a>
<a href="https://pypi.org/project/keep-the-why-lint/"><img src="https://img.shields.io/pypi/v/keep-the-why-lint.svg?label=pypi%20keep-the-why-lint" alt="PyPI: keep-the-why-lint"></a>
<a href="https://github.com/oliver-zehentleitner/keep-the-why/releases"><img src="https://img.shields.io/github/v/release/oliver-zehentleitner/keep-the-why?filter=v*&sort=semver&label=github" alt="GitHub release"></a>
</p>

</div>

<div class="ktw-section" markdown>

## What this is not

<div class="ktw-cards ktw-cards--not" markdown>

<div class="ktw-card" markdown>

**Not session memory.** Project memory is the reasoning behind the project, not a transcript or activity log of how an agent or a developer got there.

</div>

<div class="ktw-card" markdown>

**Not magic.** No tool prevents knowledge from decaying on its own. This lowers the friction of the discipline that keeps documentation honest; it doesn't replace it.

</div>

<div class="ktw-card" markdown>

**Not a platform.** No daemon, no database, no dashboard, no account. Just Markdown, Git, and the why your project would otherwise lose.

</div>

</div>

<p class="ktw-caption">The full list, and where Keep the Why fits next to ADRs, <code>AGENTS.md</code> and Keep a Changelog: <a href="readme/#what-this-is-not">README →</a></p>

</div>

<div class="ktw-footer" markdown>

[README](readme/) · [Installation](installation/) · [Philosophy](philosophy/) · [Security](security/) · [FAQ](faq/) · [Why I built this](why/) · [llms.txt](llms.txt) for AI agents

</div>

</div>
