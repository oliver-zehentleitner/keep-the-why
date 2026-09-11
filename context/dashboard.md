# Dashboard

## A dashboard exists despite the "no dashboard" line, as a read-only lens that stores nothing

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** the dashboard is asked to write anything, hold state across restarts, or become the primary way anyone reads `context/`

`docs/philosophy.md` said, until the dashboard existed, that the project introduces "no new platform, database, daemon, dashboard, or workflow". `keep-the-why-dashboard` exists — as a viewer over data the project already has: the entries in `context/`, `.keep-the-why`, the linter's findings, and the Git history of all of it. It writes nothing into any project, holds its state only in the memory of the terminal it runs in, and rebuilds that state from Markdown and Git whenever the project changes. Deleting it loses nothing. The one file it keeps — `~/.keep-the-why/dashboard-history.json`, the projects opened so far with their paths — is convenience for the project menu, next to the skill's own personal files and equally outside every repository.

**Reason:** the philosophy line is about where knowledge *lives* — a dashboard that is the place where reasoning is entered or stored would contradict it. A lens does not. What the dashboard shows is what `git blame`, `git log -L` and a Markdown parser return; connecting those for a person who will not run them by hand is the whole product. The line itself was corrected rather than kept: the absence list now reads "no daemon, no database, no account", the bullet says "nothing lives behind a UI" and names the dashboard as the test of that sentence, and the dashboard stands next to the linter as the second tool that reads and holds nothing. Keeping "no dashboard" on the site while shipping one would have been the kind of gloss the project argues against.

**Rejected alternative:** no dashboard, on the strength of the line. Rejected — visibility is what adoption turns on, and a project with sixty entries and a two-month Git history has a story no folder listing tells. Also rejected: a dashboard with an edit or approval flow ("confirm this pending entry here"). That would make it a second write path beside the skill and a place where state lives; the queues view lists what needs a person and stops there.

**Consequence:** every feature request that involves writing into a project, persisting project content, or replacing the Markdown as the source of truth is out of scope by construction, not by roadmap. The history file is the test case for the line: it holds ids and paths, never content, and it lives where the skill already keeps per-developer state (`~/.keep-the-why/`) because one project id can sit at several paths and the personal file, keyed by id, cannot say which.

## The dashboard lives in this repository under `dashboard/`, on its own version counter, with the linter as its parser

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11; the linter precedent in `release-and-distribution.md`
**Revisit when:** the dashboard's release cadence or contributor base outgrows this repository's checklist, or it stops depending on the linter's parser

Same shape as the linter: developed in `dashboard/` with its own `pyproject.toml`, tests and PyPI README, published as `keep-the-why-dashboard` with its own version, tagged `dashboard-v<version>` by its own publish workflow. It imports `ktw_lint` for `.keep-the-why` and entry parsing and adds only what the linter does not keep — entry bodies, cross-references between topics, Git attribution.

**Reason:** one parser. The linter already decides what a valid entry is; a second parser in a second repository would drift from it on the first schema change. In the monorepo a schema change lands in the linter and the dashboard in one PR, and `dashboard-package.yml` installs the linter from the same checkout. One docs site (`docs/dashboard.md`, the live example under `/dashboard/live/`), one issue tracker, one `context/`. The arguments that once favoured a separate repository — independent cadence, own stars — are served by PyPI packaging inside the repo, exactly as the linter entry records.

**Rejected alternative:** a separate `keep-the-why-dashboard` repository, the pattern the maintainer's other dashboard package follows. Considered first, rejected on the linter precedent: the drift risk is real and the benefits are had without it.

**Consequence:** the repository's trust statement ("the skill package is instructions only") keeps referring to `skills/keep-the-why/`, not to the repository; `dashboard/`, like `lint/`, is code beside the skill, never inside it.

## The page is plain JavaScript — no framework, no build step, no CDN

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a view needs more than a hand-written force layout and SVG histogram can carry, or the module passes a size where one file stops being reviewable

One ES module served as-is, CSS bars, a canvas force layout of about a hundred lines, an SVG histogram. `--export` inlines the same module and stylesheet into one HTML file with the state embedded.

**Reason:** the export must be a single file that works offline and can be published anywhere without a network dependency, and a Python repository should not acquire a Node toolchain for a page that draws bars, tables and one graph. A build step is also the first thing that rots in a side package nobody touches for months. `node --check` and a jsdom smoke test in CI are enough verification for this size.

**Rejected alternative:** TypeScript with a bundler. Rejected for the toolchain; the compromise on record, should type-checking become worth it, is `tsc --checkJs` over JSDoc-typed plain JS — types in development, no build output in the package. Also rejected: D3 from a CDN. A CDN breaks the offline export and adds a third-party request to a page that shows a project's internal reasoning; if D3 is ever needed it is vendored as one minified file with its licence.

## Live mode rebuilds the state from a fingerprint and pushes it over Server-Sent Events; nothing is stored

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a project's `context/` grows past the point where a full rebuild after every change takes more than a few seconds, or a consumer needs the dashboard to run without a local checkout

The server polls a cheap fingerprint every two seconds — HEAD, the mtimes of `.git/index` and `.git/HEAD`, of `.keep-the-why` and of every file in the context directory. When it changes, the state is rebuilt (Git attribution per file is cached by blob hash and HEAD, so an unchanged file costs nothing) and pushed to every open page over `/api/events`. The page re-renders in place, keeping the open entry, filters and scroll position. The export is the same state frozen once.

**Reason:** the two things that change a project — a `git pull` and an agent writing an entry mid-session — both show up in that fingerprint, uncommitted writes included (they appear with the author `working tree`). Polling files is simpler and more portable than inotify-style watching and costs nothing at a two-second interval. SSE over `http.server` needs one thread per open page and no library; WebSockets would have needed a dependency for no gain, since traffic is one-directional. Not storing the state anywhere is what keeps the first entry in this file true.

**Rejected alternative:** a persisted state file or a small database, updated incrementally. Rejected because it makes the dashboard a store and introduces the one failure mode a viewer must not have: showing something the repository no longer says. A full rebuild from disk is the guarantee that it cannot.

## Authors are Git authors, shown as-is; no agent-versus-human convention

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a project using the dashboard asks to tell agent-written entries from human-written ones, or a commit trailer or entry field for that purpose appears in the schema

The author layer comes from three Git calls per entry: `blame` on the heading for who committed it and when, `log -L` on the `Status` line for the sequence of values with author and date, `log -S` on the heading for the commit that introduced it. The dashboard reports the committer of record. When an agent writes inside a developer's session, that is the developer; in a repository where the agent commits under its own identity, it is the agent. E-mail addresses never enter the state; `--anonymize` replaces names for exports of other people's repositories.

**Reason:** the question the maintainer wanted answered is *who* created what — the user layer — not *what kind of author* did. Git answers the first exactly and the second not at all; inventing a convention (a commit trailer, an entry field) to answer the second would be a schema change decided by the viewer, and it is not clear anyone wants the distinction. It could also read as a value judgement on agent-written entries, which the project does not make.

**Rejected alternative:** a `Captured-by:` commit trailer or entry field, read by the dashboard. Deferred rather than refused: it belongs in the skill's schema if it comes, after a project has asked for it, not in a viewer's first version.
