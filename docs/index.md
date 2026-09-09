---
description: "Project memory for coding agents and humans: the reasoning behind a codebase as Markdown in the repo, versioned by Git, so nothing rejected is proposed twice."
hide:
  - toc
---

<div class="ktw-home" markdown>

<div class="ktw-hero" markdown>

<div class="ktw-hero__text" markdown>

<h1 class="ktw-hero__tagline">Keep a Changelog records what changed.<br>Keep the Why preserves why it changed.</h1>

Same question. Same wrong turn. Same explanation, again. Your agent forgets between sessions. Nothing in the repo remembers: not the code, not the changelog, not the docs.

Keep the Why is the part that remembers. Repo-native project memory for humans and coding agents. The reasoning behind a codebase — decisions, rejected alternatives, workarounds, constraints the code alone can't explain — captured as a byproduct of working with your agent and kept as plain Markdown in `context/`, versioned and shared by Git. No database, no daemon, no account.

[Install](installation.md){ .md-button .md-button--primary }
[Read the README](readme.md){ .md-button }
[Linter](linting.md){ .md-button }
[GitHub](https://github.com/oliver-zehentleitner/keep-the-why){ .md-button }
{ .ktw-hero__actions }

Open source under the [MIT license](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/LICENSE) — the skill, the linter, and this site. Nothing to sign up for, nothing that phones home.
{ .ktw-caption }

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

Decisions that shipped, alternatives that lost, workarounds, constraints — Keep the Why keeps the reasoning behind all of them: one entry per topic, plain Markdown, reviewed in the same pull request as the code. This one is the case where it matters most: a change that was started and then dropped, so there is no commit, no diff, no pull request — and without the entry, no trace. Every entry says how well its claim is backed (`Evidence`) and whether it still holds (`Status`); "unknown" is a valid answer. [The full example →](examples/abandoned-change.md) · [Field reference →](repository-structure.md)
{ .ktw-caption }

</div>

<div class="ktw-section" markdown>

## How it works

<div class="ktw-cards" markdown>

<div class="ktw-card" markdown>

### Capture

The agent notices rationale as it surfaces — a decision, an alternative that lost, a workaround, a change that was started and abandoned — and writes it down. No separate documentation step. An existing repository can start late too. History, issues and code give back only part of the past why — but from that point on every reason is written down once, never again, and the gaps that matter close over time.

[Continuous capture →](continuous-capture.md) · [Retrospective →](retrospective-analysis.md)

</div>

<div class="ktw-card" markdown>

### Check

`keep-the-why-lint` validates the structure — locally and in CI — required fields, valid values, index consistency, plus security checks such as hidden Unicode and others. It says plainly what it cannot check: whether a recorded reason is true. That part stays with review, in the same pull request as the code.

[Linting →](linting.md) · [GitHub Marketplace](https://github.com/marketplace/actions/keep-the-why-lint) · [PyPI](https://pypi.org/project/keep-the-why-lint/) · [Security →](security.md)

</div>

<div class="ktw-card" markdown>

### Keep & Share

Everything lives in `context/`, one file per topic, versioned with the code. A lean index tells an agent what to load. No daemon, no database, no service — anything that can read a repository can read it. Once merged, the why sits in the history under the same review, permissions and CI as the code. That layer — Git, on GitHub, GitLab or any other host — is what turns a local file into shared knowledge.

[Repository structure →](repository-structure.md) · [Philosophy →](philosophy.md)

</div>

<div class="ktw-card" markdown>

### Use

The next session — yours, a colleague's, an agent's — loads the index first and reads the why before touching the code. An agent that finds the reason explains it and builds on it instead of repeating the attempt; one that finds nothing says so and asks, instead of guessing. That is what the capture was for.

[Install →](installation.md) · [Autostart →](autostart.md) · [Agent matrix →](agent-matrix.md) · [Trust model →](trust-model.md)

</div>

</div>

</div>

<div class="ktw-section ktw-trust" markdown>

## Tested, measured, stated plainly

{% include-markdown "../README.md" start="<!-- ktw-tested-with:start -->" end="<!-- ktw-tested-with:end -->" %}

<p class="ktw-trust__badges">
<a href="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/validate-skill.yml"><img src="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/validate-skill.yml/badge.svg" alt="Validate Skill"></a>
<a href="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml"><img src="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml/badge.svg" alt="ktw-lint"></a>
<a href="https://skillsllm.com/security-check/IPmNycVdbOyq"><img src="https://skillsllm.com/security-check/badge.svg?owner=oliver-zehentleitner&repo=keep-the-why" alt="Security: SkillsLLM"></a>
<a href="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/hol-scanner.yml"><img src="https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/hol-scanner.yml/badge.svg" alt="HOL scanner"></a>
</p>

The skill is validated against the Agent Skills spec on every push; this repository's own `context/` is [linted by its own linter](linting.md), in strict mode; the package is scanned by two independent registries — one of them, the [HOL AI Plugin Scanner](security.md#what-automated-scanners-report-and-why), on every push in this repository's own CI — currently 92/100 with no high finding; the workflow fails below 80 or on any high finding.
{ .ktw-caption }

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

The full list, and where Keep the Why fits next to ADRs, `AGENTS.md` and Keep a Changelog: [README →](readme.md#what-this-is-not)
{ .ktw-caption }

</div>

<div class="ktw-footer" markdown>

[README](readme.md) · [Installation](installation.md) · [Philosophy](philosophy.md) · [Security](security.md) · [FAQ](faq.md) · [Why I built this](why.md) · [llms.txt](https://keepthewhy.com/llms.txt) for AI agents · [MIT license](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/LICENSE)

</div>

</div>
