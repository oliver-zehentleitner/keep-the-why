# CI linting setup

How the project init wizard (see `setup.md`) wires `keep-the-why-lint` into a project's CI, and optionally into pre-commit. The linter validates the *structure* of `.keep-the-why` and the context directory — required fields, valid values, index consistency, hidden-content red flags — gated by the project's `context-schema`. It never judges content; that stays a human call. Consumer-facing documentation, the version scheme, and every finding code: https://keepthewhy.com/linting/

## Detect, don't assume

Decide what to offer from what the repository actually shows — the same rule as `autostart.md`: don't invent or fake a mechanism for a platform the evidence doesn't support.

| Evidence | Offer |
|---|---|
| `.github/` directory exists, or the `origin` remote host is `github.com` | GitHub Actions workflow |
| `.gitlab-ci.yml` exists, or the `origin` remote host contains `gitlab` | GitLab CI job |
| Another CI's config is recognizable (Jenkinsfile, `.circleci/`, `azure-pipelines.yml`, `.woodpecker.yml`, ...) | The generic `pip` snippet, shown — not written: don't author config for a CI whose format can't be verified here |
| No CI evidence at all | Nothing to write; mention the generic snippet once in case CI comes later |
| `.pre-commit-config.yaml` exists | Also offer the pre-commit hook |
| No `.pre-commit-config.yaml` | Don't offer pre-commit — introducing a new tool into a project that doesn't use it isn't setup, it's a separate decision |

Before writing anything, check that nothing equivalent already exists (a workflow or job that already runs `ktw-lint`, or references `keep-the-why`) — if it does, say so and skip; don't add a second copy.

## What gets written

- **GitHub Actions:** `.github/workflows/ktw-lint.yml`, the snippet below verbatim. The root of the `keep-the-why` repository is a composite action that installs the latest linter from PyPI, referenced via the moving `lint-latest` tag — which follows linter publishes, not skill releases (the skill's own `latest` tag doesn't carry the action until the next skill release) — so the consumer never pins anything. A project that wants a fixed action revision uses the matching `lint-v<version>` tag (or its commit SHA) instead — that pins the wrapper only; the linter it installs is pinned separately via the `version` input, since the wrapper installs from PyPI at job time.
- **GitLab CI:** the `ktw-lint` job below, appended to `.gitlab-ci.yml`. If the file defines `stages:`, give the job a `stage:` from that list (`test` if present, otherwise ask which) — a job without a stage falls back to `test`, which fails the pipeline when custom stages don't include it. If there's no `.gitlab-ci.yml` at all but the remote is GitLab, creating one with only this job makes it the project's first pipeline — say that plainly before doing it.
- **pre-commit:** the hook below, added under an existing `repo: local` entry if there is one, otherwise as a new one. The keep-the-why repository root is not a Python package, so the hook pulls the linter from PyPI via `additional_dependencies` rather than pointing `repo:` at the skill repository.
- `strict: "false"` / no `--strict` by default: warnings (a missing `Type` on an old entry, a missing guard file) are "next time touched" material per the skill's own rules and shouldn't block a fresh project's CI. Mention that `--strict` exists.

None of this is committed by the wizard — same as every other file setup writes (rule 7): staged in the working tree, committed when the user says so.

<!-- snippets:start -->
**GitHub Actions** — `.github/workflows/ktw-lint.yml`:

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
      - uses: oliver-zehentleitner/keep-the-why@lint-latest   # or @lint-v<version> to pin the action
        with:
          path: "."
          strict: "false"    # "true" turns warnings (e.g. missing Type on old entries) into failures
          # version: "0.10.1.0"   # optional: pin the linter itself; @lint-v<version> above pins only the wrapper
```

**GitLab CI** — job for `.gitlab-ci.yml`:

```yaml
ktw-lint:
  image: python:3.12
  script:
    - pip install keep-the-why-lint
    - ktw-lint .
```

**pre-commit** — hook for `.pre-commit-config.yaml`:

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

**Any other CI, or locally:**

```bash
pip install keep-the-why-lint
ktw-lint .            # exit 0 clean, 1 findings, 2 usage error
ktw-lint . --strict   # warnings fail too
```
<!-- snippets:end -->

## Adding it to an existing project later

Nothing about this is tied to first-time setup: a project that declined, or was set up before the linter existed, adds the same files by hand or by asking the agent to — the detection table above applies just the same. There's no config field recording whether linting is set up; the workflow file's presence *is* the state.
