# Linter (`lint/`, keep-the-why-lint)

Design decisions internal to the structural linter. Where it lives and how it's versioned is in `release-and-distribution.md`.

## Checks are gated by the target project's `context-schema`

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-01; gates mirror `references/migrations.md`
**Revisit when:** a skill release changes entry structure — add the gate and bump `lint/ktw_lint/__init__.py` in the same release cycle

The linter reads `context-schema` from the target's `.keep-the-why` (or the pre-0.10.0 legacy `AGENTS.md` block) and enforces only what that skill version defines. A missing `context-schema` is assumed to be 0.2.0 — the skill's own backfill default — with a warning. A `context-schema` newer than the newest gate the linter knows gets a warning (`W003`), not an error: the project is linted with every known gate, and the warning points at `migrations.md` to decide whether a linter update matters.

**Reason:** the skill's migration philosophy is "next time touched, not a big-bang backfill." A linter enforcing the latest schema against every project would fail exactly the projects behaving correctly under that rule, and turn every skill release into a forced migration.

**Rejected alternative:** always lint against the newest schema and let projects carry an ignore-list. Rejected because the schema version is already recorded per project — an ignore-list would duplicate that fact in a second, driftable place.

## Severity model: errors block, "next-touched" material warns; index sorting is an error

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-01 (index sorting as an error was an explicit maintainer call)
**Revisit when:** warnings turn out too noisy or too quiet in real CI use

Invalid values, missing mandatory fields, broken config, index breakage, and hidden-content characters are errors (exit 1). Things the skill itself says get fixed "the next time the entry is touched" — a missing `Type` on an old entry, a missing guard file — are warnings, promotable via `--strict`. Index sorting is deliberately an **error**: the fix is mechanical, and the convention's merge-conflict benefit only exists when the whole list is actually sorted (same reasoning as the 0.10.0 migration entry's "do it now, not on next touch").

**Rejected alternative:** everything as errors for maximal rigor. Rejected because it would punish projects for following the skill's own retrofit rule.

## A level-2 heading without schema fields is a warning, not an error

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** implementation decision, 2026-09-01, checked against this repository's own `context/`
**Revisit when:** real-world false positives or false negatives show up either way

An `##` heading in a topic file with no recognized field lines gets `W102`, not a missing-`Status`/`Evidence` error pair. Mandatory-field errors fire only once at least one recognized field marks the heading as an entry.

**Reason:** topic files legitimately contain prose sections alongside entries, and nothing structural distinguishes "prose section" from "entry someone forgot to tag." Erroring would forbid prose sections; staying silent would hide genuinely untagged entries. A warning names the ambiguity without deciding it — the distinction is content, not structure.

**Rejected alternative:** treat every level-2 heading as an entry. Rejected as a false-positive machine on real files.

## `Verification` accepts any separator between value and explanation

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** first real-world run against this repository's `context/`, 2026-09-01
**Revisit when:** the entry format ever standardizes a separator

`**Verification:** contradicted. Retested …` is valid — the value word is what's constrained, and anything after it (period, colon, dash, plain sentence) counts as the explanation `contradicted` requires. `Type: undefined — <reason>` keeps its documented dash form, since that one *is* specified.

**Reason:** the first dogfood run failed on `compatibility.md`, which separates `contradicted` from its explanation with a period. That entry is correct per the schema's wording ("must say what contradicts it"); the linter's initial dash-only parsing was the bug. Structure checks must follow the documented format, not an implementer's assumption about punctuation.

## Configured paths are confined to the repository, and an escape is an error rather than a silent fallback

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** external review of 0.11.0, 2026-09-04; reproduced before the fix (`context: ../outside` listed and read the files there)
**Revisit when:** the linter grows a mode that deliberately reads outside the project (it has no reason to today)

`context` and `pinned-path` from `.keep-the-why` are resolved with symlinks followed and must land inside the project root; absolute paths are rejected without resolving. A symlinked file inside the context directory that resolves outside the tree is skipped. Every case is `E009`, an error — the linter does not fall back to `context/` and continue.

**Reason:** the linter is a CI tool that processes a configuration file from whatever pull request triggered it, including one from a stranger. The file has to be treated as data even in the one place where it names a filesystem location. The two paths were previously joined onto the root with `os.path.join`, which happily takes `..` and replaces the root with an absolute path outright. What leaked was small (file names, line numbers, heading text echoed in findings) — the point is the boundary, not the payload.

**Rejected alternative:** silently falling back to `context/` when the configured location escapes. That would lint the wrong directory and report green on a project whose config is broken or hostile; an error that names the field is what the skill's own "fail loud" rule asks for. Also rejected: not following symlinks at all (`os.path.abspath` instead of `realpath`) — a link inside the tree that points outside is exactly the escape that check exists for.

