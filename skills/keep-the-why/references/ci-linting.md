# CI linting, dashboard and registry setup

## Optional components

The skill is the one thing a project needs. Three components go beyond it, each optional, and each one the agent sets up the same way:

| Component | What it is | Set up by |
|---|---|---|
| The linter in CI | `keep-the-why-lint` checks the structure of `context/` and `.keep-the-why` on every push | a workflow, job or hook in the project — below |
| The dashboard on the project's site | `keep-the-why-dashboard` exported into the project's docs site or its own GitHub Pages workflow, with the live badge | "The dashboard export", below |
| A listing in the registry | one line in Keep the Why's registry, so the project can be found from the globe of every published dashboard | "The registry", below |

**Know, offer, set up on request.** The agent knows how each one is set up, from this file. It offers one where it fits — the project wizard asks about the first two with the default *no*, and the registry is offered once, after the dashboard is published — and it sets one up only when the person says yes or asks for it, at setup or at any time later ("set up the linter workflow", "publish the dashboard on GitHub Pages", "list us in the registry"). Never on its own initiative, and a "defaults" answer to the wizard is not a yes to any of them. What the agent cannot do itself — a repository setting it has no access to — it names, with the place to do it.

## The linter in CI

How the project init wizard (see `setup.md`) wires `keep-the-why-lint` into a project's CI, and optionally into pre-commit. The linter validates the *structure* of `.keep-the-why` and the context directory — required fields, valid values, index consistency, hidden-content red flags — gated by the project's `context-schema`. It never judges content; that stays a human call. Consumer-facing documentation, the version scheme, and every finding code: https://keepthewhy.com/linting/

### Detect, don't assume

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

### What gets written

- **GitHub Actions:** `.github/workflows/ktw-lint.yml`, the snippet below verbatim. The root of the `keep-the-why` repository is a composite action that installs the linter its own ref belongs to, referenced via the moving `lint-latest` tag — which follows linter publishes, not skill releases (the skill's own `latest` tag doesn't carry the action until the next skill release) — so the consumer never pins anything and gets the newest linter. A project that wants a fixed version uses the matching `lint-v<version>` tag (or its commit SHA) instead, which pins action and linter together; the `version` input is only for mixing the two (a pinned ref with a rolling linter, or the reverse).
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

```sh
pip install keep-the-why-lint
ktw-lint .            # exit 0 clean, 1 findings, 2 usage error
ktw-lint . --strict   # warnings fail too
ktw-lint . --setup    # locally only: also ~/.keep-the-why/<id>.md and ~/.keep-the-why/config
```
<!-- snippets:end -->

## The dashboard export

Offered by the project wizard when a docs build exists (a GitHub Pages workflow, `mkdocs.yml`, a `docs/` deploy job) or the remote is on GitHub, default *no*; set up when the person says yes or asks. With a docs build: one step in that build, after the site is generated and before it is uploaded — `keep-the-why-dashboard` reads the checkout and writes three static files, no server, no external request:

```yaml
      # Keep the Why: the project's own dashboard on /dashboard/live/ — index.html,
      # state.json and the live badges (badge-entries.svg, badge-entries-flat.svg),
      # exported from this checkout. Needs the full
      # history (fetch-depth: 0 on the checkout step) to date entries by commit.
      - run: |
          pip install --quiet keep-the-why-dashboard
          ktw-dashboard --export site/dashboard/live .
```

`site/` is whatever directory the build uploads (`site/` for MkDocs, `_site/` for Jekyll, `build/` for Sphinx — match the project's own). `--anonymize` replaces Git author names with `author-1`, `author-2`, … for a repository whose contributors did not ask to be listed on a web page. The live badge in the README then points at the project's own export:

```markdown
[![Keep the Why · live](https://example.org/dashboard/live/badge-entries.svg)](https://example.org/dashboard/live/)
```

with the site's URL (the docs site's address; for a Pages workflow of its own, derived as below), and `dashboard-state: https://example.org/dashboard/live/state.json` in `.keep-the-why` — the line another dashboard reads, in its *public* mode, to show this project's export in place of a checkout (the family web across repositories, `docs/dashboard.md`). `badge-entries.svg` is rendered at export time with the project's numbers (and `badge-entries-flat.svg` shows the same in the flat style badge services draw) ("42 entries · 3 open" — open, needs-review and pending-confirmation count as open), so README → the project's own SVG → the project's own dashboard, and no badge service in between. Staged, not committed, like everything else setup writes.

**No docs build, remote on GitHub:** a workflow of its own publishes the export to the repository's GitHub Pages — `.github/workflows/ktw-dashboard.yml`, after checking that no workflow already deploys Pages (one that does gets the step above instead, never a second deploy):

```yaml
name: ktw-dashboard

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # the dashboard dates entries by Git history
      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"
      - run: |
          pip install --quiet keep-the-why-dashboard
          ktw-dashboard --export site/dashboard/live .
      - uses: actions/upload-pages-artifact@v5
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v5
```

`branches:` names the repository's default branch. The site is then `https://<owner>.github.io/<repo>/`, the dashboard `<site>/dashboard/live/`. In the same change, write `dashboard-state: <site>/dashboard/live/state.json` into `.keep-the-why` and offer the live badge with the same `<site>` — both derived from the remote now. The URL answers only after the first deploy; that is expected and no reason to wait. A custom domain changes only the host: when the repository's Pages already uses one (a `CNAME`, or the person names it), use that host instead. A workflow can only deploy once the repository's Pages source is *GitHub Actions*: tell the person to set it at `https://github.com/<owner>/<repo>/settings/pages`, under "Build and deployment" → "Source" → "GitHub Actions". If Pages already serves something from a branch, switching the source replaces that site — say so and ask instead of writing the workflow. Changing the setting is the person's; the agent does it (`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`, or `-X PUT` when Pages exists) only when asked to. The first deploy runs on the push after the workflow is merged.

## The registry

[The registry](https://keepthewhy.com/registry/) lists repositories with a published dashboard export; the dashboard's globe reads it, so a listed project can be found from any published dashboard, including from projects that cite nothing of it. Nothing needs it — the dashboard works without it, and the globe finds repositories by their citations anyway.

**Offered once, never done unasked.** After the dashboard is published — `dashboard-state` is on the default branch and the export answers at that URL — the agent may offer the listing in one sentence, once. It opens the pull request only when the person asks for it; an offer left unanswered is a no, and it is not repeated.

**On request:** a pull request against `oliver-zehentleitner/keep-the-why` that adds one line to `registry/projects.txt` — the project's `canonical` from `.keep-the-why`, nothing else. The usual way is a fork, a branch, the line, and the pull request (`gh repo fork`, then `gh pr create`); the agent says which account it opens it as before it does. A family is listed by its root alone, its members come with it. The registry's workflow then reads the project's `.keep-the-why` at `HEAD`, follows `dashboard-state` to the export, and checks that the export names this repository — a project whose `dashboard-state` is not merged yet, or whose export does not answer, fails that check, so the listing waits until the export is live.

## The local run is a different setting

CI checks everyone's entries after the push, on a runner with no home files. The same linter run locally, after each write and — with `--setup` — over the developer's own two home files, is the personal `local-lint` setting: asked by the personal wizard, not the project one, because installing and running a tool is a per-developer, per-machine choice. Everything about it — when it runs, the version floor, how it gets installed, what to do with findings — is "Local linting" in `setup.md`.

## Adding it to an existing project later

Nothing about this is tied to first-time setup: a project that declined, or was set up before the linter existed, adds the same files by hand or by asking the agent to — the detection table above applies just the same. There's no config field recording whether linting is set up; the workflow file's presence *is* the state.
