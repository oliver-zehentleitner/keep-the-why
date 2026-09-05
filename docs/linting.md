# Linting (CI checks)

Nothing in Keep the Why is enforced the way a compiler enforces correctness — that's stated plainly in "What this skill is not." Part of that gap *is* mechanically closable, though: whether every entry carries its required fields, whether the values are from the documented sets, whether `index.md` is complete and sorted, whether `.keep-the-why` is internally consistent. That part has a linter:

**keep-the-why-lint** — [on PyPI](https://pypi.org/project/keep-the-why-lint/) as a package, [on the GitHub Marketplace](https://github.com/marketplace/actions/keep-the-why-lint) as an action, developed in this repository under [`lint/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/lint). Python 3.10+, no dependencies beyond the standard library.

What it deliberately does *not* check: content. Whether recorded rationale is true, complete, or honest isn't mechanically checkable, and the linter doesn't pretend otherwise — Evidence classification stays a judgment call; the linter only guarantees the field is there and holds a legal value.

## Schema-version-aware

The linter reads your project's `context-schema` from `.keep-the-why` (or the legacy `AGENTS.md` block, for projects not yet migrated) and enforces only what that skill version defines — the same "next time touched" philosophy as [migrations](migrations.md). An unmigrated project doesn't fail on structure its schema version never had. Only the location named by your config's `context:` field gets linted, plus the config file itself.

| Enforced from `context-schema` | What |
|---|---|
| 0.3.0 | `Status`/`Evidence` mandatory per entry, `Verification` values |
| 0.7.0 | `Type` field (missing → warning, per the skill's "next time touched" rule) |
| 0.8.0 | `undefined — <reason>` Type value, exclusive |
| 0.9.0 | Multiple `Type` lines per entry |
| 0.10.0 | Dedicated `.keep-the-why` (`id` required), sorted `index.md`, guard files |

## Version scheme

The linter is versioned as `<schema>.<revision>` — e.g. `0.10.1.0`. The first three segments are the newest skill schema this release knows every structural gate of; the fourth is the linter's own revision, bumped for linter-only changes (`0.10.1.1`). A skill release without structural changes doesn't require a linter release — the gating handles newer `context-schema` values, and the linter warns (`W003`) when a project's schema is newer than the newest one it knows, so you can check `migrations.md` for whether an update matters.

PEP 440, not strict SemVer — PyPI rejects the build-metadata spelling SemVer would use for this. The skill itself keeps SemVer tags (`v0.10.1`); the linter's PyPI releases are tagged `lint-v<version>` in this repository, and the moving `lint-latest` tag follows the newest one — both created by the publish workflow itself, never by hand. The GitHub Action deliberately rides `lint-latest`, not the skill's `latest`: that tag only advances with a skill release, which doesn't carry `action.yml` changes until the next one.

## Setup snippets

The project init wizard offers to write these for you (GitHub Actions or GitLab CI, detected from the repository; the pre-commit hook only if the project already uses pre-commit) — see [CI linting setup](ci-linting.md). By hand, they're the same files:

{% include-markdown "../skills/keep-the-why/references/ci-linting.md" start="<!-- snippets:start -->" end="<!-- snippets:end -->" %}

Inside GitHub Actions, findings show up as file/line annotations on the PR. The action always installs the latest linter from PyPI, and the `lint-latest` tag it's referenced by moves with every linter publish — nothing to pin on your side unless you want to (`@lint-v<version>` pins the action, the `version:` input pins the package).

## Hardening for shared repositories

The linter checks structure. In a repository with many contributors, a few conventional GitHub settings turn it from a hint into a gate, and cover what it deliberately doesn't check:

- **Require the check.** Branch protection (or a ruleset) on the default branch with the `ktw-lint` job as a required status check, and `strict: "true"` once the existing `context/` is clean — warnings are "fix next time you touch it" material for a solo project, and a merge blocker for a team.
- **Own the rationale.** A `CODEOWNERS` line for the context directory and the config file, so a change to a confirmed decision is reviewed by someone who can confirm it:

  ```
  /context/        @your-org/architecture
  /.keep-the-why   @your-org/architecture
  ```

  The linter accepts any well-formed `Evidence: confirmed`; whether the claim is true is exactly the review this line routes.
- **Pin by ref, update by PR.** `@lint-v<version>` or `@<commit-sha>` on the `uses:` line pins action and linter together (see [Versions and pinning](#versions-and-pinning)); Dependabot's `github-actions` ecosystem then proposes the bump as a pull request, which is where a new linter release should meet a shared repository. Rolling `@lint-latest` is right for a project that wants every new gate the day it ships and has nobody to review workflow bumps.
- **Pair with a secret scanner.** Hidden-content checks catch encoded blobs and invisible characters, not credentials in plain sight — gitleaks or GitHub's own secret scanning belongs next to it, since `context/` is prose that people paste into.
- **Keep the runtime footprint the reason it is small.** The linter is stdlib-only and installs from PyPI; nothing else runs in the job. If a policy requires hashes, `pip install keep-the-why-lint==<version>` with `--require-hashes` and a constraints file works like for any package.

None of this is specific to Keep the Why; it is the same set of settings any team applies to a directory whose content is a decision record.

## What it checks

**`.keep-the-why` / legacy config block** — block present and parseable; required fields (`context`, `init`, `context-schema`, `capture-confirmation`, `source-reference`, plus `id` for dedicated files since 0.10.0); values from the documented sets; `filtered` source-reference carries its criteria; no field recorded twice (conflicting duplicates are exactly the state the skill refuses to guess about); no unknown fields; `context-schema` is plain semver; `pinned-version`/`pinned-path` only as a pair, with the path existing; the configured context location exists; `personal-defaults` blocks carry no `last:` timestamps. Both configured paths are confined to the repository: an absolute path, a `..` escape, or a symlink that leaves the tree is an error and is not read — a CI job runs this on pull requests from strangers, and the config file is data, not a place to point the linter at the runner's filesystem.

**Entries** (level-2 headings in topic files; fenced code blocks are skipped, so example entries in documentation never get linted as real ones) — `Status` and `Evidence` present, single, and valid; `Type` values valid, `undefined` carries a reason and combines with nothing; no duplicate `Type` values; `Verification` starts with a valid value, and `contradicted` must say what contradicts it; a heading with no schema fields at all is a warning, not an error — it may be a legitimate prose section.

**`index.md`** — exists; every link resolves; every topic file is listed; sorted alphabetically by filename (an error since 0.10.0 — the convention's merge-conflict benefit only exists when the whole list is sorted).

**Guard files** — `README.md`, `AGENTS.md`, `CLAUDE.md` inside the context directory (warnings; an equivalent doing the same job is fine).

**Hidden content** — invisible/directional Unicode (zero-width characters, bidi overrides) is an error; base64-looking blobs are a warning. This is the one mechanically checkable slice of the [trust model](trust-model.md): if it needs decoding to be read, it doesn't belong in an entry meant to be read. This is *not* a secret scanner — pair it with one (e.g. gitleaks) if you need that.

### Finding codes

| Code | Severity | Meaning |
|---|---|---|
| E001 | error | no config block found |
| E002 | error | required config field missing |
| E003 | error | invalid config value |
| E004 | error | config field recorded more than once |
| E005 | error | unknown config field |
| E006 | error | `pinned-version`/`pinned-path` pair violation, or pinned path missing |
| E007 | error | configured context location doesn't exist |
| E008 | error | `last:` timestamp inside `personal-defaults` |
| E009 | error | configured `context` / `pinned-path`, or a symlink inside the context directory, points outside the repository |
| E101/E102 | error | entry missing `Status` / `Evidence` |
| E103/E104 | error | invalid `Status` / `Evidence` value |
| E105 | error | invalid `Type` value |
| E106 | error | invalid `Verification` value |
| E107 | error | `Type: undefined` without a reason |
| E108 | error | `undefined` combined with another `Type` value |
| E109 | error | duplicate `Type` value |
| E110 | error | multiple `Type` lines below schema 0.9.0 |
| E111 | error | `Verification: contradicted` without explanation |
| E112 | error | more than one `Status`/`Evidence` line |
| E201–E204 | error | `index.md` missing / broken link / unlisted topic file / not sorted |
| E301 | error | invisible or directional Unicode character |
| W001 | warning | `context-schema` missing (assumed 0.2.0) |
| W002 | warning | unrecognized check-interval shape in `personal-defaults` |
| W003 | warning | project `context-schema` newer than the newest schema this linter knows |
| W101 | warning | entry has no `Type` field |
| W102 | warning | level-2 heading without any schema fields |
| W103 | warning | `Type` placed after `Status` |
| W104 | warning | `Type` present but schema predates 0.7.0 |
| W105 | warning | empty `Revisit when` condition |
| W201 | warning | guard file missing |
| W301 | warning | base64-looking blob |

This repository runs the linter on its own `context/` in CI, from source and in `--strict` mode.
