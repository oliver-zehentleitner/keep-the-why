# Repository conventions

## No `pyproject.toml`

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

There is no `pyproject.toml` in this repo.

**Reason:** an earlier version had one, copied from the `a1-ai-expert-case-study` template, purely to make `pip install -e .[docs]` work as a way to install Sphinx doc dependencies. It declared an empty package (`[tool.setuptools] packages = []`) whose only purpose was enabling that pip idiom. This repo isn't a Python package — nothing here is ever `pip install`-ed by an end user — so the fake-package indirection was unnecessary. The maintainer asked directly why it was needed ("Warum brauchen wir eine pyproject.toml?"), and the honest answer was: it wasn't. Replaced with a plain `requirements-docs.txt` that both local development and CI install via `pip install -r requirements-docs.txt`.

## `.gitignore` is short

**Status:** active
**Confirmed**

`.gitignore` covers only: Python bytecode/venv artifacts, the `site/` docs build output, OS and editor noise, and `AGENTS.local.md`. `.idea/` is explicitly *not* ignored from being listed — it's kept active (uncommented) because the maintainer uses PyCharm/IntelliJ.

**Reason:** the file originally came from GitHub's auto-generated Python `.gitignore` template (226 lines), and only had entries added on top of it, never removed. It included ignores for Django, Flask, Scrapy, Celery, RabbitMQ, ActiveMQ, PyInstaller, Cython, Marimo, Streamlit, PyBuilder, Abstra, and more — none relevant to this repo. Trimmed to ~25 lines reflecting what the repo actually contains, as part of the same "no structural baggage" review that also changed the docs engine (see `docs-engine.md`).

## `docs/` is not committed

**Status:** active
**Confirmed**

`docs/` (the mkdocs source, formerly the Sphinx build output) is tracked in git as source content is expected to be — but the *built* site (`site/`) never is. The live site is built and deployed by `.github/workflows/docs.yml` on every push to `main`.

**Reason:** the first version of this pipeline (Sphinx) committed the built HTML output directly to `docs/` on `main`, following the `a1-ai-expert-case-study` pattern. Every documentation content change then produced a git diff dominated by generated HTML/CSS/JS with no reviewable signal, and publishing an update required a manual local build + commit. Moving the build into CI and deploying via GitHub Pages' Actions-artifact mechanism removes both problems — nothing generated ever enters git history.

## No `dev/` directory

**Status:** active
**Confirmed**

Related to `docs-engine.md`: docs tooling lives directly at the repo root (`mkdocs.yml`, `docs/`, `requirements-docs.txt`), not nested under a `dev/` folder.

**Reason:** `dev/sphinx/` existed in the first iteration only because it mirrored `a1-ai-expert-case-study`, a repo that has other dev-only tooling justifying that grouping. This repo doesn't — there was nothing else under `dev/` to group. Kept flat once that became clear.

## AIgent GitHub token cannot push workflow files

**Status:** active, operational constraint (not a design choice)
**Confirmed**

Pushes to this repo from the `oliver-zehentleitner-aigent` account fail if the commit touches `.github/workflows/*.yml` — GitHub rejects this unless the token has the `workflow` OAuth scope, which this token doesn't have (independent of the `repo` scope it does have). This is a GitHub platform restriction, not specific to this repo.

**Workaround used:** the workflow file's content is prepared and shared with the maintainer directly (or left as an untracked local file); the maintainer adds it manually via the GitHub UI or their own credentials. All other changes in the same commit are pushed normally by dropping just the workflow file from the commit (`git rm --cached` + `commit --amend` before pushing).
