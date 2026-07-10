# Naming

## The name is "Keep the Why"

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

Repo/skill name: `keep-the-why`. Tagline: "Because 'ask Bob' is not documentation." Positioning line: "Keep a Changelog records what changed. Keep the Why preserves why it changed."

**Reason:** deliberate homage to [Keep a Changelog](https://keepachangelog.com/) — same naming pattern, same "lightweight open convention, not a platform" spirit, borrows an existing, well-liked mental model instead of asking readers to learn a new one from scratch. Checked for collisions (GitHub, `.ai` domains, company/product names) before settling — none found in this specific niche.

**Known residual risk:** the word "Keep" is moderately busy in the OSS/dev-tooling space (KeepHQ, an AIOps/alerting platform; Google Keep). Judged as acceptable because neither is a direct competitor in the same conceptual space — unlike the two rejected alternatives below, where the collision was with something conceptually adjacent enough to actually confuse people.

## Rejected: "Backstory"

**Status:** superseded
**Confirmed**

First choice. Worked as a name for the *methodology* (not tied to one tool, analogous to how "Scrum" names a method independent of any implementing tool). Checked for collisions in the GitHub/agent-skill niche — clean.

**Rejected because:** a broader collision check found that `backstory.ai` is the rebranded **People.ai** — a YC-backed company, $100M+ raised, an AI revenue/sales-intelligence platform, freshly renamed to "Backstory" at the time of this check. Same name, same broad "AI product" category, well-funded, actively marketed. High collision and brand-confusion risk if this project ever gained visibility.

**What this taught the process:** the original collision check was scoped too narrowly (GitHub/dev-tool niche only). It missed a collision in the *general AI-product-branding* space entirely. Every subsequent naming round explicitly added a `<name>.ai` + general-web-search check as a required step — see `naming.md`'s "Keep the Why" section above, which was checked this way before being accepted.

## Rejected: "Anti-Legacy"

**Status:** superseded
**Confirmed**

Second choice, proposed via a ChatGPT brainstorming session the maintainer ran in parallel. Repo name would have been `anti-legacy`, same "ask Bob" tagline. Argued as an improvement over "Backstory" because it's problem-first (names the pain, not the resulting artifact) and covers both prevention and retrospective recovery in one word.

**Rejected for three reasons**, found when this Claude Code session checked the proposal critically before accepting it:

1. **Market noise:** "Zero Legacy" is an active Slalom marketing campaign; "Anti-Consulting" is a Thinktiv brand; the broader "legacy modernization" consulting space is saturated with exactly this vocabulary (Gartner citation used at the time: 70% of enterprise workloads on legacy systems, 80% of IT budget). "Anti-Legacy" would have read as generic enterprise-consulting language, not an ownable OSS tool name.
2. **Accusatory framing risk:** naming a tool after the user's own failure state ("your code is Legacy, we're Anti that") risks reading as an accusation aimed at maintainers of long-lived codebases — exactly the audience this project needs to not alienate.
3. **A false dichotomy in the reasoning against "Backstory":** the argument was "Backstory names the result, not the pain" — but Docker isn't named "Anti-Inconsistent-Environments" either; the pain is carried by positioning and tagline, not by the brand noun itself. A neutral, artifact-style name paired with a sharp pain-first tagline works fine.

**What survived from this round anyway:** the tagline "Because 'ask Bob' is not documentation" is name-agnostic and strong — kept for the final name. "Anti-legacy" still works as a category *descriptor* in prose, just not as the primary brand noun.
