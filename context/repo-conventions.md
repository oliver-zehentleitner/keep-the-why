# Repository conventions

## Automation tokens need the `workflow` OAuth scope to push workflow files

**Status:** active
**Evidence:** confirmed

An operational constraint, not a design choice: any push that touches `.github/workflows/*.yml` is rejected by GitHub unless the pushing credential has the `workflow` OAuth scope — this is independent of the `repo` scope and applies to any token or bot/automation account that lacks it, not specific to this repo.

**Workaround:** if the pushing credential lacks the `workflow` scope, prepare the workflow file's content separately and have someone with appropriate access add it manually (via the GitHub UI or their own credentials), while pushing everything else in the same change normally by excluding just the workflow file from that commit.

## The installable skill lives under `skills/keep-the-why/`, not at the repo root

**Status:** active
**Evidence:** confirmed

`SKILL.md`, `references/`, `examples/`, and `evals/` moved from the repo root into `skills/keep-the-why/`. Everything else (`docs/`, `mkdocs.yml`, `context/`, CI config) stays at the root — it's this project's own site and self-documentation, not part of what gets installed into someone else's project.

**Reason:** `gh skill install` (GitHub CLI v2.90.0+) discovers skills via the `skills/*/SKILL.md` convention. A repository with `SKILL.md` directly at its root doesn't match that pattern and isn't reliably discovered — a known, currently open upstream bug (cli/cli#13552) confirms this specifically for root-level single-skill repos. Moving the skill under `skills/keep-the-why/` isn't just tidier structure, it's what makes the recommended install path (`gh skill install oliver-zehentleitner/keep-the-why`) actually work.

It also fixes a second, independent problem: cloning this whole repository into an agent's skills directory (the previous install method) nests an embedded git repository inside the target project and pulls in unrelated files (docs, mkdocs config, CI, evals) that have nothing to do with running the skill.

**Rejected alternative:** keep `SKILL.md` at the root and only document the limitation (`gh skill install` won't discover it, use manual clone instead). Rejected because the manual-clone fallback has its own real problem (the embedded-repo issue above) — accepting both limitations to avoid one file move wasn't a good trade.

## Launch-readiness pass: SKILL.md trimmed, negative evals added, README reordered

**Status:** active
**Evidence:** confirmed

Four changes made together ahead of publishing to skill marketplaces: `SKILL.md` cut from ~2100 to ~1580 words (merged redundant rules, tightened the Record workflow step instead of restating rules 9/13 in full); six negative-case evals added (routine changes that shouldn't trigger the skill, an already-good doc structure that shouldn't be rebuilt, conflicting sources, a secret in an interview answer, a stale confirmed decision past its revisit trigger); README reordered so Install and a concrete Example come right after the pitch, with the longer "Problem" and "Where this fits" sections moved below instead of gating the actionable content; and social preview meta tags (Open Graph/Twitter card, pointing at the existing logo) added via a small `overrides/main.html` template.

**Reason:** all four came out of an external review before the intended launch — the SKILL.md length and README ordering were both flagged as things a technically experienced reader would stumble on even though the underlying idea was sound, and the missing negative evals were a real gap (every existing eval tested "the skill should do X," none tested "the skill should stay quiet" or "the skill should flag a conflict instead of guessing").

**Rejected/deferred:** a cross-agent test matrix (Claude Code, Codex CLI, Gemini CLI) was suggested alongside the evals. Not done here — this environment only has access to Claude Code, and claiming test results without having actually run them would violate rule 1 (never invent) applied to the project's own claims about itself. `CONTRIBUTING.md` asks for real cross-agent results as a contribution instead of asserting them prematurely.

## Setup/init state is tracked opportunistically, not via a real background schedule

**Status:** active
**Evidence:** confirmed

The skill's periodic checks (update availability, `context/` staleness) run as an "elapsed time since last check" comparison evaluated whenever the skill is already active in a session — not a true OS-level scheduled job (`cron`, Task Scheduler) that wakes something up on its own.

**Reason:** a Skill has no background execution — it only runs inside an active agent session. A real OS cron entry would need to shell out to a specific agent's non-interactive invocation (e.g. `claude -p "..."`), which only works for agents that expose one and ties the mechanism to a single vendor, contradicting the project's cross-agent goal. Comparing elapsed time on every session start works identically regardless of which agent is running the skill.

**Rejected alternative:** a real OS-level scheduled job that invokes an agent CLI directly. Rejected for the cross-agent portability reason above, not for being harder to build — it's better *if* you only ever use one specific agent, but that's not a constraint this project wants to impose.

## Config state lives in delimited blocks inside existing entry-point files, not a separate file

**Status:** active
**Evidence:** confirmed

Setup state is written into `<!-- keep-the-why:config -->` / `<!-- keep-the-why:local -->` blocks inside files the project already has a reason to read (`AGENTS.md` and `AGENTS.local.md`), not a dedicated state file.

**Reason:** keeps the state next to files every agent working in the repo is already expected to read, instead of adding a new file nobody has a reason to look at otherwise. The HTML-comment delimiters keep it easy to locate and parse without needing to interpret the rest of the file, and keep it visually out of the way of the human-readable pointer content those files are otherwise supposed to stay limited to.

**Rejected alternative:** a separate state file (e.g. `.keep-the-why.json`). Rejected because it adds a file whose only reader is this skill, splits state away from the files that already serve as the project's agent entry points, and a dedicated dotfile invites exactly the kind of "second undocumented system" the config-block approach was chosen to avoid.

## Setup state splits across a project block and a personal block

**Status:** active
**Evidence:** confirmed

Where `context/` lives, whether the project has been initialized, and how much confirmation is needed before writing (`capture-confirmation`) are in the committed `AGENTS.md` config block. Capture-mode preference, `confirmation-flow` (how multiple pending confirmations get presented), and the update-check/consistency-check intervals and their last-run timestamps, are in the personal, uncommitted `AGENTS.local.md` block instead. A project can be `init: complete` while a specific developer still gets asked their own preferences, if they don't have an `AGENTS.local.md` yet.

**Reason:** the first version bundled everything into one committed block. Oliver pointed out that capture-mode and check-interval preferences are individual workflow choices, not project facts — one developer wanting weekly update checks and another wanting none are both fine, and forcing one answer onto everyone (or making it a merge-conflict-prone shared timestamp several sessions race to update) doesn't fit the existing `AGENTS.md`/`AGENTS.local.md` boundary this project already draws for exactly this kind of distinction.

**Rejected alternative:** one combined block covering both project and personal state, as originally shipped. Rejected once the personal/project distinction became clear — see above.

## Update-check failures get surfaced once, not swallowed indefinitely

**Status:** active
**Evidence:** confirmed

If the update check can't run (no web access this session), the first failure is reported and the user is asked whether to keep retrying each session or turn the check off. Subsequent identical failures don't re-ask.

**Reason:** the first version skipped silently on failure, on the reasoning that a check that can't run shouldn't nag about it. Oliver pointed out the actual risk: for a user whose agent never has web access, that check would be permanently and invisibly broken — silence reads as "nothing to report," not "this has never once worked." A single surfaced notice, with the option to just turn it off, avoids both the nagging and the false sense that the check is doing anything.

**Rejected alternative:** always skip silently on failure (the first version). Rejected because it can't be distinguished from "checked, nothing new" — the two states look identical to the user, and one of them is worth knowing about.


## `context-schema` always tracks the released version, even when nothing migrated

**Status:** active
**Evidence:** confirmed

Every release advances this repo's own `context-schema` (in this file's config block) to match the just-released `metadata.version`, even when that release introduced no `context/` entry format change — not just when `migrations.md` had something to apply.

**Reason:** during the 0.3.1 release, `context-schema` was left at `0.3.0` because nothing in `migrations.md` applied to the 0.3.0→0.3.1 gap — but "nothing to migrate" and "don't advance the number" are different things. Leaving it behind made a later external review flag it as if the skill's own schema-comparison logic were broken, when the actual bug was simpler: the release process itself skipped the catch-up step that `setup.md`'s existing behind-case logic already calls for.

**Rejected alternative:** a separate `metadata.context-schema` field in `SKILL.md`, decoupled from `metadata.version`, so schema and release versioning could drift independently. Rejected — the existing single-version-axis model (check for applicable migrations, advance the number whether or not anything applied) already does everything a second version field would, without a second number to keep in sync.

## `release.yml`'s checkout pins the actual release tag, not the workflow's trigger ref

**Status:** active
**Evidence:** confirmed

The `GH Release` workflow's `checkout` step explicitly sets `ref: ${{ github.event.inputs.tag || github.ref }}`, and "Move latest tag" moves `latest` to that same resolved tag rather than an implicit `HEAD`.

**Reason:** `actions/checkout@v4` without an explicit `ref` checks out whatever triggered the workflow. For the normal tag-push trigger that's already correct (the trigger ref *is* the tag). For a manual `workflow_dispatch` run with a typed-in tag input, though, the trigger ref is whatever branch the dispatch was run from — not necessarily the tag someone typed into the input box. Without pinning `ref` explicitly, a manual dispatch could package and release the wrong commit under the requested tag's name. Caught by external review; we'd only ever used the tag-push path in practice, so it hadn't surfaced.

**Rejected alternative:** leave it as-is, reasoning that we never actually use manual dispatch. Rejected — the input field existing at all implies it's meant to work correctly, and a latent bug that only bites on a rarely-used path is still worth fixing once known.

## `capture-confirmation` is project-wide only, for now — deliberately, to test first

**Status:** active
**Evidence:** confirmed

`capture-confirmation` (automatic / confirm-always / confirm-when-unsure — how much permission is needed before writing to `context/`) lives only in the project config block (`AGENTS.md`), with no personal override in this release, even though `capture-mode` and `confirmation-flow` are both personal.

**Reason:** Oliver's call: test the setting project-wide first and see how it behaves in practice before deciding whether individual developers should be able to override it. The resolution order (session instruction → personal setting → project setting → default) is deliberately structured so a personal override slots in later without restructuring anything — same pattern as `migration-prompt: <version> declined` — but adding it now, before there's any real usage to learn from, would be guessing at a need rather than confirming one.

**Rejected alternative:** ship a personal override immediately, symmetric with `capture-mode` and `confirmation-flow`. Rejected for now — not because it's wrong in principle, but because whether developers actually want to diverge from the project's confirmation bar is an open question this release is meant to help answer, not one to presume the answer to upfront.
