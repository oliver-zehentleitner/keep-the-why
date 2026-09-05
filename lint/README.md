[![PyPI](https://img.shields.io/pypi/v/keep-the-why-lint.svg?label=pypi)](https://pypi.org/project/keep-the-why-lint/)
[![Python](https://img.shields.io/pypi/pyversions/keep-the-why-lint.svg)](https://pypi.org/project/keep-the-why-lint/)
[![Downloads](https://pepy.tech/badge/keep-the-why-lint)](https://pepy.tech/project/keep-the-why-lint)
[![License](https://img.shields.io/github/license/oliver-zehentleitner/keep-the-why.svg?color=blue)](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/LICENSE)
[![keep-the-why-lint (package)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/lint-package.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/lint-package.yml)
[![ktw-lint](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/ktw-lint.yml)
[![Black](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-keep--the--why--lint-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/keep-the-why-lint)
[![Read the Docs](https://img.shields.io/badge/read-%20docs-yellow)](https://keepthewhy.com/linting/)
[![Telegram](https://img.shields.io/badge/community-telegram-41ab8c)](https://t.me/unicorndevs)
[![X](https://img.shields.io/badge/x-%40keep__the__why-000000?logo=x)](https://x.com/keep_the_why)
[![Bluesky](https://img.shields.io/badge/bluesky-%40keep--the--why-0285FF?logo=bluesky&logoColor=white)](https://bsky.app/profile/keep-the-why.bsky.social)
[![Mastodon](https://img.shields.io/badge/mastodon-%40keep__the__why-6364FF?logo=mastodon&logoColor=white)](https://mastodon.social/@keep_the_why)
[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)

<a href="https://keepthewhy.com"><img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why — because &quot;ask Bob&quot; is not documentation."></a>

# keep-the-why-lint

Keep the Why preserves the reasoning behind your code. keep-the-why-lint checks that it's recorded in a form the next reader can rely on.

**keep-the-why-lint** is the structural CI linter for [Keep the Why](https://keepthewhy.com) projects — the tests for your `context/`. Keep the Why is a repo-native convention and agent skill for preserving the reasoning behind a codebase: decisions, rejected alternatives, workarounds, incidents, constraints — the *why* that code alone can't explain, stored as versioned Markdown in `context/`. Nothing in that format is enforced the way a compiler enforces correctness. Part of the gap *is* mechanically closable, though, and that part is this tool's job: required fields, valid values, index consistency, `.keep-the-why` integrity, hidden-content red flags.

**Schema-version-aware:** it reads the target project's `context-schema` and only enforces what that skill version defines — the same "next time touched" philosophy as the skill's own [migrations](https://keepthewhy.com/migrations/). An unmigrated project never fails on structure its version didn't have.

**Runs on:** Python 3.10–3.14, no dependencies beyond the standard library — anywhere `pip` works: GitHub Actions, GitLab CI, pre-commit, or the shell.

Website: [https://keepthewhy.com](https://keepthewhy.com/) · [llms.txt](https://keepthewhy.com/llms.txt) for AI agents/assistants looking up this project

Documentation: [Linting](https://keepthewhy.com/linting/) · [CI linting setup](https://keepthewhy.com/ci-linting/) · [Finding codes](https://keepthewhy.com/linting/#finding-codes) · [Migrations](https://keepthewhy.com/migrations/) · [Trust model](https://keepthewhy.com/trust-model/)

## How it works

`ktw-lint` reads `.keep-the-why`, finds the configured context directory, and validates the machine-checkable half of the schema:

- **Entries** — every entry carries `Status` and `Evidence`, values come from the documented sets, `Type` is valid, `Verification: contradicted` says what contradicts it
- **`index.md`** — exists, every link resolves, every topic file is listed, sorted alphabetically
- **`.keep-the-why`** — required fields present, no field recorded twice, no unknown fields, pinned versions consistent, the configured `context/` location exists
- **Hidden content** — invisible or directional Unicode is an error, base64-looking blobs a warning: the one mechanically checkable slice of the [trust model](https://keepthewhy.com/trust-model/)

Every check is gated by the project's `context-schema`, so a check only fires for a skill version that actually defined it. Fenced code blocks are skipped — example entries in documentation never get linted as real ones.

Exit code `0` clean, `1` findings, `2` usage error. Inside GitHub Actions (`GITHUB_ACTIONS` set, or `--github`) findings are emitted as `::error`/`::warning` annotations, so they show up inline on the PR.

## Install

```bash
pip install keep-the-why-lint

ktw-lint .                 # lint the project in the current directory
ktw-lint /path/to/project  # or any other project root
ktw-lint . --strict        # warnings fail too
```

### CI setup

The Keep the Why [project init wizard](https://keepthewhy.com/setup/) offers to wire the linter into your CI during setup — detected from the repository, never guessed — and [CI linting setup](https://keepthewhy.com/ci-linting/) has the full detection rules. By hand, these are the same snippets:

**GitHub Actions** — `.github/workflows/ktw-lint.yml`. The root of the `keep-the-why` repository is a composite action ([on the GitHub Marketplace](https://github.com/marketplace/actions/keep-the-why-lint)) that installs the latest linter from PyPI; the `lint-latest` tag moves with every linter publish, so there's nothing to pin on your side (pin `@lint-v<version>` if you want a fixed action revision):

```yaml
name: ktw-lint

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ktw-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oliver-zehentleitner/keep-the-why@lint-latest   # rolling; @lint-v<version> pins action and linter together
        with:
          path: "."
          strict: "false"    # "true" turns warnings (e.g. missing Type on old entries) into failures
          # version: "latest"     # only to mix: a pinned ref with a rolling linter, or vice versa — https://keepthewhy.com/linting/#versions-and-pinning
```

**GitLab CI** — job for `.gitlab-ci.yml`:

```yaml
ktw-lint:
  image: python:3.12
  script:
    - pip install keep-the-why-lint
    - ktw-lint .
```

**pre-commit** — hook for `.pre-commit-config.yaml` (the skill repository root isn't a Python package, so the hook pulls the linter from PyPI):

```yaml
repos:
  - repo: local
    hooks:
      - id: ktw-lint
        name: keep-the-why-lint
        entry: ktw-lint .
        language: python
        additional_dependencies: ["keep-the-why-lint"]
        pass_filenames: false
```

`strict: "false"` / no `--strict` is the sensible default: warnings (a missing `Type` on an old entry, a missing guard file) are "next time touched" material per the skill's own rules and shouldn't block a fresh project's CI.

## Example

A run against a project with a few problems:

```text
context/auth.md:3: [E102] 'Token refresh window': entry has no **Evidence:** field
context/index.md: [E203] topic file 'auth.md' is not listed in index.md
context/sync.md:11: [W101] 'Retry budget': no **Type:** field — fill it in the next time the entry is touched
context/sync.md:13: [E103] Status 'actve' is not one of: active, superseded, open, needs-review
ktw-lint 0.10.1.2: 3 error(s), 1 warning(s) (context-schema 0.10.1, context: context/)
```

Every finding code, with its meaning and severity: [Finding codes](https://keepthewhy.com/linting/#finding-codes).

## Version scheme

Versioned as `<schema>.<revision>` — e.g. `0.10.1.0`. The first three segments are the newest skill schema this release knows every structural gate of; the fourth is the linter's own revision, bumped for linter-only changes (`0.10.1.1`). A skill release without structural changes doesn't need a linter release: the gating handles newer `context-schema` values, and `W003` warns when a project's schema is newer than the newest one the linter knows, so you can check [migrations](https://keepthewhy.com/migrations/) for whether an update matters.

PEP 440, not strict SemVer — PyPI rejects the build-metadata spelling SemVer would use for this. Releases are tagged `lint-v<version>` in the repository, and the moving `lint-latest` tag — the ref the GitHub Action snippet uses — follows the newest one; both are created by the publish workflow only after a successful upload, never by hand.

## What this is not

- Not a content checker. Whether the recorded rationale is *true, complete, or honest* is not mechanically checkable, and this tool doesn't pretend otherwise — `Evidence: confirmed` stays a human judgment; the linter only guarantees the field is there and holds a legal value.
- Not a secret scanner. The hidden-content check catches what needs decoding to be read; pair it with a real scanner (e.g. gitleaks) if you need that.
- Not a substitute for the skill. It validates what Keep the Why writes; it doesn't write anything itself — see [Installation](https://keepthewhy.com/installation/) for the skill.

## Feedback

Something not working as described, a finding that's wrong, or a structural rule the linter should know about? [Open an issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new/choose) — that's exactly what it's for.

## Contributing

Developed in the [keep-the-why](https://github.com/oliver-zehentleitner/keep-the-why) monorepo under [`lint/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/lint), released independently of the skill. See [CONTRIBUTING.md](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/CONTRIBUTING.md), the [Changelog](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/CHANGELOG.md), and the [Security policy](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/SECURITY.md).

## Contributors
[![Contributors](https://contributors-img.web.app/image?repo=oliver-zehentleitner/keep-the-why)](https://github.com/oliver-zehentleitner/keep-the-why/graphs/contributors)

We ♥️ open source!

## License

[MIT](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/LICENSE)
