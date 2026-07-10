# Keep the Why — Project Reference

Name is **final**: **Keep the Why** (repo/skill: `keep-the-why`). Naming history (why "Backstory" and "Anti-Legacy" were rejected first) kept in §6 for context — worth reading once, not relevant to building.
Author: Oliver Zehentleitner (25+ yrs dev, maintainer of the UNICORN Binance Suite, blogs at technopathy.club) + his Claude Code agent, with marketing/naming input from ChatGPT.
Status: naming and scope locked, nothing built yet. Oliver is creating the GitHub repo now. Next: SKILL.md, examples, article, skills.sh listing.

**Note on mentions of "Backstory" below:** earlier sections were written while that was still the working name. Read "Backstory" as "Keep the Why" wherever it appears outside §6 — concept, structure and positioning didn't change, only the name did.

---

## 1. Core idea

When a developer works with an AI coding agent, the *why* behind decisions — architecture choices, rejected alternatives, the problem that triggered a change — normally lives only in ephemeral chat history. It's discussed once, then lost. This is the same failure mode that produces "legacy code": not code without tests (Michael Feathers' classic definition), but code whose *rationale* nobody remembers.

**Keep the Why** is the proposal (and eventual Claude Code Skill) to have the AI agent proactively distill this rationale into structured, living documentation files, committed to the repo alongside the code — so a new developer (or a future AI session helping them) can reconstruct the reasoning as if talking to the original author, instead of doing archaeology or waiting for someone to remember.

Tagline: **"Because 'ask Bob' is not documentation."** (final, see §6)

### The precise pain (sharpened during brainstorm)

"The next dev gets an answer" is the end-state, not the pain itself. The actual pain is **wasted or risky repetition** — time and trust lost because a decision that was already made correctly isn't retrievable, so it gets re-fought or silently undone. Three concrete shapes of this:

1. **Re-debate** — a team or an AI re-discusses an architecture question that was already deliberately settled months ago, because nobody (including a fresh AI session) remembers it was settled.
2. **Silent regression** — the expensive case: someone (human or AI) "cleans up" or "simplifies" an ugly-looking workaround because the reason for it isn't visible, and unknowingly reintroduces a bug that was already fixed. Classic Chesterton's Fence, except now the fence-remover can be an AI agent moving fast.
3. **Onboarding stall** — a new dev doesn't touch code they don't understand, out of caution, so progress stalls rather than risking the unknown.

Specifically relevant to AI-assisted work: every fresh agent session starts context-empty. Without captured rationale, the agent either burns time/tokens re-deriving reasoning from the code, or — worse — doesn't realize a workaround was deliberate and proposes exactly the regression in point 2.

Pitch line: **"Keep the Why doesn't stop knowledge from disappearing — it stops disappeared knowledge from costing you money, time, or a repeat bug."**

## 2. Origin of the idea (the personal-observation hook for the article)

Oliver noticed this organically while working with Claude Code day to day: he already discusses problems and tradeoffs conversationally with his agent before any code gets written, and the agent already documents outcomes reasonably well. He realized formalizing the *why*-capture into a habitual, low-effort practice — barely any extra work for him — would incidentally solve the "codebase inaccessible to anyone but the original author" problem that defines legacy software. That's the narrative arc for the article: noticed it while working → realized it's basically free → realized it solves a bigger problem → researched prior art with his agent → built something informed by that research.

## 3. Competitive landscape / prior art (researched 2026-07-10)

This is **not** a green field. Useful for the article to acknowledge honestly rather than risk looking uninformed:

- **Architecture Decision Records (ADRs)** — Michael Nygard, 2011 essay, building on Philippe Kruchten's decision-log concept. MADR is the dominant modern template. Human-authored, point-in-time, one file per decision, frozen once accepted. The foundational concept everything below reacts to.
- **AGENTS.md** — real, actively maintained open standard, now stewarded by the Agentic AI Foundation under the **Linux Foundation**. 60,000+ repos, 23+ compatible agent tools (agents.md). Content is static/curated (build commands, style rules) — explicitly *not* decision-rationale, not session-evolving.
- **git-why** (github.com/hexapode/git-why) — closest existing match to the idea. Pre-commit hook detects the active AI session (Claude Code, Cursor plugins), extracts reasoning, writes a `.why/` shadow-tree mirroring the source tree (`.why/src/auth.py.md`), auto-committed. Small (22 stars) but real, shipped, has a Claude Code plugin.
- **AgDR / Agent Decision Records** (me2resh.com) — ships an actual `/decide` Claude Code Skill, Cursor rules, pre-commit hooks blocking architecture changes without a matching AgDR. Difference: it's a **human-filled checkpoint**, not the AI auto-scribing from the conversation.
- **Addy Osmani's `fyi.md`** — originally just a prompting pattern ("structured notes-to-self"), session-scoped only. **Update:** has since become a real `documentation-and-adrs` SKILL.md inside his published `addyosmani/agent-skills` repo — closer to our territory than the original blog post suggested. High name recognition (ex-Google Chrome/DX).
- **Piethein Strengholt's "ADR Writer Agent"** — a separate conversational tool for drafting ADRs, not woven into an actual coding-agent session.
- **Lore** (arXiv 2603.15566) — academic paper proposing rationale capture via structured git-trailer syntax in commit messages, not repo files.
- **Mneme HQ** — different axis: focuses on *enforcing* ADRs (blocking edits without one) rather than *capturing* them.
- **Decision Decay paper** (arXiv 2601.21116) — found 23% of AI-generated decisions had stale supporting evidence within two months. Strong supporting citation for why *living*, editable docs beat frozen point-in-time ADRs.
- **engram** (github.com/NickCirv/engram) — mature, more general competitor: "the context spine that 10x's every AI coding session," 89% claimed token reduction, live in 8 IDEs (Claude Code, Cursor, Cline, Continue, Aider, Codex, Windsurf, Zed), npm + OpenVSX + Anthropic Plugin Directory, Apache 2.0. Focused on context-loading efficiency broadly, not specifically on decision-rationale capture or the legacy-code framing.
- **"spine"/"context-spine" naming space** is crowded (project-spine, mcp-spine, Nodewarrior/spine, engram) — avoided as a name for this reason.
- Cursor `.cursorrules`/rules, GitHub Copilot custom instructions, Windsurf rules, Aider conventions files — all static-context-only, don't evolve from session dialogue.
- Devin's Knowledge Base / Playbooks — persistent and semantically triggered (closer to "evolving"), but human-curated, not auto-derived from conversation.

**Bottom line:** at least four independent people/projects converged on some version of this idea in the last ~9 months. A post pitching "AI should document its own decisions" as if novel would look uninformed. The article needs to cite this landscape and stake out a narrower, defensible angle.

## 4. The differentiated angle (what's actually fresh)

Three things nobody in the prior art combines:

1. **Legacy-code reframing.** Michael Feathers owns "legacy code = code without tests" as a canonical, citable definition. Nobody owns an equally clean "legacy code = knowledge loss" framing yet. That's an open, quotable hook for the article.
2. **Structure: topic-split living docs, not shadow-tree or per-decision files.** git-why mirrors the source tree 1:1 (disconnected from where a human would look for "why"). AgDR is one file per decision, human-triggered. Keep the Why's structure is organized by *topic* (`auth.md`, `depthcache-sync.md`, etc.), wiki-style — entries get amended/marked-superseded over time rather than frozen, which directly addresses the Decision Decay finding (§3).
3. **Two further structural ideas from this brainstorm, neither of which appears in *any* prior art found:**
   - **Docs vs. context as two deliberate layers**, mapping to the established Diataxis framework (Procida): `docs/` = how-to/reference (human usage access — and the AI can read the exact same docs, no duplication needed, since the format is primarily for humans and only secondarily for the agent); `context/` = explanation/history (what is this project, where did it start, what problems came up, how were they solved).
   - **An index file with deliberate pointers into sub-topic files, designed explicitly to keep the agent's context window lean** — not just human navigability. This reframes documentation structure as a *retrieval/context-engineering problem for the agent itself*, which is a genuinely new angle vs. all prior art (which thinks about doc structure purely from a human-readability standpoint). The skill should also actively notice when a topic file is bloating and propose splitting it — self-monitoring reorganization, which no prior tool does (they're all write-once, static).

## 5. Structural design (three-tier file model)

- **`AGENTS.md`** — stays lean, the entry point. Just a short pointer into the Keep the Why system (few lines), leaving room for whatever else is project-relevant per the open AGENTS.md standard. Deliberately *not* stuffed with the whole system, to stay compatible with the 23+ tools that already read this file.
- **`docs/` + `context/`** — the actual system. `docs/` = human-usage-facing (how do I use this, incl. tests as a natural subset — no separate "testing" chapter needed, it's just part of usage docs). `context/` = the project narrative/rationale layer (why decisions were made, what alternatives were rejected, how problems were solved). Both are read directly by the agent too — no parallel AI-only copy. Organized as an index + topic-split spokes, sized to avoid bloating the agent's context window; skill actively watches for bloat and proposes restructuring. Not fully prescriptive — different projects (a one-off script vs. a multi-repo suite) need different depth, so the skill adapts rather than enforcing one fixed shape.
- **`AGENTS.local.md`** — personal, per-developer, not committed, not globally relevant (individual preferences/local environment notes). Generic and tool-agnostic by design.

Side note from this brainstorm (not article-critical, but shaped the thinking): Oliver's own existing convention across his repos used a `CLAUDE.md` file for this personal/local layer. In retrospect he considers that an early design mistake — `CLAUDE.md` is really just an `AGENTS.local.md` under a tool-specific name. Going forward the principle is: a tool-specific file (`CLAUDE.md`, `CODEX.md`, etc.) should be the *exception*, reserved only for content that's genuinely exclusive to one specific AI tool — in practice, no such case has come up yet. `AGENTS.local.md` is the default.

## 6. Naming — STATUS: OPEN, two candidates rejected, help wanted

Naming has gone through two rounds already. Both landed on real, concrete problems. Read this section before proposing new candidates, so the same mistakes aren't repeated.

### Round 1: "Backstory" — REJECTED (name collision)

Original idea: "Backstory" as the name of the method/methodology (the three-tier structure, docs-vs-context split, index+spokes principle) — analogous to "Scrum" naming a method independent of any one tool. Checked for collisions in the *dev-tool/agent-skill/GitHub* niche on 2026-07-10 — clean, nothing found there. Tagline was strong: *"AGENTS.md tells the agent what to do. Backstory tells it why."*

**Rejected after a broader check found `backstory.ai`** — this is the former **People.ai**, a YC-backed company that raised $100M+ and just rebranded to "Backstory" as an AI revenue/sales-intelligence platform. Same name, same broad "AI product" category, well-funded, actively marketed, freshly rebranded (meaning likely vigilant about brand protection). "Backstory AI" as a search term is now dominated by them, not us. The earlier niche-only collision check was too narrow — it missed this because it only checked developer-tool/GitHub context, not the general "AI product branding" space. **Lesson for the next round: any candidate must be checked as `<name>.ai`, `<name> AI` (general web search, not scoped to GitHub), and for existing funded companies/products under that name — not just dev-tool-niche collisions.**

### Round 2: "Anti-Legacy" — REJECTED (market noise + framing risk)

ChatGPT's counter-proposal: **Anti-Legacy** (repo `anti-legacy`, tagline *"Because 'ask Bob' is not documentation"*), argued as broader than Backstory because it covers both prevention and retroactive recovery, and is more problem-first than solution-first.

Rejected for three reasons, after a collision check Oliver's Claude agent ran:
1. **Market noise**: "Zero Legacy" is an active Slalom marketing campaign; "Anti-Consulting" is a Thinktiv brand; the whole "legacy modernization" consulting space (Gartner: 70% of enterprise workloads on legacy systems, 80% of IT budget) is saturated with this exact vocabulary. "Anti-Legacy" would read as generic enterprise-consulting noise, not an ownable dev-tool brand.
2. **Framing risk**: naming a tool after the user's own failure state ("your code is Legacy, we're Anti that") risks reading as an accusation rather than a tool, especially to an audience of long-term maintainers (Oliver's own audience, maintaining a multi-year suite).
3. **False dichotomy in the reasoning**: the argument against Backstory ("names the result, not the pain") doesn't actually hold up — Docker isn't named "Anti-Inconsistent-Environments," it's an artifact metaphor, and the pain is carried entirely by positioning/tagline, not the brand noun. A neutral/artifact-style name paired with a sharp pain-first tagline (see below) works fine; the name itself doesn't need to scream the problem.

**What survived from round 2 and should carry forward regardless of the final name:** the tagline *"Because 'ask Bob' is not documentation"* is strong and name-agnostic — keep it. "Anti-legacy" can still work as a **category descriptor/adjective in copy** ("an anti-legacy agent skill") even though it shouldn't be the primary brand noun.

### What's available / constraints for round 3

- Oliver owns **technopathy.club** and can create a subdomain for docs (e.g. `skillname.technopathy.club`) — this removes pressure to find a name with an available fresh apex domain or `.ai` domain; a subdomain is enough for docs/landing purposes, so the domain check matters less than the trademark/collision check.
- Repo will likely be `<name>` or `<name>-skill` on GitHub — check that namespace too, but it's the least risky check (GitHub repo names collide far less consequentially than a funded company's product brand).
- **Required checks for any new candidate before it's treated as viable:** (1) `<name>.ai` — who owns it, what do they do; (2) general web search for `"<name>" AI` and `"<name>" software/tool/startup` — not scoped to GitHub/dev-tool sites; (3) GitHub/skills-marketplace niche check (the check that worked fine both previous rounds); (4) quick gut-check on whether the name accuses the user's own code/practice of being the problem (the Anti-Legacy framing risk) vs. staying a neutral artifact/method name.
- Everything else about the project (problem, positioning, structure, competitive landscape) is unaffected by the name — see §1–5 and §7–9 below, all still current.

### Round 3: "Keep the Why" — ACCEPTED, final

Repo/skill name: `keep-the-why`.

- Tagline: **"Because 'ask Bob' is not documentation."**
- Positioning line: **"Keep a Changelog records what changed. Keep the Why preserves why it changed."** — the relationship to Keep a Changelog (keepachangelog.com) is deliberate homage, stated explicitly, not an accident or a claimed official relationship. Borrows a familiar, respected OSS naming pattern without copying its visual identity.
- Short description: **"A repo-native agent skill that continuously captures or retrospectively recovers the reasoning behind a codebase."**
- Checks passed (2026-07-10): no `keep-the-why` collision on GitHub, no `keepthewhy.ai` registration found, no company/product collision. Adjacent `thewhy.ai` is an unrelated newsletter (low risk, different category). Root word "Keep" is moderately busy in OSS/dev-tooling (KeepHQ/AIOps, Google Keep, several `keep-*` repos) — milder risk than the previous two rejections (no direct competitor in the same conceptual space), manageable via a consistent tagline/subtitle in all listings.
- Framing check: passes — positive imperative, doesn't accuse the user's code or practice, same register as Keep a Changelog.

This closes the naming question.

### Marketing analogy: "Docker for repos and programmers"

Oliver's own framing, half-joking but structurally sound: Docker made *environments* portable — no more "ask Bob how the server is set up." Keep the Why makes *reasoning* portable — no more "ask Bob why we built it this way." Same underlying move: take knowledge out of one person's head/machine and put it into a versioned artifact that travels with the project.

Candidate tagline from this: **"Docker made environments portable. Keep the Why makes reasoning portable."** (secondary — primary tagline is the "ask Bob" line, see §6)

Caveat worth keeping in any copy that uses this analogy: Docker is a *hard, enforced, deterministic* guarantee (the container runtime enforces reproducibility). Keep the Why is *soft* — quality depends on how disciplined the capture is, nothing enforces it, and content can still go stale (ties back to the Decision Decay paper in §3). Better framed as "the Docker *principle* applied to knowledge" than "a Docker-grade guarantee for knowledge," so the analogy doesn't overpromise. (ChatGPT's tone guardrails in §6d independently landed on the same caveat — good confirmation signal.)

## 6b. Repository structure (from ChatGPT's plan, adopted)

Skill repo itself:

```text
keep-the-why/
├── SKILL.md
├── README.md
├── CONTRIBUTING.md
├── LICENSE          (still undecided — MIT vs Apache 2.0, Oliver to pick)
├── examples/
└── references/
```

Structure the skill generates inside a *target* project:

```text
project/
├── AGENTS.md          # lean entry point, pointers only
├── AGENTS.local.md     # personal/local, not committed
├── docs/                # usage-facing: setup, operation, APIs, testing, deployment, troubleshooting
└── context/
    ├── index.md         # lean index, deliberately kept small for agent context efficiency
    └── ...              # topic-organized, not a file-per-source-file shadow tree, not one frozen file per decision
```

## 6c. v0.1 scope (concrete capability checklist)

- Inspect an existing repository, detect current documentation structure.
- Initialize a minimal Keep the Why structure.
- Distinguish usage docs from rationale/context.
- Identify knowledge gaps and unexplained code.
- Ask focused, specific questions instead of generic interview questionnaires (retrospective mode).
- Capture important rationale from the current conversation (continuous mode).
- Update existing topic files instead of endlessly creating new ones.
- Mark outdated/superseded knowledge clearly rather than deleting it.
- Maintain a lean index for agent retrieval.
- Detect bloated topic files and propose splitting them.
- Work with zero external services — no required MCP server, database, or proprietary platform. (This is itself a differentiator worth stating explicitly in the article — most competing approaches assume some infra.)

Key mechanic for retrospective/interview mode, stated precisely so it doesn't get built as "generate generic interview questions": **the agent should identify what the code cannot explain, and only then ask a human — not explain everything it can already infer and pad the rest with generic questions.**

## 6d. Tone / positioning guardrails (do not overclaim)

Explicit list of claims to avoid, in the article and in the repo copy:

- Don't claim this completely prevents legacy software.
- Don't claim every piece of rationale is recoverable.
- Don't claim AI-generated documentation is automatically correct.
- Don't claim the general idea (AI-assisted rationale capture) has no prior art — it does, cite it (§3).
- Don't claim a deterministic guarantee comparable to containers (ties back to the Docker-analogy caveat above — same principle, restated by ChatGPT independently, good sign it's the right guardrail).

Preferred practical framing instead of a grand claim:

> "This workflow emerged from real work with coding agents. The agent already participates in the conversations where important project knowledge is created. Keep the Why turns that temporary conversation into maintainable project knowledge."

Final candidate key messages (pick from these for headlines/subheads, don't need to use all):
- "Because 'ask Bob' is not documentation."
- "The code survived. The knowledge didn't."
- "Code becomes legacy when nobody remembers why it exists."
- "The agent finds what the code cannot explain — and asks before the answer disappears."

## 7. Deliverables & plan

1. GitHub repo (name TBD — was `backstory-skill`, blocked on §6) — Oliver creates it.
2. The actual Claude Code Skill (SKILL.md + supporting structure) implementing the three-tier model above.
3. A full-length article in Oliver's voice, for his technopathy blog, cross-posted to dev.to. Narrative arc: personal observation while working → realized it's low-effort → realized it solves the legacy-knowledge problem → researched together with his AI agent → found git-why/AgDR/Osmani/engram/the academic papers → three concrete learnings from that research (Feathers-gap, static-vs-evolving tooling landscape, decision-decay risk) → built Keep the Why → here's exactly how it works, link to the repo.
4. List on skills.sh, possibly Claude and Codex marketplaces.
5. Reddit/LinkedIn promotion is explicitly **out of scope for now** — that's step 2, after the article and repo exist. Don't optimize the article's structure around promotion; it should just be a good, complete piece in Oliver's own style.

## 8. Tone/style guidance for the article

- Should read as "here's a problem I hit and a technique that helped," not a product pitch — dev.to/r-programming-style audiences are allergic to hype and self-promotion framing.
- Concrete, specific, grounded in named prior art (cite git-why, AgDR, Osmani, engram honestly) rather than pretending to invent the space.
- Oliver's own voice: informal but technically precise, 25+ years experience, peer-to-peer register, no fluff.

## 9. What's being asked of ChatGPT here

**Immediate ask: round 3 of naming (see §6)** — help find a name that survives the four checks listed there. This is the current blocker.

Once a name lands: marketing brainstorm support (positioning, headline options, distribution ideas for the *later* promotion phase) and **graphics generation** (diagrams for the three-tier structure, the index+spokes concept, a comparison graphic against git-why/AgDR/engram, and a logo/hero image for the final name). This document is the full context dump so ChatGPT doesn't need re-explaining from scratch.
