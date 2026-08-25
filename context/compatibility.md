# Compatibility with other skills

## "Composition with other skills" needed an explicit re-check instruction, found via real testing

**Type:** incident
**Status:** active
**Evidence:** confirmed

Added a second paragraph to "Composition with other skills": checking whether Keep the Why applies isn't a one-time, start-of-turn decision — re-check specifically at the natural end of another skill's workflow step (a design settled, a root cause confirmed, an alternative rejected), since that's exactly when capture-worthy content has just been produced.

**Reason:** live-tested against a real methodology-style skill framework (installed via Claude Code's plugin system, `claude plugin install`) in a scratch project. A genuine design decision with a clearly rejected alternative (token bucket vs. a simple sleep-based throttle) played out entirely inside that framework's own brainstorming step. Keep the Why did not activate on its own afterward, despite the content matching its trigger description almost exactly. Asked directly why not, the agent's own explanation: it had checked "does a skill apply" once at the start of the turn (per the other framework's own bootstrap instruction to check before any action), then tracked that framework's workflow state through to completion without re-checking once new decision content had actually been produced mid-conversation. Once explicitly told to invoke Keep the Why afterward, it worked correctly — clean setup wizard, two well-formed entries with Decision/Alternative/Reason and Status/Evidence/Source, nothing committed unasked. The gap was specifically the *automatic* re-trigger, not the capture logic itself.

**Rejected alternative (superseded by the retest below):** leave "Composition with other skills" as originally written and treat this as something the user just has to remember to ask for. Originally rejected on the reasoning that this shouldn't need a manual nudge — see "Update after retest" for why that conclusion changed.

**Verification:** contradicted. Retested the identical scenario (same toy repo, same design conversation, fresh session) with the added re-check instruction in place — Keep the Why still did not self-trigger. Asked directly, the agent confirmed it hadn't re-checked, and explained why: the added instruction lives in `SKILL.md`'s *body*, which only enters context once a skill is already triggered — the trigger decision itself runs against the short frontmatter `description`, which this fix never touched. The instruction was, in effect, circular: only read by an agent that had already done the thing it was there to prompt.

**Update after retest:** decided not to keep chasing this with further prompt-engineering inside our own `SKILL.md` (e.g. moving the cue into `description` itself) — Claude Code's skill activation is model-driven with no hard orchestration layer, so reliability here isn't fully in our control no matter how it's worded, and iterating on wording against a moving, unverifiable target isn't a good use of effort. Two things instead: (1) document the real limitation plainly rather than implying seamless automatic composition — recommend explicitly prompting for a check after a design/debugging session concludes, until proven otherwise; (2) report the finding upstream. The methodology-style framework's own bootstrap instruction already claims to re-check *any* skill's relevance before every action, "even 1% chance" — our test shows that claim doesn't hold once a workflow step is underway. That's a legitimate, evidence-based gap in a claim they already make about their own system, worth telling them directly, not something to quietly route around on our side.

**Reported:** filed as [obra/superpowers#2051](https://github.com/obra/superpowers/issues/2051) — framed explicitly as an observation about their own bootstrap's stated behavior, not a request to change anything for a third-party skill (their `CLAUDE.md` is explicit that third-party-specific asks belong in a separate plugin, not core). Not a marketplace listing, so it doesn't belong in the "Also listed on" tables — a compatibility finding, tracked here instead.

## Activation reliability is left to each agent tool, not solved by this project

> Superseded 2026-08-01: the project init wizard now actively asks about this and has the current agent set up whatever its own platform supports — see "The wizard now asks about activation reliability" below. The reasoning below for *why the project doesn't hardcode one tool's mechanism* still holds; what changed is that the wizard now prompts and delegates to the current agent's own platform knowledge, instead of staying entirely passive on the topic.

**Type:** decision
**Status:** superseded
**Evidence:** confirmed

Keep the Why doesn't build, recommend, or document a specific mechanism (e.g. a Claude Code `SessionStart` hook) to make its own Skill activate more reliably at session start. Whether and how to strengthen activation is left entirely to each agent tool's own capabilities and the developer's own setup.

**Reason:** the underlying limitation is real and independently confirmed twice — the Superpowers re-check gap above, and the eval suite's "activation gap" failures (`docs/evals.md`). Checked directly rather than assumed: the open Agent Skills spec recognizes only `name` and `description` in frontmatter, no cross-tool "autostart" field exists, and even within Claude Code specifically there's no deterministic force-invoke mechanism — tracked upstream as an open, acknowledged gap ([anthropics/claude-code#65371](https://github.com/anthropics/claude-code/issues/65371)). Community workarounds exist for Claude Code specifically (a `SessionStart` hook injecting a reminder, ideally scoped per-project by checking for the `keep-the-why:config` marker rather than firing unconditionally) and measurably help — but they're Claude-Code-specific by construction, since hooks aren't part of the open Skill format other supported agents (Codex CLI, Gemini CLI, Cursor, ...) implement.

**Rejected alternative:** document and recommend a specific hook script as part of this project's own installation guidance. Rejected — this project deliberately stays cross-agent (same underlying principle as "No name-by-name comparison" in `positioning.md`, applied here to mechanisms instead of marketing copy): prescribing one vendor's mechanism as official guidance would misrepresent it as more solved, or more this project's job to fix, than it actually is. A tool-specific way to strengthen its own Skill activation belongs in that tool's own documentation and the individual developer's own setup, not in a repo-native, cross-agent convention.

**Consequence:** the honest position, stated plainly wherever this comes up (`docs/evals.md`, `SKILL.md`'s "Composition with other skills", the status issue): activation isn't guaranteed by this project, isn't something this project tries to fix per-tool by design, and a developer wanting stronger reliability should look at what their own agent tool offers for session-start context injection or forced tool invocation — asking directly ("initialize/check keep-the-why") always works as the reliable fallback regardless of tool.

## The wizard now asks about activation reliability, and delegates setup to the current agent's own platform

**Type:** decision
**Status:** active
**Evidence:** confirmed

The project init wizard (`references/setup.md`) now asks, as its last question, whether to set up something stronger for activation reliability if the current agent's own platform supports it. If yes, the *current* agent — not `SKILL.md` itself — checks what its own platform actually offers (session-start context injection, forced tool invocation, or similar) and sets it up scoped to this project.

**Reason:** the purely passive position above (leave it entirely to the developer to notice and solve on their own) meant most developers would never know a stronger option might exist for their specific tool, or would have to rediscover the same workaround independently, over and over, project by project. Actively asking, without SKILL.md itself naming or hardcoding a specific mechanism, keeps this project cross-agent while still surfacing the option — the instruction tells the agent to consult its *own* platform knowledge and be honest if it doesn't have one, rather than the skill's own text presuming a Claude-Code-specific answer for everyone.

**Rejected alternative:** stay silent (the prior position, now superseded) versus hardcoding a specific tool's mechanism as the wizard's actual instruction. Rejected staying fully silent — it was leaving real, available reliability improvements undiscovered for developers who'd want them. Rejected hardcoding one tool's mechanism for the same cross-agent-neutrality reason as before; the resolution is to ask, then delegate to the agent's own platform knowledge rather than to fixed prose.

**Consequence:** this isn't a standardized, tested-across-tools solution yet — it's currently solved individually, per developer and per project, whatever the agent sets up in the moment. Tracked in [the activation-reliability issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/138) — a good idea for standardizing this (a documented pattern per tool, a reusable script, or something else) is exactly what that issue is for.

**Update 2026-08-25:** `references/autostart.md` now exists — a growing collection of positive, verified examples per agent tool, starting with a Claude Code `SessionStart` hook backed by an actual eval measurement (0/10 → 10/10 activation on the affected cases, see `docs/evals.md`'s "Activation-gap follow-up"). This doesn't change who decides — the current agent still checks its own platform and decides what, if anything, to set up, exactly as above — it just gives that decision real, checked examples to draw on for tools someone has already verified something for, instead of only ever improvising from scratch. Still empty for every tool besides Claude Code; still not a mandate.
