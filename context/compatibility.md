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

**Update 2026-08-25:** `references/autostart.md` now exists — a growing collection of positive, verified examples per agent tool, starting with a Claude Code `SessionStart` hook backed by an actual eval measurement (0/10 → 10/10 activation on the affected cases, see `docs/evals.md`'s "Activation-gap follow-up"). This doesn't change who decides — the current agent still checks its own platform and decides what, if anything, to set up, exactly as above — it just gives that decision real, checked examples to draw on for tools someone has already verified something for, instead of only ever improvising from scratch. Still empty for every tool besides Claude Code; still not a mandate. The "Consequence" paragraph above's pointer to a tracking issue is stale: that issue (#138) is now closed — a real methodology exists instead of an open-ended search for one, so ongoing contributions go directly against `references/autostart.md` (a pull request with a verified example) rather than a discussion issue; a genuinely new problem gets its own fresh issue.

**Update 2026-09-03:** the documented Claude Code hook now also matches a project still on the legacy `<!-- keep-the-why:config -->` block in `AGENTS.md`, and its injected text says "invoke the keep-the-why skill (Skill tool) now" rather than "load". Both came out of the eval suite: the migration case had never once loaded the skill because the hook only knew the new file location, and "load" was read as advice where "invoke the Skill tool" is read as an instruction (`docs/evals.md`, "Latest full-suite results"). Same position as above otherwise — one verified example, not a mandate.


## Three start paths, all gated on `.keep-the-why`

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision 2026-09-04; eval case `autostart-project-instruction-loads-skill` and its same-day control (`docs/evals.md`); one live Hermes run

`references/autostart.md` now defines how the skill gets loaded as three start paths rather than a list of per-tool tricks: every session machine-wide (developer-level, gated on the file), the project asks (a project-scoped hook where the tool has one, and/or a "Keep the Why" section in the entry-point file that any agent reading it follows), or only when a developer asks. Per-agent sections say which paths are verified how. The wizard's last question offers the three paths; the entry-point section is the one thing the wizard may write into `AGENTS.md`.

**Reason:** the skill does nothing without `.keep-the-why` (or an explicit setup request), so loading it is only worth anything on an opted-in project — every path therefore gates on the file, and "load it always" is deliberately not one of the paths: it would put `SKILL.md` into every session of every project for nothing. The entry-point section exists because hooks are per-tool and only verified for Claude Code, while every agent reads its entry-point file — and it is the natural home for a pinned, vendored skill, since it names the exact `SKILL.md` the project committed. Measured before being listed as verified: with the section and no hook, Claude Code invoked the skill first in 3 of 3 runs on a plain code question; without the section, 0 of 3.

**Rejected alternative:** an unconditional session-start load (no file check). Rejected — context cost in every unrelated project, for a skill that would then do nothing.

**Rejected alternative:** keep the entry-point file untouched under all circumstances (the previous step-6 rule in `setup.md`). Rejected — that rule protected against the skill writing its *state* there, which `.keep-the-why` now holds; a start instruction the project explicitly chose is the project's own editorial content, like the badge.

**Consequence:** the entry-point section is instruction-following, not a hook — verified on Claude Code (eval) and Hermes (single live run), listed as "should work" everywhere else until someone measures it. The eval runner's non-Claude drivers hand the skill over explicitly and so can't measure this path; a measurement there needs a driver option to skip that hand-over.

## Project setup only ever runs from an explicit request, never from an organic activation

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** [#192](https://github.com/oliver-zehentleitner/keep-the-why/issues/192)

An organic activation — the skill's own broad description happening to match an unrelated task — is never, by itself, grounds to propose or run the project init wizard on a project with no `.keep-the-why` and no legacy config block. Only an explicit request naming the skill or its purpose ("initialize Keep the Why here," "set up Keep the Why for this project") starts it. On an unopted-in project, an organic activation now does nothing project-setup-related at all — no wizard, no mention that setup is missing, not even a one-line offer — it just answers whatever was actually asked. This doesn't affect a project that's already set up (`.keep-the-why` present): organic activation there works normally for capture, retrospective recovery, and everything else this skill does; the gate applies only to first-time setup on a project that never opted in.

**Reason:** raised in #192 — a Skill's broad, model-invoked description means it can activate in a repo that never chose to use it at all (a client's repo, a scratch clone, a teammate's project), and the previous behavior treated any such activation as license to propose setting the project up. That's the actual mechanism behind "unwanted firing": not that the skill activates too often (its description genuinely does describe a lot of legitimate situations), but that activating was being treated as equivalent to consenting to setup. Separating the two — the skill can still activate and be useful without ever proposing to formalize anything — fixes the complaint without needing a narrower, more paranoid trigger description, which would have cost real recall on the cases the skill is actually supposed to catch.

**Rejected alternative:** narrow the skill's own `description` field so it matches fewer situations, so it activates less often in an unopted-in project. Rejected — this would trade away genuine detection ability (the cases this skill exists to catch) to avoid a problem that isn't really about activation frequency at all; the fix belongs in what happens *after* activation, not in suppressing activation itself.

**Rejected alternative:** keep proposing setup on organic activation, but only once per project, remembering the decline (the design this replaces). Rejected — this still means the very first organic activation in a never-opted-in project interrupts with a setup question nobody asked for; remembering not to ask again is a mitigation, not a fix for the actual complaint.

**Consequence (superseded 2026-09-04, see the next entry):** at the time, `init: declined` was kept with a narrower job — preventing a later explicit request-then-retraction from re-running the wizard from scratch. That job turned out to be empty (the same section said a fresh explicit request should ask again regardless), and the flag was retired. The related finding about an agent substituting Claude Code's auto-memory for the flag (issue #198) resolves the same way: there is nothing of the skill's own to record at that moment.

## `init: declined` retired: a called-off setup request writes nothing

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision 2026-09-04, after the three full eval runs of 2026-09-03 (`docs/evals.md`, run history); [#198](https://github.com/oliver-zehentleitner/keep-the-why/issues/198)

When an explicit setup request is declined at the first question or retracted in the same sentence, the wizard stops and writes nothing — no `.keep-the-why`, no `id`, no marker anywhere. Earlier versions wrote a `.keep-the-why` carrying `init: declined`.

**Reason:** since setup only ever starts from an explicit request (entry above), there is no unprompted question left for a "don't ask again" flag to suppress; and the section describing the flag also said a fresh explicit request should run the wizard regardless of it. A flag that neither suppresses nor blocks anything is a leftover of a change not carried through. It also had a real cost: the file it created is exactly what `.keep-the-why`-gated autostart hooks key on, so a project that had just said no got the skill loaded on every session from then on. The eval case that required writing the flag flipped in 2 of 3 runs for a reason unrelated to the skill's logic — a retracted request reads to the agent as "nothing to do", so the skill was never loaded and the agent used its own memory instead — which is what exposed the flag as pointless.

**Rejected alternative:** force the skill to load on any prompt naming it (a `UserPromptSubmit` hook) so the flag gets written reliably. Rejected — it would have made the agent reliably write a file the developer had just declined; the mechanism it protected was the problem, not the activation.

**Rejected alternative:** sharpen the skill's `description` so retracted requests still trigger it. Rejected for the same reason, plus the description is the most expensive real estate in the skill and the effect would be unmeasurable at the eval's sample size.

**Consequence:** no compatibility path for existing files carrying the value — deliberately. Such a file is a leftover of a setup that never happened; the skill treats it as an unrecognized `init` value and asks, the linter reports it, and the fix is deleting the file. Silently accepting it would have kept a retired concept alive in two places for the sake of a handful of files. The personal wizard doesn't run on a called-off setup either — its file is keyed by the project `id`, which only exists once the project is set up.
