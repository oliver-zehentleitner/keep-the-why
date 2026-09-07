---
description: "Keep the Why is a repo-native convention and agent skill that preserves the reasoning behind a codebase as project memory, kept in the repo — so your agent understands not just the code but everything around it."
hide:
  - toc
---

<div class="ktw-home" markdown>

<div class="ktw-hero" markdown>

<div class="ktw-hero__text" markdown>

<p class="ktw-hero__tagline">Keep a Changelog records what changed. Keep the Why preserves why it changed.</p>

{% include-markdown "../README.md" start="<!-- ktw-intro:start -->" end="<!-- ktw-intro:end -->" %}

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

<p class="ktw-entry__path"><code>context/retries.md</code></p>

### Why retry_with_jitter isn't a plain retry loop

**Type:** constraint<br>
**Status:** active<br>
**Evidence:** confirmed<br>
**Source:** discovered while considering simplifying it, 2026-07-22

The payment gateway's rate limiter returns 429 with a per-request `Retry-After` header. A fixed-delay retry loop would frequently retry before the limiter resets, causing repeated 429s under load.

**Considered:** replacing it with a plain retry loop, since the wrapper looked like unnecessary complexity with nothing documenting why. Not adopted once the `Retry-After` behavior surfaced during review.

</div>

<p class="ktw-caption">A change that was started and then dropped — no commit, no diff, no pull request, and normally no trace. This is what Keep the Why keeps: one entry in a topic file, plain Markdown, reviewed in the same pull request as the code around it. Every entry says how well its claim is backed (<code>Evidence</code>) and whether it still holds (<code>Status</code>); "unknown" is a valid answer. <a href="examples/abandoned-change/">The full example →</a> · <a href="repository-structure/">Field reference →</a></p>

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

`keep-the-why-lint` validates the structure in CI — required fields, valid values, index consistency — plus security checks such as hidden Unicode and others. It says plainly what it cannot check: whether a recorded reason is true. That part stays with review.

[Linting →](linting/) · [Security →](security/)

</div>

</div>

</div>

<div class="ktw-section ktw-trust" markdown>

## Tested, measured, stated plainly

{% include-markdown "../README.md" start="<!-- ktw-tested-with:start -->" end="<!-- ktw-tested-with:end -->" %}

**Latest full run:** {% include-markdown "evals.md" start="<!-- ktw-latest:start -->" end="<!-- ktw-latest:end -->" %} — with the four numbers a pass count runs together, the per-case verdicts, and the caveats: [Evals →](evals/)

<p class="ktw-trust__badges">
<a href="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/validate-skill.yml"><img src="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/validate-skill.yml/badge.svg" alt="Validate Skill"></a>
<a href="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml"><img src="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml/badge.svg" alt="ktw-lint"></a>
<a href="https://skillsllm.com/security-check/IPmNycVdbOyq"><img src="https://skillsllm.com/security-check/badge.svg?owner=oliver-zehentleitner&repo=keep-the-why" alt="Security: SkillsLLM"></a>
</p>

<p class="ktw-caption">The skill validated against the Agent Skills spec on every push; this repository's own <code>context/</code> linted by its own linter, in strict mode; the package scanned by an independent registry.</p>

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
