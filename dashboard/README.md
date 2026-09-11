[![PyPI](https://img.shields.io/pypi/v/keep-the-why-dashboard.svg?label=pypi)](https://pypi.org/project/keep-the-why-dashboard/)
[![Python](https://img.shields.io/pypi/pyversions/keep-the-why-dashboard.svg)](https://pypi.org/project/keep-the-why-dashboard/)
[![Downloads](https://pepy.tech/badge/keep-the-why-dashboard)](https://pepy.tech/project/keep-the-why-dashboard)
[![License](https://img.shields.io/github/license/oliver-zehentleitner/keep-the-why.svg?color=blue)](https://keepthewhy.com/license/)
[![keep-the-why-dashboard (package)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/dashboard-package.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/dashboard-package.yml)
[![Black](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml)
[![Read the Docs](https://img.shields.io/badge/read-%20docs-yellow)](https://keepthewhy.com/dashboard/)
[![Telegram](https://img.shields.io/badge/community-telegram-41ab8c)](https://t.me/unicorndevs)
[![X](https://img.shields.io/badge/x-%40keep__the__why-000000?logo=x)](https://x.com/keep_the_why)
[![Bluesky](https://img.shields.io/badge/bluesky-%40keep--the--why-0285FF?logo=bluesky&logoColor=white)](https://bsky.app/profile/keep-the-why.bsky.social)
[![Mastodon](https://img.shields.io/badge/mastodon-%40keep__the__why-6364FF?logo=mastodon&logoColor=white)](https://mastodon.social/@keep_the_why)
[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)

<a href="https://keepthewhy.com"><img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why — because &quot;ask Bob&quot; is not documentation."></a>

# keep-the-why-dashboard

Keep the Why preserves the reasoning behind your code. keep-the-why-dashboard shows it — who recorded what, when, and what still needs a person.

**keep-the-why-dashboard** is the read-only viewer for [Keep the Why](https://keepthewhy.com) projects — Obsidian's graph and reader, for the *why* behind a codebase. Keep the Why is a repo-native convention and agent skill for preserving that reasoning: decisions, rejected alternatives, workarounds, incidents, constraints, stored as versioned Markdown in `context/`. Everything the dashboard shows is already in the repository — the entries, the config in `.keep-the-why`, the linter's findings, and the Git history of all of it. It connects them into one page: a graph of topics and references, an entry reader with backlinks, queues of what needs a person, a timeline, and per-author attribution from `git blame` and `git log`.

**A viewer, not a store.** It writes nothing into any project, runs no daemon beyond the terminal you start it in, and is never a source of truth: delete it and nothing is lost. That is what keeps it inside Keep the Why's own rule — *no new platform, database, daemon, account, or workflow* — a lens on Markdown and Git, not a place where anything lives; see [Philosophy](https://keepthewhy.com/philosophy/). The one file it keeps is `~/.keep-the-why/dashboard-history.json`: the projects you opened, with their paths, so the project menu can offer them again.

**Runs on:** Python 3.10–3.14, the standard library plus [`keep-the-why-lint`](https://pypi.org/project/keep-the-why-lint/) as the parser. The page is one plain JavaScript module — no framework, no build step, no CDN — so the exported file works offline. The server's only network call is an update check against pypi.org for the two packages, at start and once a day (`--no-update-check` turns it off); the exported page makes none.

Website: [https://keepthewhy.com](https://keepthewhy.com/) · [llms.txt](https://keepthewhy.com/llms.txt) for AI agents/assistants looking up this project

Documentation: [Dashboard](https://keepthewhy.com/dashboard/) · [Live example](https://keepthewhy.com/dashboard/live/) (this repository's own `context/`) · [Linting](https://keepthewhy.com/linting/) · [Specification](https://keepthewhy.com/specification/) · [Trust model](https://keepthewhy.com/trust-model/)

## How it works

`ktw-dashboard` reads `.keep-the-why`, parses the configured context directory with the linter's own parser, adds what the linter does not keep, and serves one page:

- **Entries** — title, `Type`, `Status`, `Evidence`, `Source`, `Verification`, `Revisit when`, and the body with `Reason` / `Rejected alternative` / `Consequence` as callouts; references between topics become links and graph edges
- **Git** — per entry: who created it and when (`git log -S` on the heading), who last touched it (`git blame`), and the sequence of `Status` values with author and date (`git log -L` on the Status line). Uncommitted entries show as author `working tree`
- **Linter** — the findings `ktw-lint` would report, per entry and as a list; the same rules, run in-process
- **Live** — the server checks the project's fingerprint (HEAD, `.git/index`, the files under `context/`) every two seconds and pushes a fresh state to every open page over Server-Sent Events. A `git pull` or an entry an agent wrote a moment ago shows up within seconds
- **Export** — `--export DIR` writes one self-contained `index.html` with the state embedded, plus `state.json`; no server, no external requests. For GitHub Pages, a release asset, or the link behind the [badge](https://keepthewhy.com/badge/)

Git is optional: without a repository every Git-derived field is empty and the Timeline and Authors views say so. E-mail addresses are never part of the state; `--anonymize` replaces author names with `author-1`, `author-2`, … for exports of repositories whose contributors did not ask to be listed on a web page.

Exit code `0` ok, `1` the directory is not a Keep the Why project (and no other project is known), `2` usage error.

## Install

```bash
pip install keep-the-why-dashboard

ktw-dashboard                        # in a project with a .keep-the-why file; opens http://127.0.0.1:8765/
ktw-dashboard /path/to/project       # or any other project root
ktw-dashboard --export site/         # one static page + state.json, then exit
ktw-dashboard --json                 # the state as JSON, for scripts
ktw-dashboard --host 0.0.0.0         # expose on the network (the CLI warns; the page shows the project's context/)
```

```
ktw-dashboard [PATH] [--host 127.0.0.1] [--port 8765] [--no-browser] [--interval 2]
              [--scan DIR] [--no-history] [--no-update-check] [--export DIR] [--anonymize] [--json] [--version]
```

### Several projects

Started inside a project, the dashboard shows that one. The project menu in the top bar lists the ten most recently opened projects (from the history file — one project id can appear at several paths, clones and worktrees included), projects found two levels under the parent directory or under `--scan DIR`, and ids that have a personal file in `~/.keep-the-why/` but no known location yet. Opening a project moves it to the top. `--no-history` leaves the file alone.

## What it shows

| View | Content |
|---|---|
| **Strip** (every view) | entries, topics, authors · what needs a person: open, needs review, pending confirmation, unknown evidence, revisit-when triggers · linter errors and warnings — each a link |
| **Overview** | Type / Status / Evidence distributions, config, topic cards, recently touched entries |
| **Graph** | topics as hubs, entries around them colored by Evidence (ring = open / needs-review / pending-confirmation, hollow = superseded), references between topics as edges; drag, zoom, hover to focus, click to open |
| **Topics** and the **reader** | one topic file, its entries; an entry rendered with its fields and callouts, references as links, previous / next |
| **Side pane** | the project graph by default; for a topic or an entry its neighbourhood graph, plus fields, created by / last touched / status history from Git, backlinks, linter findings |
| **Queues** | `open`, `needs-review`, `pending-confirmation`, `Evidence: unknown` on active entries, and the `Revisit when` triggers on record — the page lists, it does not decide |
| **Timeline** | entries by the month their heading first appeared in Git, stacked by author; superseded events marked |
| **Authors** | per Git author: created, touched, superseded, first / last activity, Evidence mix of what they created; click to filter every view |
| **Findings** | the linter's findings with links to the entries they sit in |
| **Status bar** | the two package versions, linking PyPI; when a newer release exists the entry shimmers and its tooltip names the version and the `pip install -U` line |

Search (`/`) over titles and bodies; filters by status, evidence and author apply everywhere. Keys: `g` graph, `o` overview, `q` queues, `t` timeline, `a` authors, `l` findings.

## Example

```text
$ ktw-dashboard
ktw-dashboard 0.1.0 — 11 project(s), selected: /home/me/projects/keep-the-why
  http://127.0.0.1:8765/
  (localhost only — use --host 0.0.0.0 to expose)
  read-only; Ctrl+C to stop
```

What that page looks like for this repository's own `context/`: [keepthewhy.com/dashboard/live/](https://keepthewhy.com/dashboard/live/), exported on every docs build.

## What Git can and cannot tell

`git blame` on an entry's heading says who committed it and when; `git log -L` on its `Status` line gives the sequence of values with author and date; `git log -S` on the heading finds the commit that introduced it. That is the author layer — and it is Git's notion of author: the committer of record. When a coding agent writes an entry inside a developer's session, Git shows the developer. The dashboard reports what Git says and adds no convention of its own.

## Version scheme

Versioned on its own counter — `0.1.0`, `0.1.1`, … — independently of the skill and of the linter: the dashboard reads whatever `context-schema` the installed linter understands, so a skill release does not force a dashboard release. It depends on `keep-the-why-lint` at or above the version it was tested with. Releases are tagged `dashboard-v<version>` in the repository, created by the publish workflow only after a successful PyPI upload, never by hand.

## What this is not

- Not a place to write. Entries are written by the [skill](https://keepthewhy.com/installation/) in an agent session, or by hand; the dashboard has no edit, approve or confirm button, on purpose — a second write path would make it a store.
- Not a judge. Whether a `Revisit when` trigger has fired, whether `Evidence: confirmed` is deserved, whether an open question can be closed — the queues list, a person decides.
- Not a hosted service. It runs where the repository is: your machine, a CI job that exports it, a static page you publish yourself.
- Not an agent-versus-human tracker. Authors are Git authors; see above.

## Feedback

Something not working as described, a view that misreads your `context/`, or Git attribution that looks wrong? [Open an issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new/choose) — that's exactly what it's for.

## Contributing

Developed in the [keep-the-why](https://github.com/oliver-zehentleitner/keep-the-why) monorepo under [`dashboard/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/dashboard), released independently of the skill. See [CONTRIBUTING.md](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/CONTRIBUTING.md), the [Changelog](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/CHANGELOG.md), and the [Security policy](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/SECURITY.md).

## Contributors
[![Contributors](https://contributors-img.web.app/image?repo=oliver-zehentleitner/keep-the-why)](https://github.com/oliver-zehentleitner/keep-the-why/graphs/contributors)

We ♥️ open source!

## License

[MIT](https://keepthewhy.com/license/)
