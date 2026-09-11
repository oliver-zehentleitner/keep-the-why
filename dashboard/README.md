# keep-the-why-dashboard

[![PyPI](https://img.shields.io/pypi/v/keep-the-why-dashboard.svg?label=pypi%20keep-the-why-dashboard)](https://pypi.org/project/keep-the-why-dashboard/)
[![License](https://img.shields.io/github/license/oliver-zehentleitner/keep-the-why.svg?color=blue)](https://keepthewhy.com/license/)

A read-only viewer over what a [Keep the Why](https://keepthewhy.com) project already has: the entries in `context/`, the config in `.keep-the-why`, the linter's findings, and the Git history of all of it — who created each entry, who last touched it, when its `Status` changed and by whom.

It connects data that is already lying around. It writes nothing into any project, runs no daemon beyond the terminal you start it in, and is never a source of truth: delete it and nothing is lost. The one file it keeps is `~/.keep-the-why/dashboard-history.json` — the projects you opened, with their paths, so the project menu can offer them again. That is what keeps it inside Keep the Why's own rule — *no new platform, database, daemon, account, or workflow* — a lens on Markdown and Git, not a place where anything lives; see [Philosophy](https://keepthewhy.com/philosophy/).

Think Obsidian's graph and reader, for the reasoning behind a codebase.

## Install and run

```bash
pip install keep-the-why-dashboard
ktw-dashboard            # in a project with a .keep-the-why file
```

Opens `http://127.0.0.1:8765/` in the browser and keeps it current: the server checks the project's fingerprint (HEAD, `.git/index`, the files under `context/`) every two seconds and pushes a fresh state to every open page over Server-Sent Events when something changed — a `git pull`, or an agent that just wrote an entry (uncommitted entries show as author `working tree`).

```
ktw-dashboard [PATH] [--host 127.0.0.1] [--port 8765] [--no-browser] [--interval 2]
              [--export DIR] [--anonymize] [--json] [--version]
```

- `--export DIR` writes `DIR/index.html` — one self-contained page with the state embedded, no server, no external requests — plus `DIR/state.json`, then exits. Publish it on GitHub Pages, attach it to a release, link it from the README badge.
- `--json` prints the state and exits, for scripts.
- `--anonymize` replaces Git author names with `author-1`, `author-2`, … — for exports of repositories whose contributors did not ask to be listed on a web page. E-mail addresses are never part of the state, anonymized or not.
- `--host 0.0.0.0` exposes the page to the network; the CLI says so when you do. Everything the page shows is the project's `context/`, so treat the port like you treat the repository.

## Several projects

Started inside a project, the dashboard shows that one. The project menu in the top bar lists the ten most recently opened projects (from the history file — one project id can appear at several paths, clones and worktrees included), projects found two levels under the parent directory or under `--scan DIR`, and ids that have a personal file in `~/.keep-the-why/` but no known location yet. Opening a project moves it to the top. `--no-history` leaves the file alone.

## What it shows

| View | Content |
|---|---|
| **Overview** | Type / Status / Evidence distributions, config, linter state, topic cards, recently touched entries |
| **Graph** | topics as hubs, entries around them colored by Evidence (ring = open / needs-review / pending-confirmation, hollow = superseded), references between topics as edges; drag, zoom, hover to focus, click to open |
| **Topics** and the **reader** | one topic file, its entries; an entry rendered with its fields, `Reason` / `Rejected alternative` / `Consequence` as callouts, references as links, previous / next |
| **Details pane** | for the open entry: fields, created by / last touched / status history from Git, backlinks (entries in other files that reference this one), linter findings on this entry |
| **Queues** | what needs a person: `open`, `needs-review`, `pending-confirmation`, `Evidence: unknown` on active entries, and the `Revisit when` triggers on record |
| **Timeline** | entries by the month their heading first appeared in Git, stacked by author; superseded events marked |
| **Authors** | per Git author: created, touched, superseded, first / last activity, Evidence mix of what they created; click to filter every view |

Search (`/`) over titles and bodies; filters by status, evidence and author apply everywhere. Keys: `g` graph, `o` overview, `q` queues, `t` timeline, `a` authors.

## What Git can and cannot tell

`git blame` on an entry's heading says who committed it and when; `git log -L` on its `Status` line gives the sequence of values with author and date; `git log -S` on the heading finds the commit that introduced it. That is the author layer — and it is Git's notion of author: the committer of record. When a coding agent writes an entry inside a developer's session, Git shows the developer. The dashboard reports what Git says and adds no convention of its own.

## How it is built

- Python, standard library only, plus [`keep-the-why-lint`](https://pypi.org/project/keep-the-why-lint/) as the parser: the dashboard shows exactly what the linter accepts, and nothing is parsed twice.
- The page is plain JavaScript (one module, no framework, no build step, no CDN) so the exported file works offline and the repository carries no second toolchain. The force-directed graph is a hundred lines of canvas.
- The server is `http.server` with one background thread for the fingerprint check and an SSE endpoint. `--export` inlines the same page with the same state.

Part of the [keep-the-why](https://github.com/oliver-zehentleitner/keep-the-why) repository, under `dashboard/`, released on its own version counter like the linter. Documentation: https://keepthewhy.com/dashboard/

## License

[MIT](https://keepthewhy.com/license/)
