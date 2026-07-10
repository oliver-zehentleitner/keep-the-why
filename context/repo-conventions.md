# Repository conventions

## No `pyproject.toml`

**Status:** active
**Confirmed**

There is no `pyproject.toml` in this repo.

**Reason:** this repo isn't a Python package — nothing here is ever `pip install`-ed by an end user, so there's no package to declare. Docs dependencies (mkdocs and its plugins) are installed via a plain `requirements-docs.txt`, used identically by local development and CI (`pip install -r requirements-docs.txt`). A `pyproject.toml` declaring an empty package purely to enable a `pip install -e .[docs]` idiom was considered and rejected — it would add a file whose only purpose is making a pip convention work for a package that doesn't exist.

## `.gitignore` is short

**Status:** active
**Confirmed**

`.gitignore` covers only: Python bytecode/venv artifacts, the `site/` docs build output, OS and editor noise, and `AGENTS.local.md`. `.idea/` is explicitly kept active (not ignored from being listed) for PyCharm/IntelliJ users.

**Reason:** kept to what this repo actually contains, rather than starting from a generic language template and only ever adding to it. A generic Python `.gitignore` template carries entries for frameworks and tools (web frameworks, task queues, notebook tooling, and more) that have nothing to do with a Markdown-based skill repo — irrelevant entries accumulate silently if nobody ever reviews whether they still apply.

## `docs/` is not committed as built output

**Status:** active
**Confirmed**

`docs/` (the mkdocs *source*) is tracked in git, as source content should be — but the *built* site (`site/`) never is. The live site is built and deployed by `.github/workflows/docs.yml` on every push to `main`, via GitHub Pages' Actions-artifact deployment mechanism.

**Reason:** committing built HTML output directly to a branch means every documentation content change produces a git diff dominated by generated HTML/CSS/JS with no reviewable signal, and publishing an update requires a manual local build-and-commit step every time. Building in CI and deploying straight to Pages removes both problems — nothing generated ever enters git history, and a push to `main` is the only step needed to publish.

## No `dev/` directory

**Status:** active
**Confirmed**

Docs tooling lives directly at the repo root (`mkdocs.yml`, `docs/`, `requirements-docs.txt`), not nested under a `dev/` folder.

**Reason:** a `dev/`-style grouping only earns its place when there's more than one thing under it needing separation from the rest of the repo. This repo doesn't have that — docs tooling is the only "build-time" concern it has, so it stays flat at the root rather than adding a directory layer that groups nothing.

## AIgent GitHub token cannot push workflow files

**Status:** active, operational constraint (not a design choice)
**Confirmed**

Pushes to this repo from the `oliver-zehentleitner-aigent` account fail if the commit touches `.github/workflows/*.yml` — GitHub rejects this unless the token has the `workflow` OAuth scope, which this token doesn't have (independent of the `repo` scope it does have). This is a GitHub platform restriction, not specific to this repo.

**Workaround used:** the workflow file's content is prepared and shared with the maintainer directly (or left as an untracked local file); the maintainer adds it manually via the GitHub UI or their own credentials. All other changes in the same commit are pushed normally by dropping just the workflow file from the commit (`git rm --cached` + `commit --amend` before pushing).
