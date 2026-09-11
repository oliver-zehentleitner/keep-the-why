---
title: Dashboard
description: keep-the-why-dashboard — a read-only live view over a project's context/, its Git history and authors, served locally or exported as one static page.
---

# Dashboard

`keep-the-why-dashboard` is a read-only viewer over what a Keep the Why project already has: the entries in `context/`, the config in `.keep-the-why`, the linter's findings, and the Git history of all of it — who created each entry, who last touched it, when its `Status` changed and by whom.

It connects data that is already lying around. It writes nothing into any project, runs no daemon beyond the terminal you start it in, and is never a source of truth: delete it and nothing is lost. The one file it keeps is `~/.keep-the-why/dashboard-history.json` — the projects you opened, with their paths, so the project menu can offer them again. That is what keeps it inside this project's own rule — [no new platform, database, daemon, account, or workflow](philosophy.md) — a lens on Markdown and Git, not a place where anything lives.

<div class="ktw-shot" markdown>

[![The dashboard on this repository's own context/: graph, entry reader with Git history, queues](assets/dashboard-screenschot.png)](https://keepthewhy.com/dashboard/live/){ target=_blank rel=noopener }

</div>

**Live example:** [this repository's own `context/`](https://keepthewhy.com/dashboard/live/), exported on every docs build — the screenshot above is a click away from the real thing.

## Run it

```bash
pip install keep-the-why-dashboard
ktw-dashboard            # in a project with a .keep-the-why file
```

The page opens at `http://127.0.0.1:8765/` and stays current: the server checks the project's fingerprint (HEAD, `.git/index`, the files under `context/`) every two seconds and pushes a fresh state to every open page when something changed — after a `git pull` as much as after an agent wrote an entry a moment ago. Uncommitted entries show as author `working tree`, which makes the page a live window on what the skill is capturing during a session.

```
ktw-dashboard [PATH] [--host 127.0.0.1] [--port 8765] [--no-browser] [--interval 2]
              [--export DIR] [--anonymize] [--json] [--version]
```

| Flag | Effect |
|---|---|
| `--export DIR` | writes `DIR/index.html`, one self-contained page with the state embedded (no server, no external requests), plus `DIR/state.json`; then exits. For GitHub Pages, a release asset, or the link behind the [badge](badge.md) |
| `--json` | prints the state and exits |
| `--anonymize` | Git author names become `author-1`, `author-2`, … — for exports of repositories whose contributors did not ask to be listed on a web page. E-mail addresses are never part of the state |
| `--scan DIR` | also look for projects under `DIR` (two levels deep) for the project menu; the parent of the start directory is always scanned |
| `--no-history` | neither read nor update `~/.keep-the-why/dashboard-history.json` |
| `--host 0.0.0.0` | exposes the page on the network; the CLI warns. Everything shown is the project's `context/` — treat the port like the repository |

## Several projects

Started inside a project, the dashboard shows that one. The project menu in the top bar lists the ten most recently opened projects (one project id can appear at several paths — clones, worktrees), projects found near the start directory, and ids that have a personal file in `~/.keep-the-why/` but no known location yet; opening a project moves it to the top of the history.

## What it shows

| View | Content |
|---|---|
| **Overview** | Type / Status / Evidence distributions, config, linter state, topic cards, recently touched entries |
| **Graph** | topics as hubs, entries around them colored by Evidence — a ring marks `open` / `needs-review` / `pending-confirmation`, a hollow dot `superseded` — and references between topics as edges. Drag, zoom, hover to focus a neighbourhood, click to open |
| **Topics** and the reader | one topic file with its entries; an entry rendered with its fields, `Reason` / `Rejected alternative` / `Consequence` as callouts, references as links, previous / next |
| **Details pane** | for the open entry: fields, created by / last touched / status history from Git, backlinks (entries elsewhere that reference this file), linter findings on this entry |
| **Queues** | what needs a person: `Status: open`, `needs-review`, `pending-confirmation`, `Evidence: unknown` on active entries, and the `Revisit when` triggers on record. Whether a trigger has fired is a human judgement; the page lists, it does not decide |
| **Timeline** | entries by the month their heading first appeared in Git, stacked by author; superseded events marked below |
| **Authors** | per Git author: created, touched, superseded, first and last activity, the Evidence mix of what they created. Click a row to filter every view |

Search (`/`) covers titles and bodies; filters by status, evidence and author apply to every view at once. Keys: `g` graph, `o` overview, `q` queues, `t` timeline, `a` authors.

## The author layer, and its limit

Three Git commands make it: `git blame` on an entry's heading says who committed it and when; `git log -L` on its `Status` line yields the sequence of values with author and date; `git log -S` on the heading finds the commit that introduced it. What Git reports is the committer of record. A coding agent writing inside a developer's session shows up as the developer; a repository where the agent commits under its own identity shows the agent. The dashboard reports what Git says and adds no convention of its own — whether that distinction deserves one is a question for the projects using it, not for the viewer.

## How it is built

- Python, standard library only, with [`keep-the-why-lint`](linting.md) as the parser. The dashboard shows exactly what the linter accepts; entry bodies, cross-references and Git are the only things it adds. A schema change lands in the linter once and the dashboard follows.
- The page is plain JavaScript — one module, no framework, no build step, no CDN — so the exported file works offline and the repository carries no second toolchain. The graph is a hundred lines of canvas.
- The server is `http.server` with one background thread for the fingerprint check and a Server-Sent Events endpoint. `--export` inlines the same page with the same state; the page never knows which mode it is in beyond a badge in the top bar.
- Its source lives in [`dashboard/`](https://github.com/oliver-zehentleitner/keep-the-why/tree/main/dashboard) of this repository, versioned and published on its own counter like the linter (`dashboard-v<version>` tags). Why it is here and shaped like this is recorded in this project's [`context/`](https://keepthewhy.com/context/).
