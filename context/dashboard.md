# Dashboard

## A dashboard exists despite the "no dashboard" line, as a read-only lens that stores nothing

**Id:** 55e36439-f311-48b9-9279-0197af4d5601
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Verification:** corroborated — re-checked 2026-09-27 when the *forget* control arrived (`project-families.md`): the dashboard now removes a row from `~/.keep-the-why/projects.json` and deletes a context cache on request, which is the "asked to write anything" trigger; the rule is restated more precisely rather than changed — the dashboard never modifies project content, and may manage Keep the Why's own local metadata and caches, all of it in the developer's home, none of it the only copy of anything
**Revisit when:** the dashboard is asked to write into a project's own files, to hold state a project depends on, or to become the primary way anyone reads `context/`
**See:** project-families.md#the-dashboard-shows-the-family-as-a-view-and-a-grouped-menu-keeps-forget-out-of-the-dropdown-and-makes-the-id-an-address — 55247232-1368-40b4-a955-3c929b7f7b6b — as of 2026-09-28
**See:** project-families.md#the-mapping-is-one-json-file-in-the-developers-home-kept-by-the-skill-and-the-dashboard-alike — 3c014723-e167-4018-b82a-eaef5425a437 — as of 2026-09-28

`docs/philosophy.md` said, until the dashboard existed, that the project introduces "no new platform, database, daemon, dashboard, or workflow". `keep-the-why-dashboard` exists — as a viewer over data the project already has: the entries in `context/`, `.keep-the-why`, the linter's findings, and the Git history of all of it. It writes nothing into any project, holds its state only in the memory of the terminal it runs in, and rebuilds that state from Markdown and Git whenever the project changes. Deleting it loses nothing. The one file it keeps — `~/.keep-the-why/dashboard-history.json`, the projects opened so far with their paths — is convenience for the project menu, next to the skill's own personal files and equally outside every repository. Since dashboard 0.2.0 (2026-09-27) that file is `~/.keep-the-why/projects.json`, the mapping the skill keeps too (`project-families.md`); the old file is folded in and removed, and the rule is unchanged: local metadata in the developer's home, never project content.

**Reason:** the philosophy line is about where knowledge *lives* — a dashboard that is the place where reasoning is entered or stored would contradict it. A lens does not. What the dashboard shows is what `git blame`, `git log -L` and a Markdown parser return; connecting those for a person who will not run them by hand is the whole product. The line itself was corrected rather than kept: the absence list now reads "no daemon, no database, no account", the bullet says "nothing lives behind a UI" and names the dashboard as the test of that sentence, and the dashboard stands next to the linter as the second tool that reads and holds nothing. Keeping "no dashboard" on the site while shipping one would have been the kind of gloss the project argues against.

**Rejected alternative:** no dashboard, on the strength of the line. Rejected — visibility is what adoption turns on, and a project with sixty entries and a two-month Git history has a story no folder listing tells. Also rejected: a dashboard with an edit or approval flow ("confirm this pending entry here"). That would make it a second write path beside the skill and a place where state lives; the queues view lists what needs a person and stops there.

**Consequence:** every feature request that involves writing into a project, persisting project content, or replacing the Markdown as the source of truth is out of scope by construction, not by roadmap. The history file is the test case for the line: it holds ids and paths, never content, and it lives where the skill already keeps per-developer state (`~/.keep-the-why/`) because one project id can sit at several paths and the personal file, keyed by id, cannot say which.

## The dashboard lives in this repository under `dashboard/`, on its own version counter, with the linter as its parser

**Id:** 66a89059-545d-4134-a923-d9f9eabdf964
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11; the linter precedent in `release-and-distribution.md`
**Revisit when:** the dashboard's release cadence or contributor base outgrows this repository's checklist, or it stops depending on the linter's parser
**See:** release-and-distribution.md#the-linter-lives-in-this-repository-under-lint-published-to-pypi-as-its-own-package — 1e8bbd08-7e94-4362-a822-c76fb1b9a364 — as of 2026-09-28

Same shape as the linter: developed in `dashboard/` with its own `pyproject.toml`, tests and PyPI README, published as `keep-the-why-dashboard` with its own version, tagged `dashboard-v<version>` by its own publish workflow. It imports `ktw_lint` for `.keep-the-why` and entry parsing and adds only what the linter does not keep — entry bodies, cross-references between topics, Git attribution.

**Reason:** one parser. The linter already decides what a valid entry is; a second parser in a second repository would drift from it on the first schema change. In the monorepo a schema change lands in the linter and the dashboard in one PR, and `dashboard-package.yml` installs the linter from the same checkout. One docs site (`docs/dashboard.md`, the live example under `/dashboard/live/`), one issue tracker, one `context/`. The arguments that once favoured a separate repository — independent cadence, own stars — are served by PyPI packaging inside the repo, exactly as the linter entry records.

**Rejected alternative:** a separate `keep-the-why-dashboard` repository, the pattern the maintainer's other dashboard package follows. Considered first, rejected on the linter precedent: the drift risk is real and the benefits are had without it.

**Consequence:** the repository's trust statement ("the skill package is instructions only") keeps referring to `skills/keep-the-why/`, not to the repository; `dashboard/`, like `lint/`, is code beside the skill, never inside it.

## The page is plain JavaScript — no framework, no build step, no CDN

**Id:** df1af5b5-8180-49e2-bdeb-97bf4e4aa030
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a view needs more than a hand-written force layout and SVG histogram can carry, or the module passes a size where one file stops being reviewable

One ES module served as-is, CSS bars, a canvas force layout of about a hundred lines, an SVG histogram. `--export` inlines the same module and stylesheet into one HTML file with the state embedded.

**Reason:** the export must be a single file that works offline and can be published anywhere without a network dependency, and a Python repository should not acquire a Node toolchain for a page that draws bars, tables and one graph. A build step is also the first thing that rots in a side package nobody touches for months. `node --check` and a jsdom smoke test in CI are enough verification for this size.

**Rejected alternative:** TypeScript with a bundler. Rejected for the toolchain; the compromise on record, should type-checking become worth it, is `tsc --checkJs` over JSDoc-typed plain JS — types in development, no build output in the package. Also rejected: D3 from a CDN. A CDN breaks the offline export and adds a third-party request to a page that shows a project's internal reasoning; if D3 is ever needed it is vendored as one minified file with its licence.

## Live mode rebuilds the state from a fingerprint and pushes it over Server-Sent Events; nothing is stored

**Id:** 1548c5d8-7472-470b-ace7-889396e3f42d
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a project's `context/` grows past the point where a full rebuild after every change takes more than a few seconds, or a consumer needs the dashboard to run without a local checkout

The server polls a cheap fingerprint every two seconds — HEAD, the mtimes of `.git/index` and `.git/HEAD`, of `.keep-the-why` and of every file in the context directory. When it changes, the state is rebuilt (Git attribution per file is cached by blob hash and HEAD, so an unchanged file costs nothing) and pushed to every open page over `/api/events`. The page re-renders in place, keeping the open entry, filters and scroll position. The export is the same state frozen once.

**Reason:** the two things that change a project — a `git pull` and an agent writing an entry mid-session — both show up in that fingerprint, uncommitted writes included (they appear with the author `working tree`). Polling files is simpler and more portable than inotify-style watching and costs nothing at a two-second interval. SSE over `http.server` needs one thread per open page and no library; WebSockets would have needed a dependency for no gain, since traffic is one-directional. Not storing the state anywhere is what keeps the first entry in this file true.

**Rejected alternative:** a persisted state file or a small database, updated incrementally. Rejected because it makes the dashboard a store and introduces the one failure mode a viewer must not have: showing something the repository no longer says. A full rebuild from disk is the guarantee that it cannot.

## Authors are Git authors, shown as-is; no agent-versus-human convention

**Id:** 7992bf4b-6ca7-4f68-ae34-c61aa352cc2c
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a project using the dashboard asks to tell agent-written entries from human-written ones, or a commit trailer or entry field for that purpose appears in the schema

The author layer comes from three Git calls per entry: `blame` on the heading for who committed it and when, `log -L` on the `Status` line for the sequence of values with author and date, `log -S` on the heading for the commit that introduced it. The dashboard reports the committer of record. When an agent writes inside a developer's session, that is the developer; in a repository where the agent commits under its own identity, it is the agent. E-mail addresses never enter the state; `--anonymize` replaces names for exports of other people's repositories. Names follow the project's `.mailmap`, as `git log` and `git shortlog` do: two identities of one author — the same account committing under a second name and address from another machine's configuration — are joined in the repository, where Git itself shows them joined, not by the viewer guessing that two names are one person (added 2026-09-28, when the suite showed one agent account as two authors).

**Reason:** the question the maintainer wanted answered is *who* created what — the user layer — not *what kind of author* did. Git answers the first exactly and the second not at all; inventing a convention (a commit trailer, an entry field) to answer the second would be a schema change decided by the viewer, and it is not clear anyone wants the distinction. It could also read as a value judgement on agent-written entries, which the project does not make.

**Rejected alternative:** a `Captured-by:` commit trailer or entry field, read by the dashboard. Deferred rather than refused: it belongs in the skill's schema if it comes, after a project has asked for it, not in a viewer's first version.

## The skill names the dashboard, and never installs or starts it

**Id:** b1fb0c8f-8472-49c1-91c3-97791b413fb9
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-11
**Revisit when:** the dashboard becomes something a session would run as part of a workflow step, or the trust statement about what the skill may install changes

`SKILL.md` has a "Reading it back" section, the project init wizard says once at its end that the dashboard exists, and the `context/README.md` the wizard writes points at it. All three name the package, the two commands and the documentation URL; none of them runs anything.

**Reason:** a developer who has just set up Keep the Why, or who asks the agent how to see what has been recorded, should learn that a viewer exists — from the skill, not by chance. The trust statement in the installation docs is that the only install the skill may trigger is the linter, and it stays true: the dashboard is information, like the badge, and the developer installs it or not.

**Rejected alternative:** a wizard question "install the dashboard?" like the linter's `local-lint`. Rejected — the linter is the skill's own check on what it writes; the dashboard is a tool for a person, started when a person wants to look, and a wizard that installs a web server on a yes widens what the skill does on a machine.

## The update check is the server's one network call; the page asks other hosts only for what a person opens

**Id:** 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-11
**Verification:** corroborated — re-checked 2026-09-27 when public mode arrived (`project-families.md`): the Python server still makes the one call, and the *page* now fetches a family member's raw `.keep-the-why` and its published `state.json` when a person switches it to public — on request, in the browser, never from the server and never from the skill; an exported page left in local mode still makes none; re-checked 2026-09-28 when author profile links arrived: the page also asks a host's API for one commit, on a click on an author's name — again a request the person makes, from the browser; re-checked 2026-09-28 when a `See` into another repository learned to open its entry: the page fetches that repository's raw `.keep-the-why` and its published `state.json` on the click on *open*, never before, and an export that nobody clicks in still makes none
**Revisit when:** the server is asked for a second call, the page is asked to fetch anything that is not part of what the person opened, or the check is asked to do anything but compare two version strings
**See:** project-families.md#public-mode-is-the-browser-reading-published-exports-bootstrapped-from-a-raw-keep-the-why-at-head — cae2d3bf-9ca6-42a8-98f4-6da2ca1904d3 — as of 2026-09-28

At start and once every 24 hours the server asks `pypi.org/pypi/<name>/json` for the newest `keep-the-why-dashboard` and `keep-the-why-lint`; a newer release makes the package's entry in the status bar shimmer, with the version and the `pip install -U` line in its tooltip. `--no-update-check` turns it off. The exported page never checks.

**Reason:** the dashboard is where a developer looks at the project between sessions, so it is the place a stale linter or dashboard gets noticed — the skill's own update check covers the skill, not these two packages. Doing it server-side keeps it to one request per day per running dashboard, sent by a program the developer started on their own machine.

**Rejected alternative:** the check from the page (PyPI's JSON API allows cross-origin reads). Rejected because the same page is what `--export` publishes, and a static page must not call out on behalf of everyone who opens it — the export makes no requests, and the live page makes them only to its own server.

**Consequence:** the README's "no network calls" sentence became "one network call, named, with an off switch"; the check compares version strings and nothing else, sends nothing but the request, and a failed lookup shows nothing rather than a warning.

**Consequence (2026-09-29, maintainer decision):** "the exported page makes none" became "the page asks other hosts only for what a person opens". Opening an entry that cites an entry in another repository now fetches that repository's `.keep-the-why` and published `state.json` to show the target's title — before, only a click did. The trigger is still the person: an export that opens on its overview, or on an entry without such references, fetches nothing. What the page fetches from another project goes out without referrer or credentials, with a timeout and a size limit, since that project's owner chose the URL (the entry on resolving references across repositories, below).

## The dashboard reads only what the linter would; the boundary check is its own copy of the linter's rule, not a linter API

**Id:** a0f40376-651e-4f87-ab24-7af80f31adc8
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** an external audit of `main` at 880be51 (2026-09-22), reproduced with synthetic files; the fix in the PR that added this entry
**Revisit when:** the linter grows a public "files it would read" API, or a third reader of `context/` appears

`StateBuilder.build()` reads no entries when the linter rejected the configured location (`E009`), and `_read_context()` skips any topic file, the index or the context directory itself that resolves outside the project — the same realpath rule `ktw_lint` applies before it reads. Before, the dashboard took the linter's finding and read the files anyway: a symlink named `x.md` inside `context/`, or a `context: ../…` line, put any readable file into the page and into a shared export, while the trust model said such a value "is not read".

**Reason:** the first entry in this file says the linter is the parser and the dashboard shows what the linter accepts. Where the linter reads from is part of that verdict, and the dashboard had implemented only the parsing half of it. The export is the part that made it more than a local nuisance: an export is meant to be shared, and it carried whatever the symlink pointed at.

**Rejected alternative:** have the linter expose the set of files it accepted and let the dashboard consume that (the audit's suggestion, and the cleaner shape). Rejected for now because it couples a dashboard fix to a linter release: the dashboard pins a `keep-the-why-lint>=` floor, and the linter is released first and with the skill. Five lines of the same rule, with a comment naming the linter's, ship the fix on the dashboard's own counter. The revisit line is the door back to the cleaner shape.

**Consequence:** four regression tests (rejected location, topic symlink, index symlink, directory symlink) and a fifth for the new `shallow` flag. The fingerprint never stats a rejected location either.

## Family search covers the whole tree; routing keeps to the family

**Id:** 9befaaa5-5823-4efd-9050-a055c8cfe0dc
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer testing the dashboard on the suite, 2026-09-28 — a term known to be in the WebSocket client's context/ was not found from the cluster's dashboard with the family scope
**Revisit when:** a tree grows large enough that fetching every member's state on the first family search is slow, or search is asked to follow references outside the tree

The search's *family* scope reads every member of the tree the project belongs to: the parent chain up to the topmost local ancestor, and from there every project a children block names, level by level — uncles, cousins, a sibling's children. The server lists them with `/api/family?tree=1` (role `relative` and `via` for what the Family view does not show); public mode walks the published exports the same way, a relative location resolved inside its own repository. The Family view shows the same tree, nested: each project under the one whose children block lists it — changed the same day, after the maintainer missed the cluster's dashboard there when looking from the suite.

**Reason:** the family, as routing defines it, stops at the parent's children. From a grandchild (the cluster's dashboard) that left out the rest of the suite, so a subject recorded in a sibling of the parent — the WebSocket client — was unreachable from exactly the place a reader was likely to ask. Reading across the tree was already allowed (any member may be read; only writes are bounded), so the narrower scope protected nothing.

**Rejected alternative:** searching the family only, as before, and linking to the parent for more. Rejected because a search that silently misses part of the tree reads as "not recorded anywhere", which is the one wrong answer a reader cannot detect.

**Consequence:** members that are not on the machine, or whose state does not load, are listed under "Not searched" on the results page and counted in the dropdown, never dropped silently. One *this project / family* switch next to the project menu sets the scope for search and graph alike, instead of a scope per view.

## An author's name opens their profile on the host, looked up on the click

**Id:** abc3718d-0ddb-45a8-9104-a7a366c56d73
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-28
**Revisit when:** a host's API stops naming the account behind a commit without a token, or a page is asked to look up authors before anyone clicks

A Git author's name in the dashboard links to their profile on the host.
On the click the browser asks the host's API for one of that author's
commits — the newest the page shows — and opens the account it names;
until then, and whenever the lookup fails, the link is the commit's own
page, which names the author too. GitLab's commit API names no account, so
there the commit page is the link. An `--anonymize` state carries
`anonymized` and gets no link at all.

**Reason:** Git knows a name and an email, and neither is a profile: the
suite's agent account commits as `mail@aigent.zehentleitner.co`, from
which no login follows; only GitHub's `…@users.noreply.github.com`
addresses carry one. The host knows which account made a commit, and a
commit hash is already in every entry's Git record. Asking on the click
keeps the page's rule that it fetches only what the person asks for.

**Rejected alternative:** resolving authors when the state is built, on
the server. Rejected because it would be the server's second network call,
made for every author of every project on every rebuild, against a rate
limit of sixty requests an hour — and the exported state would carry the
answer to everyone who opens it.

**Rejected alternative:** deriving the profile from the email. Rejected as
right only for the rare noreply address and wrong in silence otherwise.

**Rejected alternative:** a link on an anonymized export. Rejected because
the commit hash names the person the export was made to hide.

## A `See` into another repository is resolved when the entry is shown, family or not, through that repository's published export

**Id:** ffdb33a5-3d9c-43b8-951b-a95a90ac2a74
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-28, while linking the thesis page's `context/` with this one; resolution on display, maintainer decision 2026-09-29
**Revisit when:** a host refuses the raw fetch for public repositories, or a `See` locator grows a `root` for a project below a repository's top level
**See:** dashboard.md#the-update-check-is-the-servers-one-network-call-the-page-asks-other-hosts-only-for-what-a-person-opens — 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a — as of 2026-09-29
**See:** dashboard.md#family-search-covers-the-whole-tree-routing-keeps-to-the-family — 9befaaa5-5823-4efd-9050-a055c8cfe0dc — as of 2026-09-28

When the reader shows an entry, every cross-project `See` or `Superseded by` in it is resolved, in every mode: from the page's own state when it holds the target (the family merged in), then — on the live server — any project known on this machine, then the target's published export: the raw `.keep-the-why` at `HEAD`, its `dashboard-state`, that `state.json`. The row then shows the target's title, status and evidence and links to the entry there. The canonical is the fixed part of the reference; the state URL is derived from it each time, so a project that moves its site stays reachable. A target without an export, an export without that Id, or an export whose `canonical` names another repository, is said so in the row, with the repository and the Id left on the page. One fetch per project however many rows ask; no referrer, no credentials, a timeout and a size limit; foreign titles are set as text.

**Reason:** the format already allowed a `See` into any repository — the locator is a canonical, not a family member — but the page could follow one only inside the family, and in a static export not at all. Two projects that are related without one being part of the other (a thesis page and the practice it names) link their decisions to each other like any other pair; making them a family to get the link working would have routed entries between them, which neither wants. Public mode already had the whole mechanism for family members — raw config, `dashboard-state`, the published state — so following a reference outside the family is the same fetch on a different trigger.

**Rejected alternative:** resolve cross-project references at export time, in CI, and bake the target's title and export URL into `state.json`, so the page itself fetches nothing. Rejected (2026-09-28, and again when resolution moved to display on 2026-09-29) — the baked data would be as old as the last build of the citing project, not of the cited one, and the live server would need a second network call for the same thing; the reference is meant to be dynamic, read from the target's own config as it is now.

**Rejected alternative:** resolve only on a click, with *open* beside the canonical and the Id (the first version, 2026-09-28). Rejected by the maintainer the next day — the reference is shown with its repository link as the prominent part and reads like a link to GitHub, not to the entry; a page that cites another project should show what it cites.

**Rejected alternative:** leave references outside the family as text (canonical plus Id, found by grep in a clone). Rejected — that is what the page did, and it is the case the maintainer asked to fix.

**Consequence:** only a project at its repository's top level can be reached this way, because a `See` locator carries the canonical and nothing more; a project below the top level (an isolated-context mono repo) is found only when it is in the family, or checked out here.

## Friends — repositories cited outside the family — load into the graph on a click, linked and never merged

**Id:** b1b36585-edb2-416c-95fe-126ed4b4b788
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-29
**Revisit when:** friends are asked for outside the graph (search, a view of their own), or a project's friends grow numerous enough that one click loading all of them is slow
**See:** dashboard.md#a-see-into-another-repository-is-resolved-when-the-entry-is-shown-family-or-not-through-that-repositorys-published-export — ffdb33a5-3d9c-43b8-951b-a95a90ac2a74 — as of 2026-09-29
**See:** dashboard.md#the-update-check-is-the-servers-one-network-call-the-page-asks-other-hosts-only-for-what-a-person-opens — 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a — as of 2026-09-29

The graph offers the repositories its entries cite by a cross-project `See` or `Superseded by` outside the family as *friends*. They are loaded only when a person clicks *friends (N)* in the graph, in every mode — the count comes from the entries already on the page — and each is loaded the way a reference row resolves it: a project known to the live server, else the repository's published export. One level deep: a friend's own friends are not followed. A friend is a hub with a dashed ring and the entries cited there, joined by their `See` lines; a click on the hub shows the whole friend. Friends are linked into the graph, never merged into search, queues, counts or the other views.

**Reason:** a family is a routing relation — entries are written into the member whose scope fits — and projects that only cite each other must not become one to be seen together, which is why a `See` into any repository already resolves on display. The graph is where such links are read as a web, so that is where friends appear. "Friends" names the difference from the family: connected, nothing routed between them.

**Rejected alternative:** load friends when the page opens. Rejected by the maintainer — never as a default; the page asks other hosts only for what a person opens, and a click on *friends* is that request.

**Rejected alternative:** merge friends into the page like the family scope does (search, counts, queues). Rejected — a friend is not part of this project's knowledge, and counting its open questions here would misstate what this project owes.

**Rejected alternative:** show each friend whole from the start. Rejected for readability — a large friend would bury the project's own graph; the cited entries come first, the hub expands on a click.

**Rejected alternative:** follow friends of friends. Rejected — the web would grow without a bound the reader chose. One hop is enough because the reader can move the centre: a friend's name in the legend opens that project's own dashboard, which again shows one hop from there. The web is walked from centre to centre, each view bounded, rather than loaded as a whole.

## Thoughts are the longest chains of See and Superseded by, listed beside the graph

**Id:** cfe036bd-3264-411d-b26d-4214a22f6fe2
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer idea, 2026-09-29 (the name, the list, "a path when you point at the label or click it"); the derivation was left to the implementer and measured on this repository and the UNICORN Binance Suite the same day
**Revisit when:** projects carry enough citations that the list grows too long to read, or thoughts are asked to be named and kept rather than derived

Beside the graph, *Thoughts* lists its lines of reasoning: the longest chains of entries in which each cites the one before — a `See` read from the later entry to the earlier, a `Superseded by` from the old entry to its successor — with at least 3, 4 (the default) or 5 entries, never a part of a longer chain, in reading order (origin first). They run across projects wherever the graph spans them: with the family scope through the family, with friends loaded through them. Pointing at one lights its path; a click holds it and lists its steps. A chain made only of `Superseded by` is marked *evolution*: how one decision changed over time.

**Reason:** a `See` or `Superseded by` is a recorded "follows from" or "replaced", so a chain of them is a line of reasoning someone actually wrote down, which is what the name promises. Measured on 2026-09-29: from four entries up there is one such chain in this repository (public mode → the page asks other hosts only on request → a `See` resolved on display → friends) and none across the eight repositories of the UNICORN Binance Suite; from three there are nine there, most of them fanning into one decision. The chains are few and meaningful, and the length choice lets a sparse project show its shorter ones.

**Rejected alternative:** any path through the graph longer than a threshold. Rejected — topic membership and topic references connect almost everything, so the paths number in the thousands and say nothing.

**Rejected alternative:** thoughts named and kept by a person (a field or a file listing the entries). Rejected for now — a format change for something the recorded citations already express; revisit when derived chains turn out not to be the thoughts people mean.

## The graph turns very slowly in its plane

**Id:** 5f097cf0-af55-47cf-8b23-4125855a8b1a
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-29 ("only move slightly, very slowly, stay in 2D")
**Revisit when:** the motion is reported as distracting while working, or as a battery or CPU cost

The graph turns in its plane, one turn in about six minutes, rotating the node positions around the centre so labels stay upright. It stops while it is pointed at, dragged or panned, stays still with the system's reduced-motion setting, and *motion* in the graph turns it off, kept per browser. While only turning, every other frame is drawn.

**Reason:** a slight movement makes the web read as alive without asking for attention; turning the positions rather than the canvas keeps the text level and the click targets where they are drawn.

**Rejected alternative:** a turntable in 3D, the axis tilted 30° to the left. Considered first and dropped by the maintainer in favour of staying simple: a third dimension for the layout, projection and depth cues, and moving labels and click targets while working.
