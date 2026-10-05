[![PyPI](https://img.shields.io/pypi/v/keep-the-why-dashboard.svg?label=pypi)](https://pypi.org/project/keep-the-why-dashboard/)
[![Python](https://img.shields.io/pypi/pyversions/keep-the-why-dashboard.svg)](https://pypi.org/project/keep-the-why-dashboard/)
[![Downloads](https://pepy.tech/badge/keep-the-why-dashboard)](https://pepy.tech/project/keep-the-why-dashboard)
[![License](https://img.shields.io/github/license/oliver-zehentleitner/keep-the-why.svg?color=blue)](https://keepthewhy.com/license/)
[![keep-the-why-dashboard (package)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/dashboard-package.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/dashboard-package.yml)
[![Black](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml/badge.svg)](https://github.com/oliver-zehentleitner/keep-the-why/actions/workflows/black.yml)
[![Read the Docs](https://img.shields.io/badge/read-%20docs-yellow)](https://keepthewhy.com/dashboard/)
[![Telegram](https://img.shields.io/badge/chat-telegram-41ab8c)](https://t.me/unicorndevs)
[![X](https://img.shields.io/badge/x-%40keep__the__why-000000?logo=x)](https://x.com/keep_the_why)
[![Bluesky](https://img.shields.io/badge/bluesky-%40keep--the--why-0285FF?logo=bluesky&logoColor=white)](https://bsky.app/profile/keep-the-why.bsky.social)
[![Mastodon](https://img.shields.io/badge/mastodon-%40keep__the__why-6364FF?logo=mastodon&logoColor=white)](https://mastodon.social/@keep_the_why)
[![Keep the Why · live](https://keepthewhy.com/dashboard/live/badge-entries.svg)](https://keepthewhy.com/dashboard/live/)

<a href="https://keepthewhy.com"><img src="https://keepthewhy.com/assets/logo.png" alt="Keep the Why — because &quot;ask Bob&quot; is not documentation."></a>

# keep-the-why-dashboard

Keep the Why preserves the reasoning behind your code. keep-the-why-dashboard shows it — who recorded what, when, and what still needs a person.

**keep-the-why-dashboard** is the read-only viewer for [Keep the Why](https://keepthewhy.com) projects — Obsidian's graph and reader, for the *why* behind a codebase. Keep the Why is a repo-native convention and agent skill for preserving that reasoning: decisions, rejected alternatives, workarounds, incidents, constraints, stored as versioned Markdown in `context/`. Everything the dashboard shows is already in the repository — the entries, the config in `.keep-the-why`, the linter's findings, and the Git history of all of it. It connects them into one page: a graph of topics and references, an entry reader with backlinks, queues of what needs a person, a timeline, and per-author attribution from `git blame` and `git log`.

**Tested three ways.** Python unit tests for what the server computes (state, Git, mapping, family, the endpoints over a real local server); `node --test` for the page's pure part (`web/lib.js`: host URL grammars, tolerant state reading, reference parsing, family grouping), no dependencies; a jsdom smoke test that loads an export, drives every route and checks the family view, the entry page by Id, the search and its results page; and a jsdom test of public mode over a stubbed published tree, a repository outside the family included.

**A viewer, not a store.** It writes nothing into any project, runs no daemon beyond the terminal you start it in, and is never a source of truth: delete it and nothing is lost. That is what keeps it inside Keep the Why's own rule — *no new platform, database, daemon, account, or workflow* — a lens on Markdown and Git, not a place where anything lives; see [Philosophy](https://keepthewhy.com/philosophy/). The one file it keeps is `~/.keep-the-why/projects.json`: where the projects you opened live on this machine, shared with the skill's own setup check, so the project menu can offer them again (a `dashboard-history.json` from before 0.2.0 is folded in and removed).

**Runs on:** Python 3.10–3.14, the standard library plus [`keep-the-why-lint`](https://pypi.org/project/keep-the-why-lint/) as the parser. The page is plain JavaScript — two modules, inlined into one page in an export, no framework, no build step, no CDN — so the exported file works offline. The server's only network call is an update check against pypi.org for the two packages, at start and once a day (`--no-update-check` turns it off). The exported page loads nothing when it opens; the page asks other hosts only for what a person opens — another project's published `.keep-the-why` and `state.json` when an entry with a reference into that repository is shown, the family scope is chosen, the Family view is opened, an entry Id the export does not hold is opened, a graph is shown with *friends* on (the default), or public mode is on, and a host's API for one commit on a click on an author's name.

Website: [https://keepthewhy.com](https://keepthewhy.com/) · [llms.txt](https://keepthewhy.com/llms.txt) for AI agents/assistants looking up this project

Documentation: [Dashboard](https://keepthewhy.com/dashboard/) · [Live example](https://keepthewhy.com/dashboard/live/) (this repository's own `context/`) · [Linting](https://keepthewhy.com/linting/) · [Specification](https://keepthewhy.com/specification/) · [Trust model](https://keepthewhy.com/trust-model/)

## How it works

`ktw-dashboard` reads `.keep-the-why`, parses the configured context directory with the linter's own parser, adds what the linter does not keep, and serves one page:

- **Entries** — title, `Type`, `Status`, `Evidence`, `Source`, `Verification`, `Revisit when`, and the body with `Reason` / `Rejected alternative` / `Consequence` as callouts; references between topics become links and graph edges
- **Git** — per entry: who created it and when (`git log -S` on the heading), who last touched it (`git blame`), and the sequence of `Status` values with author and date (`git log -L` on the Status line). Uncommitted entries show as author `working tree`
- **Linter** — the findings `ktw-lint` would report, per entry and as a list; the same rules, run in-process
- **Live** — the server checks the project's fingerprint (HEAD, `.git/index` and `.git/HEAD`, `.mailmap`, `.keep-the-why`, `AGENTS.md`, the files under `context/`) every two seconds and pushes a fresh state to every open page over Server-Sent Events. A `git pull` or an entry an agent wrote a moment ago shows up within seconds
- **Export** — `--export DIR` writes one self-contained `index.html` with the state embedded, plus `state.json` and two live badges, `badge-entries.svg` (Keep the Why's style) and `badge-entries-flat.svg` (flat) (the project's numbers, for a README badge); no server, and nothing loaded from elsewhere when it opens. For GitHub Pages, a release asset, or the link behind the [live badge](https://keepthewhy.com/badge/#live-badge)

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

### Family, friends, thoughts

- **Family** — projects that belong together: a parent lists its children, one scope line each — the routing. The *family* scope shows the whole tree as one.
- **Friends** — repositories outside the family that entries here cite (`See` / `Superseded by` with the other repository's `canonical` and an entry's `Id`). Linked into the graph, never merged; a friend in a family comes as its whole family. One hop — walk to a friend to see its friends; the page keeps the path.
- **Thoughts** — chains of entries, each citing the one before, across projects: found in the recorded citations, never written by hand. Listed beside the graph, read whole with *read ›*, summed up on the Thoughts view, with the chains that start unconfirmed or pass a step in question.

### Several projects

Started inside a project, the dashboard shows that one. The project menu shows families grouped, a parent with its children indented, and each project's type; one switch next to it sets *this project* or *family* for search and graph. The project menu in the top bar lists the ten most recently opened projects (from the history file — one project id can appear at several paths, clones and worktrees included), projects found two levels under the parent directory or under `--scan DIR`, and ids that have a personal file in `~/.keep-the-why/` but no known location yet. Opening a project moves it to the top. `--no-history` leaves the file alone.

## What it shows

| View | Content |
|---|---|
| **Strip** (every view) | entries, topics, authors · what needs a person: open, needs review, pending confirmation, unknown evidence, revisit-when triggers · linter errors and warnings — each a link |
| **Overview** | Type / Status / Evidence distributions, config, topic cards, recently touched entries |
| **Graph** | topics as hubs, entries around them colored by Evidence (ring = open / needs-review / pending-confirmation, hollow = superseded), references between topics as edges; drag, zoom, hover to focus, click to open. With the *family* scope it draws every project of the tree as a hub in its own colour, parent and child projects joined, and the See and Superseded by lines between entries across projects. *Friends* — repositories cited outside the family — load with the graph (unchecking *friends* turns that off, kept per browser; *friends (N)* then loads them on a click): a hub each with the cited entries (a click on the hub or its name goes there), a friend in a family as the whole family, one unit, linked by their See lines, never merged into search or counts. *Thoughts* beside the graph are its chains of linked entries — the longest chains of See and Superseded by, from 3, 4 or 5 entries up; pointing at one lights its path, a click holds it and lists its steps, *read ›* opens the whole thought in one view, every entry in order and in full; a chain that goes on into a repository the page has not loaded says *continues ↗*, and one click follows it there, hop by hop, loading only what lies on it. Going to a friend moves the page there in place and keeps the *path* — the projects walked through, in a bar above every view and as numbered hubs in the graph; back and forward walk it, *discard* clears it, a reload starts without one. The graph turns very slowly (off with *motion*, or with reduced motion) |
| **Topics** and the **reader** | one topic file, its entries; an entry rendered with its fields and callouts, references as links, previous / next |
| **Side pane** | the project graph by default; for a topic or an entry its neighbourhood graph, with a *near / project / family* switch in its corner (it starts with the page: *near* on an entry or topic, otherwise the scope); plus fields, created by / last touched / status history from Git, backlinks, linter findings; an entry's thoughts and, for an entry in question, what is linked after it; the width at the top |
| **Queues** | `open`, `needs-review`, `pending-confirmation`, `Evidence: unknown` on every entry still in force (an open question too — Evidence and Status are separate axes), and the `Revisit when` triggers on record — the page lists, it does not decide |
| **Timeline** | entries by the month their heading first appeared in Git, stacked by author; superseded events marked |
| **Authors** | per Git author (names as the project's `.mailmap` maps them): created, touched, superseded, first / last activity, Evidence mix of what they created; a name opens the profile on the host (looked up on the click from one of their commits, the commit page when that fails), the rest of the row filters every view |
| **Friends** | a card per friend (a repository cited outside the family; its family, if it has one, with the members): where it was read from, what cites what in both directions, the repositories reached by following a thought, the ones not loaded and why |
| **Thoughts** | chains of linked entries — See and Superseded by, each entry citing the one before; *from N* sets how many entries a chain needs, 2 up to the longest chain on the page (4 by default): the numbers, where many lines lead and start, the entries many pass through, a table by project, where chains need a second look (a first entry nobody confirmed, a step in question and what is linked after it), when they grew; *read ›* shows one whole |
| **Family** | the whole tree from the root down, each project nested under the one whose children block lists it, with its scope and how it is available here: a working tree, a read-only context cache, or not at all (with the commands to get it) |
| **Projects** | everything this machine knows, families grouped, each row with its type; *forget* removes a mapping row (and a cache directory), never a working tree. Live server only |
| **Entry by Id** | `#entry/<uuid>` opens an entry by its `Id` here or — on the live server — in any project known here (an export or a public page looks through the family's published exports), and is the address every entry link on the page uses — a copied URL survives a reworded heading or a moved entry; the reader shows `See`, `Superseded by` and what the entry supersedes, and a reference into another repository — in the family or not — is resolved as the entry is shown: its title, status and evidence, linked into a checkout on this machine (live server) or that repository's published export at its top level; the details pane links the entry on its host |
| **This project / family** | next to the project menu: one scope for the whole page — with *family* every view shows the family merged (entries, topics, authors, queues, timeline, findings), search and graph over the whole tree |
| **Local / public** | next to the project menu, for a project with a family: *local* reads clones and caches here, *public* reads published exports, this project's own first (so it needs its own `dashboard-state`) — the browser fetches the `.keep-the-why` at `HEAD`, takes the `dashboard-state` URL and loads that `state.json`; family, search and entry-by-Id work over the exports the same way; a static export has no such switch — its family scope reads the members' published exports directly |
| **Findings** | the linter's findings with links to the entries they sit in |
| **Status bar** | the two package versions, linking PyPI; when a newer release exists the entry shimmers and its tooltip names the version and the `pip install -U` line |

Search (`/`): every word must occur in the entry (title, body, the field lines, Id, file); Enter opens a results page with every hit grouped by project, and the *family* scope covers the whole tree, root to leaves. Filters by status, evidence and author apply everywhere. Keys: `g` graph, `o` overview, `q` queues, `t` timeline, `a` authors, `l` findings.

## Example

```text
$ ktw-dashboard
ktw-dashboard 0.3.6 — 11 project(s), selected: /home/me/projects/keep-the-why
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
