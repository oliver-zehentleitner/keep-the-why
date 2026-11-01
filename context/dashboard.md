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
**Status:** superseded
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-11
**Revisit when:** a view needs more than a hand-written force layout and SVG histogram can carry, or the module passes a size where one file stops being reviewable
**Superseded by:** daab47f5-add1-4ba2-ae24-38162c43af90

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

**Consequence (2026-10-02):** "never installs or starts it" is about the developer's machine. Writing a CI workflow that installs the dashboard on a runner to publish the project's export is one of the optional components, set up on request — config-format.md#optional-components-default-to-no-the-agent-knows-them-offers-them-and-sets-them-up-only-on-request (7889e8b2-d2c3-458d-a19e-10638aca9ded).

**Rejected alternative:** a wizard question "install the dashboard?" like the linter's `local-lint`. Rejected — the linter is the skill's own check on what it writes; the dashboard is a tool for a person, started when a person wants to look, and a wizard that installs a web server on a yes widens what the skill does on a machine.

## The update check is the server's one network call; the page asks other hosts only for what a person opens

**Id:** 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-11
**Verification:** corroborated — re-checked 2026-09-27 when public mode arrived (`project-families.md`): the Python server still makes the one call, and the *page* now fetches a family member's raw `.keep-the-why` and its published `state.json` when a person switches it to public — on request, in the browser, never from the server and never from the skill; an exported page left in local mode still makes none; re-checked 2026-09-28 when author profile links arrived: the page also asks a host's API for one commit, on a click on an author's name — again a request the person makes, from the browser; re-checked 2026-09-28 when a `See` into another repository learned to open its entry: the page fetches that repository's raw `.keep-the-why` and its published `state.json` on the click on *open*, never before, and an export that nobody clicks in still makes none
**Revisit when:** the server is asked for a second call, the page is asked to fetch anything beyond what the person opened and the friends and family of a graph it shows, or the check is asked to do anything but compare two version strings
**See:** project-families.md#public-mode-is-the-browser-reading-published-exports-bootstrapped-from-a-raw-keep-the-why-at-head — cae2d3bf-9ca6-42a8-98f4-6da2ca1904d3 — as of 2026-09-28

At start and once every 24 hours the server asks `pypi.org/pypi/<name>/json` for the newest `keep-the-why-dashboard` and `keep-the-why-lint`; a newer release makes the package's entry in the status bar shimmer, with the version and the `pip install -U` line in its tooltip. `--no-update-check` turns it off. The exported page never checks.

**Reason:** the dashboard is where a developer looks at the project between sessions, so it is the place a stale linter or dashboard gets noticed — the skill's own update check covers the skill, not these two packages. Doing it server-side keeps it to one request per day per running dashboard, sent by a program the developer started on their own machine.

**Rejected alternative:** the check from the page (PyPI's JSON API allows cross-origin reads). Rejected because the same page is what `--export` publishes, and a static page must not call out on behalf of everyone who opens it — the export makes no requests, and the live page makes them only to its own server.

**Consequence:** the README's "no network calls" sentence became "one network call, named, with an off switch"; the check compares version strings and nothing else, sends nothing but the request, and a failed lookup shows nothing rather than a warning.

**Consequence (2026-09-29, maintainer decision):** "the exported page makes none" became "the page asks other hosts only for what a person opens". Opening an entry that cites an entry in another repository now fetches that repository's `.keep-the-why` and published `state.json` to show the target's title — before, only a click did. The trigger is still the person: an export that opens on its overview, or on an entry without such references, fetches nothing. What the page fetches from another project goes out without referrer or credentials, with a timeout and a size limit, since that project's owner chose the URL (the entry on resolving references across repositories, below).

**Consequence (2026-10-01, maintainer decision, dashboard 0.4.3):** the family too. A page that shows the project graph with the *this project* scope fetches the published exports of the family's members, without a click, to draw them beside the project — for the suite, eight. The maintainer chose loading by default over a click deliberately, to find the limits with real data ("we test the limits and learn where the default had better not load"); today the families are small and a graph that shows the family whole is what gets shown to others. The *family* checkbox in the graph turns it off per browser, as the *friends* one does. The revisit line above now names friends and family; the next step beyond — fetching for a view that is not a graph — still triggers it.

**Consequence (2026-09-29, maintainer decision, dashboard 0.3.0):** with friends loading by default, a page that shows a graph — the graph view, or the small graph beside the overview — fetches the published `.keep-the-why` and `state.json` of each repository its entries cite outside the family, without a click. The *friends* checkbox in the graph turns that off for the browser. The trigger is no longer only a person's action for these fetches; it is the page showing a graph that has friends. What is fetched, and how (no referrer or credentials, timeout, size limit, one fetch per project), is unchanged.

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

**Consequence (2026-10-07, scope per search):** the search no longer follows the *this project / family* switch. Enter searches this project; the dropdown's first rows and a bar on the results page offer *family*, *friends* and *family & friends* (`#search/<scope>/<query>`, with `friends` and `all` as new scopes), each shown only where the project has them. Maintainer request: Enter should always search the project at hand, the wider scopes a choice in the dropdown; the bar on the results page was the assisting agent's addition so a scope can change without retyping. The switch keeps the graph, the lists, the queues and the counts. The *friends* scope reads the repositories the entries cite outside the family the way the graph loads them — a local checkout the live server knows, else the published export, a friend's family with it — bodies included, and lists what does not load under *Not searched*. Rejected: Enter following the switch, with the wider rows only adding the rest — the maintainer wanted one predictable Enter.

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

## Friends — repositories cited outside the family — load into the graph, linked and never merged

**Id:** b1b36585-edb2-416c-95fe-126ed4b4b788
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-29; the default reversed by the maintainer the same day
**Revisit when:** projects grow enough friends that loading them with every graph is slow or noisy — then the default goes back to a click; or friends are asked for outside the graph (search, a view of their own)
**See:** dashboard.md#a-see-into-another-repository-is-resolved-when-the-entry-is-shown-family-or-not-through-that-repositorys-published-export — ffdb33a5-3d9c-43b8-951b-a95a90ac2a74 — as of 2026-09-29
**See:** dashboard.md#the-update-check-is-the-servers-one-network-call-the-page-asks-other-hosts-only-for-what-a-person-opens — 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a — as of 2026-09-29

The graph offers the repositories its entries cite by a cross-project `See` or `Superseded by` outside the family as *friends*. They are loaded only when a person clicks *friends (N)* in the graph, in every mode — the count comes from the entries already on the page — and each is loaded the way a reference row resolves it: a project known to the live server, else the repository's published export. One level deep: a friend's own friends are not followed. A friend is a hub with a dashed ring and the entries cited there, joined by their `See` lines; a click on the hub shows the whole friend. Friends are linked into the graph, never merged into search, queues, counts or the other views.

**Reason:** a family is a routing relation — entries are written into the member whose scope fits — and projects that only cite each other must not become one to be seen together, which is why a `See` into any repository already resolves on display. The graph is where such links are read as a web, so that is where friends appear. "Friends" names the difference from the family: connected, nothing routed between them.

**Consequence (2026-10-01, maintainer decision, dashboard 0.4.3):** the family is a neighbour of the project graph too. With the *this project* scope a member — and a citation into one — was absent from the graph until the scope was switched to *family*, which merges everything: search, queues, counts, every entry of every member. Between the two there was no lean step, while friends and the path had one. Now the parent, the children and the siblings are drawn as hubs beside the project, joined as in the family graph, each with the entries linked to this project, and *all their entries* opens them whole — the same layer and the same rule as for friends and the path. Each kind has its own switch and its own *all their entries* beside it (maintainer's call: friends + all their entries, path + all their entries, family + all their entries), kept separately per browser; the one checkbox had lived inside the friends control, opened friends only, and was missing whenever a project had a path but no friends — found on the suite, which cites nothing outside the family itself. The family scope keeps its meaning: the merged view. Found on the suite the same day: beside the project the members came in one colour while the family graph gives each its own, and they floated as islands — the project had no hub of its own, so the parent and child lines had nothing to join. Now each member keeps its family-graph colour, the legend lists them, and the project is drawn as a hub with its topics on spokes whenever the family is beside it, the lines running to it.

**Consequence (2026-10-01, maintainer request, dashboard 0.4.3):** a friend's family can be switched off. "A friend in a family comes as the whole family" above stays the default; seen from Keep the Why, whose friend is the suite, that put eight repositories into the graph with no way to have only the cited one — the *family* switches are the centred project's own family, not a friend's. The friends group now carries *friends families* with its own *entries* and *labels*, offered when a loaded friend has a family; off, the unit is the cited repository alone and the legend says the family is there and not shown.

**Consequence (2026-10-01, maintainer finding, dashboard 0.4.3):** a friend that could not be loaded is said so in the graph. The first real case — a fork of picows cited from the suite, with no published export yet — looked like this: the friends control showed its checkbox and *all their entries* as if the friend were there, the graph drew nothing, and the reason ("no dashboard-state line in the published .keep-the-why") stood only on the Friends view under *Not loaded*. A failed friend is stored as loaded with an error so the page does not retry it on every render; the control now counts those — *N of M not loaded ↗*, each reason in the tooltip, the link to the Friends view — and hides *all their entries* when nothing is there to open. The public-mode test asserts it on its two unloadable fixtures.

**Rejected alternative:** load friends when the page opens. Rejected by the maintainer — never as a default; the page asks other hosts only for what a person opens, and a click on *friends* is that request.

**Consequence (2026-09-29, maintainer decision, dashboard 0.3.0):** the default is turned around: friends load as soon as a graph shows them. Few projects have friends yet, so the cost is a handful of fetches, and a web that needs a click before it appears is not seen. The alternative rejected above is what the default now does; the click stays as the way back — unchecking *friends* turns loading off for this browser (kept), and *friends (N)* loads them on a click again. The rest of the decision stands: linked, never merged; one hop; a friend's hub expands on a click.

**Consequence (2026-09-29, maintainer decision, dashboard 0.3.1):** a friend that is part of a family comes as the whole family — "a family is one unit, like a repository". Loading it reads the family tree around it (on the live server what it knows about that project, else the members' published exports), draws a hub per member joined by their parent lines, and shows the cited entries in whichever member holds them; friends of one family are one unit. One hop still holds: the hop reaches a unit, and the unit's own friends are not followed.

**Rejected alternative:** merge friends into the page like the family scope does (search, counts, queues). Rejected — a friend is not part of this project's knowledge, and counting its open questions here would misstate what this project owes.

**Rejected alternative:** show each friend whole from the start. Rejected for readability — a large friend would bury the project's own graph; the cited entries come first, the hub expands on a click.

**Rejected alternative:** follow friends of friends. Rejected — the web would grow without a bound the reader chose. One hop is enough because the reader can move the centre: a friend's name in the legend opens that project's own dashboard, which again shows one hop from there. The web is walked from centre to centre, each view bounded, rather than loaded as a whole.

## The graph's family display is its own setting, apart from the scope switch

**Id:** b6d033c1-3013-41d5-a87e-3f126cddc4c3
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision while testing on the suite, 2026-10-01 ("the scope is for the general fusion; for the graph I want to control that separately")
**Revisit when:** the scope switch is asked to carry a third value, or a view other than the graph wants a family display of its own
**See:** dashboard.md#friends--repositories-cited-outside-the-family--load-into-the-graph-linked-and-never-merged — b1b36585-edb2-416c-95fe-126ed4b4b788 — as of 2026-10-01

The *this project / family* switch merges search, queues, counts and the lists — the general fusion. How much of the family the graph shows is the graph's own setting, in its control bar beside *friends* and *path*: *family* off is the project alone with its friends and path; *family* on draws the members beside it with the entries linked here; *family* + *all their entries* is the family graph, every member whole. Kept per browser, and the same whichever scope is on; the side pane's graph follows it too.

**Reason:** until 0.4.2 the graph followed the scope — *family* meant the merged family graph, *this project* meant the project alone — and with the family as a neighbour of the project graph (the friends entry) that coupling broke down: in the family scope there was nothing to switch, in the project scope the switch was there, and a reader who wanted the merged queues with a lean graph, or the whole family graph while reading one project's lists, had no way to say so. The graph is one view with three kinds of neighbour; each kind has its switch and its *all their entries*, and the family's pair now covers the whole range the two scopes used to split between them.

**Rejected alternative:** keep the graph on the scope and show the family group only in the project scope. Rejected by the maintainer — the scope is about what is searched and counted, and a graph setting that appears and disappears with it is a second meaning hung on the same switch.

**Consequence:** the old `#graph/family` link sets both — the family scope and the graph's *family* + *all their entries* — and lands on `#graph`, as before. The public-mode test no longer expects the graph to change with the scope; it switches the graph by its own control.

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

**Consequence (2026-09-29, maintainer request, dashboard 0.3.1):** a thought can be read whole — *read ›* opens every entry of the chain in one view, in order and in full, joined by *cited by* or *superseded by*. Its address lists the entries' Ids, so a thought is named by what it consists of, not by a name someone gave it; that keeps the rejected alternative above rejected.

**Consequence (2026-09-29, maintainer request, dashboard 0.3.3):** a thought says what it rests on. An origin with Evidence `inferred` or `unknown` marks the whole line — everything after it builds on a reason nobody confirmed. A step that is open, needs review or waits for confirmation is *in question*, and so is a superseded entry that a later one still cites by `See`; a superseded entry followed by its successor is how an evolution goes on and is not. Every later step rests on the first one in question, which turns the queues into an impact analysis: what else to look at if that entry changes, across projects. The steps' creation days (Git) show how a line grew.

**Consequence (2026-09-29, maintainer decision, dashboard 0.3.8):** the wording follows the data. The reason above calls a `See` "a recorded *follows from*"; the specification defines it more broadly — it "names the place of a related entry", a dependency being one case among others — and the 0.18.0 migration turned every reference to one entry into a `See` line, mentions included. A chain of links therefore shows how entries connect, not that each step depends on the one before. The dashboard, the docs and the specification (§9.7) now say *chain of linked entries*, *first entry*, *linked after*, and name a chain that starts unconfirmed or passes a step in question as entries *to check*, not as what *rests on* them. Rejected: sharpening `See` to mean only "follows from", or adding a field for the kind of link — a format change for the sake of a view, and the existing lines would stay mixed. Raised by an external review of the dashboard the same day.

**Consequence (2026-10-01, maintainer request, dashboard 0.4.2):** the lower bound is 2, and the upper bound is the data. "At least 3, 4 or 5" above was the longest chain of the day written into three buttons; the choice now runs from 2 — one link — up to the longest chain on the page, growing when a friend or a path brings a longer one, 4 still the default. The reason for 2 is not "more": an evolution of one `Superseded by` — a decision replaced once, the commonest shape of "how this changed" — has two entries and was never a thought; the first `See` in a young project is the beginning of one, and the view showed nothing until the third. The cost is a longer list at 2 (every maximal chain, single links included — on this repository 24 beside the graph instead of 1 at 4), which the sort by length keeps readable: the long ones on top, the single links at the bottom as what they are, beginnings. A kept choice above the longest chain here is drawn down to it, so a sparse project lists its chains instead of an empty page. Rejected: a fixed row that ends at 5 (stale the day a 6 appears) and a number field (fine for a 20-chain, which no project has; a row of 2 to about 8 reads at a glance — revisit when a chain outgrows it).

**Consequence (2026-10-01, dashboard 0.5.0):** "there is no index of the web" gained a footnote: the registry (the globe entry below) lists exports whose owners asked to be listed, and the globe can load it as a wave — an invitation, not an index the page needs; what cites a chain's newest entry is still unknown unless that repository is loaded, from a hop or from the list.

**Consequence (2026-09-29, maintainer decision, dashboard 0.3.1):** thoughts at the page's edge. A friend or a path step shows everything its own citation chains connect to the cited entries, so a thought runs through it whole instead of stopping at the first entry cited there. A chain that goes on into a repository the page has not loaded is marked as going on, and a click follows it: exactly the repositories on the chain, as units, hop by hop, up to eight — the click is the request for hops beyond one, and nothing else of those repositories is loaded. Only the direction toward the origin (and a `Superseded by` naming a successor) can be followed: what cites a chain's newest entry from an unloaded repository cannot be known, because there is no index of the web and none is wanted.

## The globe loads the web in waves, each asked for with its count; the registry is an invitation, never a requirement

**Id:** 64f88b63-67b6-4a87-990c-e0258e7b63b0
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer idea and design, 2026-10-01 ("an easter egg: a globe off to the side; hops to set, waves with a warning each; and a file in the repository listing state.json addresses, checked by an action — just for fun"); the form was the assisting agent's proposal, accepted
**Revisit when:** a wave regularly offers more than the dialog can list, or a registry listing is asked to carry anything beyond what the export already says
**See:** dashboard.md#thoughts-are-the-longest-chains-of-see-and-superseded-by-listed-beside-the-graph — cfe036bd-3264-411d-b26d-4214a22f6fe2 — as of 2026-10-01

The globe (`#globe`, the 🌐 left of the search in the top bar; until dashboard 0.7.2 at the end of the status bar) is the graph alone, full width, loading repositories in waves out from what the page holds: hop 1 is what the loaded entries cite outside the page, hop 2 what those cite, up to ten. Each wave is asked for in a dialog naming the repositories and the files before anything is fetched, and a wave's count is only known once the previous one is in — so the pauses are not caution for its own sake but the only order the counting allows. The registry — `registry/projects.txt`, one canonical repository URL per line, added by pull request, followed to each export and built into `docs/registry/index.json` by a workflow — is loaded the same way, as a wave of its own. The setting is not kept per browser.

**Reason:** following a thought already loads repositories hop by hop, along one chain; the globe is the same mechanism in the breadth, and it reuses the layer that draws friends and chain-reached units, so nothing new is drawn, only more of it. The dialog with the list, rather than a browser `confirm`, is there so the reader sees *which* repositories would be fetched, not only how many — the page's rule is that it asks other hosts only for what a person opens, and a wave is that opening, made explicit. Not keeping the setting is the same rule: a remembered globe would fetch from other hosts on a reload without a click.

**The registry and the sentence "there is no index of the web and none is wanted"** (the thoughts entry, cited above): that sentence stands — the dashboard needs no index to work, nobody has to be listed, and the globe finds repositories by their citations alone. The registry is the one thing citations cannot give: being found from a project that cites nothing of yours, and the reverse direction, who cites you. It is an invitation by pull request, not a requirement, and the workflow's check (the export the repository's `.keep-the-why` names must name that repository) keeps a listing honest. Ten projects to start with, all the maintainer's; the first outside project with a published export was found the same day (a user's CLI), which is what made the list more than a demo.

**Consequence (2026-10-01, maintainer decision):** the registry lists repositories, not exports. `registry/projects.txt` holds canonical URLs; the build reads each `.keep-the-why` at `HEAD` and follows `dashboard-state` — the way the dashboard's public mode starts from a canonical. A listed state URL went stale the moment an owner moved the export, and the check had to compare two URLs; a canonical stays right, and the check is that the export names its repository. A family is listed by its root: its `children` block brings the rest. Changed an hour after the first version went out, before anyone had listed by the old form.

**Consequence (2026-10-02, maintainer review, dashboard 0.6.9):** the hops count from what the graph shows. The graph already draws the friends, so with *1 hop* as the default the first wave sat one step further out than its label, and *off* hid friends and family the graph had shown a moment before. *0 hops* is now the default and equals the graph view; a wave is always one step beyond what is drawn, and the globe no longer has a mode that shows less than the graph — hiding friends or family is their own switches' job.

**Consequence (2026-10-03, maintainer decision):** the index is a build artifact, no longer a committed file. Since main has been protected by a ruleset (pull requests with required checks, 2026-09-07), the workflow's push of a rebuilt index was rejected whenever the index changed — unnoticed while registry pull requests carried a hand-built index along, visible when the first outside pull request (#596) was merged without one. The docs workflow now runs `tools/registry/build.py --publish` before `mkdocs build`, on every deploy and weekly, and reads the published index as the previous state for the 30-day grace; a line that cannot be listed is left out with a warning instead of failing the site. The registry workflow only checks pull requests. Rejected: a ruleset bypass for the Actions bot — it would open the protected branch to a bot for one generated file. In the same change `registry/projects.txt` is kept in A–Z order, enforced by the check, so concurrent additions land in different places.

**Consequence (2026-10-06, maintainer decision, dashboard 0.7.2):** the 🌐 moved from the end of the status bar to a button left of the search. Placed as an easter egg it went unnoticed, and people who arrive from a post should find the globe. The easter-egg placement was given up for that.

**Consequence (2026-10-07):** right of the search now, between the field and the theme button — maintainer request after seeing it on the left for a day.

**Rejected alternative:** a page of its own for the globe, without thoughts and side pane. Rejected — a second legend, a second control bar and a second thoughts logic for the same graph; thoughts across three repositories are the interesting part, and the reader wants to walk on from the globe. The globe is the graph view with the side pane folded away.

**Rejected alternative:** a browser `confirm` per wave. Rejected for the list — see the reason.

**Consequence:** `GLOBE.extra` beside `CHAIN.extra`, the units marked with their hop; `loadFriend` skips the live lookup when no Id is cited (a registry entry cites nothing); `tools/registry/build.py` is standard library only, like the linter, and the workflow is the only writer of `docs/registry/index.json`.

## An export's state.json carries no bodies; they sit beside it in state.body.json

**Id:** 1b401b10-9a0d-4828-afaa-a346a1faedf2
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision, 2026-10-01 — "leave the head in state.json: either it is whole, or from version X on state.body.json lies beside it; that keeps us compatible" — after the assisting agent measured the file and proposed a separate head file
**Revisit when:** a reader of foreign exports needs the bodies for something other than showing an entry (full-text search across the globe), or the git blocks grow to where they are the next three quarters
**See:** dashboard.md#the-globe-loads-the-web-in-waves-each-asked-for-with-its-count-the-registry-is-an-invitation-never-a-requirement — 64f88b63-67b6-4a87-990c-e0258e7b63b0 — as of 2026-10-01

Since dashboard 0.6.0 an export's `state.json` carries everything but the entries' bodies — project, topics, every entry's header fields, `see`, `superseded_by`, its git block — and names `state.body.json` beside it, which holds the bodies by entry id. The page fetches that file when it shows an entry of that project: on a move there, for the merged family's search and lists, in the thought reader; never for a graph. The export's own `index.html` still embeds the full state. `dashboard-state` keeps naming `state.json`.

**Reason:** measured on this repository's export the day the globe arrived: 520 KB, of which 383 KB are bodies and 37 KB git blocks; what the graph, the globe, the registry and a friend's hub need is the remaining tenth. Loading foreign projects by the dozen — the globe's waves, the registry's list, a family of eight beside the project — was about to be priced by prose nobody reads at that moment. Taking the bodies out moves the loading threshold the maintainer wanted to find by roughly a factor of three on this repository and more on prose-heavy ones, and the git blocks stay in, because thoughts across projects date their steps by them.

**Consequence (2026-10-07):** the search's *friends* scope fetches each friend's `state.body.json` the way the merged family's search does — a person asked for that search, and only the friends of this project (or of the family, under *family & friends*) are read. The globe stays unsearched; this is not the full-text search across it the *Revisit when* names.

**Rejected alternative:** a second, lean file (`state.head.json`) beside an unchanged `state.json`, derived by convention. The assisting agent's first proposal; rejected by the maintainer for the simpler compatibility story: one `state.json` that is either whole (older exports, no `bodies` field) or lean and naming its bodies — a reader checks one field, and nothing has to guess a second URL. The one cost: a dashboard older than 0.6.0 reading a 0.6.0 export as a friend shows that friend's entries without text, since it does not know the field. Accepted — the friend's own page is unaffected, and the dashboards in use are the maintainer's.

**Consequence:** `state-json` 2; `split_bodies()` in `export.py`; `ensureBodies()` in the page, keyed on the `bodies` field and the state's own URL; the status bar's list counts a bodies file as its own kind and marks a lean state. The registry's check reads `state.json` as before — it needs nothing from the bodies.

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

## A walk to a friend moves the centre in place, and the page keeps the path in memory

**Id:** 4b41fbe0-d50c-4209-9028-14b8a5ad0a48
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-29
**Revisit when:** a path is asked to survive a reload or to be shared, or walks get long enough that the states held in memory become a cost
**See:** dashboard.md#friends--repositories-cited-outside-the-family--load-into-the-graph-linked-and-never-merged — b1b36585-edb2-416c-95fe-126ed4b4b788 — as of 2026-09-29

Going to a friend — its name in the legend, its hub's entries, a link to it anywhere on the page — changes the page's centre in place, without a reload: the friend's state is already loaded, the address becomes that project's (`?public=` or `?project=`, a link like any other), and the project left joins the *path*. The path is the projects walked through to get here, kept in memory for this page: a bar above every view (an overlay on the graph) names them in order, each a way back that shortens the path; the graph shows them as numbered hubs with a dotted ring, joined in the order walked, with the entries that link them. Back and forward walk it in place. *Discard* clears it, *in graph* hides it, *path* in the graph turns keeping it off (kept per browser, on by default). A reload, or a link opened anew, starts without a path.

**Reason:** one hop is enough to see from a project, and moving the centre is how the web is walked (the friends entry); the path is what makes a walk readable afterwards — how the reader got from A to Y. The states are already in memory once a friend is loaded, so a move needs no fetch and no reload, and keeping what was walked costs nothing. A link leads to an entry, not to a walk: the path belongs to the person walking, not to the address.

**Consequence (2026-10-01, maintainer decision, dashboard 0.4.3):** *all their entries* opens a path step too. A step was drawn with the entries that link it, always — a reader who had walked from Keep the Why to the suite, switched on *all their entries* and saw picows open up but not Keep the Why read that as a bug, and it is one in effect: in the graph a step is a hub with a number and a dotted ring, otherwise a neighbour like a friend, and the checkbox promises every entry of every neighbour. The other reading — keep a step lean because the reader has just been there — was weaker: whoever opens the context wants the whole neighbour, whichever way it came into the graph. The path has its own *all their entries* beside its switch, as friends and the family have theirs. That switch hides and shows the path (0.4.4); it had turned *keeping* off, which discarded the walk — a filter that destroys what it filters is not a filter, and the path bar's *discard* already does the forgetting.

**Consequence (2026-10-13, maintainer decision, dashboard 0.11.8):** a move between members of the project's own family is not a step of the path — by the project menu, a family hub or a link alike. The family is drawn as one, its parent once, so moving inside it added steps that only repeated what the graph already shows; the path stays as it is and grows only when the walk leaves the family. "Own family" is what the page knows of it: the declared parent and children and every tree it has loaded.

**Rejected alternative:** the path in the URL (`&trail=A,B,D`), shareable and surviving a reload. Rejected by the maintainer — a link leads to an entry; a shared link that loaded a stranger's walk would fetch other hosts nobody asked for.

**Rejected alternative:** keep the path across a reload in the tab's session storage. Rejected by the maintainer: a reload starts fresh, which is the simplest thing to understand.

**Rejected alternative:** keep the page loads (every move a new page) and carry the path along. Rejected — every step would load again what is already in memory, and the path would have to be rebuilt from storage on each page.

## An export's project menu walks the family in place, along the path

**Id:** 78c4870e-24bd-4b68-b0b8-e13232133d66
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-10-13; pull request #704
**See:** dashboard.md#a-walk-to-a-friend-moves-the-centre-in-place-and-the-page-keeps-the-path-in-memory — 4b41fbe0-d50c-4209-9028-14b8a5ad0a48 — as of 2026-10-13

An export of a family member has a project menu where the bare project id stood: the family's tree from the members' published exports, ordered as the Family view orders it. Choosing a member moves the centre in place, as a click on its hub in the graph does — nothing reloads. A member without a published export is listed and cannot be chosen.

**Reason:** the path is how the page is walked; a second way of going to a member that bypassed it would leave two kinds of move on one page, one of them without a way back. The member's state is already in memory for the graph beside the overview, so the move costs no fetch.

**Rejected alternative:** the menu as a link to the member's own export page, a new page on its own site. The assisting agent's proposal, rejected by the maintainer for consistency with the path — it would reload what is already loaded and drop the walk.

**Consequence (2026-10-13, maintainer decision, dashboard 0.11.8):** a choice in the menu no longer adds a path step — see the path entry's consequence of the same day: a move inside the family is not a step of the path.

## A fork checkout is shown from the remotes and `canonical`, not from the host's API

**Id:** 5230467d-0d33-478a-acdb-2c9226c4f578
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-10-01 ("if a repo is a fork, show it and the upstream URL"); the two-signal form was the assisting agent's proposal, accepted
**Revisit when:** a mirror is mistaken for a fork often enough to matter, or the page gains a host lookup it makes without a click anyway

The page marks a checkout as a fork — *fork of host/owner/repo*, linking the repository — from two signals the machine already has: an `upstream` remote, which is how `gh repo fork` and most contributor guides lay a fork checkout out and how the skill reads one (`origin` the fork, `upstream` the published repository); or an `origin` that differs, as a normalized `host/path`, from the project's `canonical` in `.keep-the-why`. The tooltip names the signal. The state carries `git.upstream` and `git.fork = {of, by}`.

**Reason:** both signals are local and cost nothing, and together they cover the two situations that occur — a contributor's clone with `upstream` set, and a fork's own CI export where there is no `upstream` remote but `canonical` still names the published repository (the proposal preview before a merge). The second is the one that needed it most: an export from a fork looked exactly like the project's own.

**Rejected alternative:** ask the host — GitHub's repository API says `fork: true` and names `parent`. Authoritative, but one request per project at every build, and the page asks a host only on a click (the author lookup). The API can be added as an opt-in confirmation later; the local signals stay the default.

**Consequence:** a mirror — `origin` points at a copy, `canonical` at the original — is marked a fork by the second signal; the tooltip says "fork or mirror" for that one. Comparison is case-insensitive on the normalized form, so `git@github.com:Acme/widget.git` and `https://github.com/acme/widget/` are one repository.

## An export carries its title, description and preview image in the static head, the repository in the title

**Id:** f1798af9-40d1-493a-9edc-6fb29b97e11c
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-10-05, after a search result for `/dashboard/live/` showed the bare id as title and a random sentence from an entry body as snippet; the static-head form was the assisting agent's proposal, accepted. Revised 2026-10-20 after a shared link previewed as *… · oliver-zehentleitner---lasteverLM* beside a cropped icon; the image is the maintainer's choice
**Revisit when:** search engines or link previews show the exports badly again, or the registry lists so many projects that the description needs more than the repository and its counts

An exported page writes `<title>Keep the Why Dashboard · <owner/repo></title>`, a `description`, `og:title` / `og:description`, `og:image` and the `twitter:` card into its head at export time. `owner/repo` comes from `canonical`, else the remote, else the project's id; the description names it too, with the entry and topic counts and what the entries are. The script sets the same title. The image is `https://keepthewhy.com/assets/logo-crop-safe.png`, the card the docs site uses, the same for every export.

**Reason:** the exports are meant to be found — every published dashboard is a public showcase of a project's reasoning — and there will be many of them, so the title has to say which project it is. A crawler reading the static head gets the right text without running the script; before, the head said only *Keep the Why — dashboard* and had no description, so the search result took the script-set id as title and picked a sentence out of the embedded state. The id is a file-safe form (`owner---repo`), readable to the machine and not to the person the link is shared with. A preview needs an absolute image URL, which an export does not know about itself; the site's card is absolute already and was made to be cropped by previews.

**Rejected alternative:** `noindex` on the export, leaving the docs page `/dashboard/` as the entry point. Rejected: the exports are what should show up in search, not be hidden from it.

**Rejected alternative:** an image per export, with the project's own numbers, at the URL derived from `dashboard-state`. Rejected: rendering a PNG would make an image library a dependency of the export, an export without `dashboard-state` would still have none, and the preview's job is to say what kind of page it is — the title and description already say which project.

## A repository's platform is read from its URL alone, its mark drawn from paths the page carries

**Id:** 26af2206-a51f-41c3-bed9-cc700ff22a2f
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request and review, 2026-10-05; the inline marks and "no mark for an unknown host" were the assisting agent's proposal, accepted
**See:** dashboard.md#the-update-check-is-the-servers-one-network-call-the-page-asks-other-hosts-only-for-what-a-person-opens — 5b7a6c2d-8218-4987-b912-0fe7bb15cc1a — as of 2026-10-05
**Revisit when:** a self-hosted instance appears often enough that its missing mark is felt, or the page starts loading anything from the platforms anyway

Hubs and repository links show the platform's mark — GitHub, GitLab, Codeberg, Bitbucket, Gitea, Forgejo — taken from the host name of `canonical` or the remote through one table, `HOSTS` in `lib.js`. The marks are SVG paths in that table, drawn in the text colour on the canvas and inline in the DOM. A host no row matches gets no mark. New platforms come in as a row, by pull request.

**Reason:** the page asks other hosts only for what a person opens (the See line above). Fetching each platform's favicon would ask one host per project on every load, and would tell those hosts who looks at which dashboard. Paths the page carries cost a few kilobytes and work in a static export offline.

**Rejected alternative:** a `host-kind` field in `.keep-the-why` so a self-hosted instance could name its platform. Rejected: a schema change, with spec, linter and migration, for an icon, while no known project sits on a self-hosted instance; the URL decides, and where it cannot, nothing is shown.

**Rejected alternative:** a generic mark for unknown hosts. Rejected: it says nothing the name beside it does not, and "no mark" already reads as "platform unknown".

## The registry build derives backlinks from the exports it already loads; no links file in the export

**Id:** d8791f26-64b7-47df-9a2c-188f55562ae2
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer proposal and review, 2026-10-05; deriving from the state, keying by canonical and the bounds were the assisting agent's proposals, accepted
**See:** dashboard.md#the-globe-loads-the-web-in-waves-each-asked-for-with-its-count-the-registry-is-an-invitation-never-a-requirement — 64f88b63-67b6-4a87-990c-e0258e7b63b0 — as of 2026-10-05
**Revisit when:** the registry grows past what one build can fetch, or a project asks for backlinks it can see in the dashboard without the registry

`tools/registry/build.py` reads the cross-project `See` and `Superseded by` lines of every export it loads — the listed lines and the family members their `children` blocks name — and writes `backlinks/<host>/<owner>/<repo>.json` per cited repository into the site, with `cited_by` counts in the index. Files, citations and keys are sorted. Like the index, it is a build artifact, never committed.

**Reason:** the build already fetches every listed `state.json` to check it, and the state carries the citations. A second file per export would be another format to version and keep in step, and every project would have to export it before the registry could count it. Files are keyed by the repository URL, not the project id: the build has checked the URL (the export names its repository, the repository's `.keep-the-why` names the export), and anyone can write any id. Repositories outside the registry get a file too, so one that publishes later finds its backlinks waiting.

**Rejected alternative:** a `state.links.json` written by every dashboard export, read by the registry. Rejected for the reasons above; its one advantage, a smaller download, does not matter at the registry's size.

**Consequence:** the target's path comes from a foreign export, so it is accepted only as three plain segments under `backlinks/` (a nested GitLab group gets no file), and one export counts with at most 500 citations — without both bounds a listed project could write outside the directory or fill the site. Where the cited repository was loaded in the same build, `resolved` says whether the cited Id exists; elsewhere the field is left out rather than guessed. Citations from an export in its 30-day grace are missing from that build — the build keeps no state between runs.

## "Cited by" is fetched from the registry on a click, never remembered, and drawn the way friends are

**Id:** 707ff0bf-6e58-4f8b-a0ec-b634f7ce98ea
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer review, 2026-10-05 ("cited by" as a filter, loaded on the click; the agent's proposal, accepted)
**See:** dashboard.md#the-registry-build-derives-backlinks-from-the-exports-it-already-loads-no-links-file-in-the-export — d8791f26-64b7-47df-9a2c-188f55562ae2 — as of 2026-10-05
**Revisit when:** the backlink files move out of the registry, or the page gains a way to know who cites it without asking a host

The graph's *cited by* switch fetches the registry's backlink file for this repository when it is checked, and loads the repositories in it through the friends' path: the same unit, the same drawing, the citing entries joined to the cited ones by the See and Superseded by the layer already draws both ways. The state is reset when the centre moves and is not stored in the browser.

**Reason:** loaded automatically, every dashboard would ask keepthewhy.com on every open: a central dependency for a page that otherwise needs nothing, and a record of who looks at which dashboard. The page asks other hosts only for what a person opens; a remembered switch would break that on the next reload. Drawing citing repositories as friends reuses what works — loading, families, failures in the Friends view — instead of a second mechanism.

**Rejected alternative:** loading the backlinks with the friends, on by default. Rejected for the request on every open. A separate drawing for citing repositories was not needed: the hub list and legend say *cites this project*, and the arrow of the See already points from the citing entry to the cited one.

**Consequence:** only citations of Ids this export holds are drawn — a repository's file covers every project in it, and a cited entry may be gone — the rest is counted beside the switch. A 404 for the file means nothing in the registry cites the repository, not a failure.

## Without JavaScript an export lists its entries as links to the host; the Keep the Why note uses the page's own logo

**Id:** 80a781e1-ab6e-4a51-83cf-e31382659bcf
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer report and request, 2026-10-05 ("with JavaScript disabled the dashboard is completely empty"; a note on Keep the Why with logo and links); the static list in the export was the assisting agent's proposal, accepted
**Revisit when:** the page gains a rendering that works without the script anyway, or the list makes exports noticeably larger

The page hides its app shell under `<noscript>` and shows a notice instead. In an export, the notice is followed by the project's topics and entries — title, status, evidence — each linked to its file and heading on the host, then a short paragraph on Keep the Why with the wordmark and links to keepthewhy.com. Bodies are left out. The local server shows the notice and the paragraph alone.

**Reason:** the page was blank without JavaScript — for a reader who disabled it, a text browser, a screen reader, and a crawler that does not run scripts, which also left the exports' titles and description from the static head as the only thing to index. The export already has the state in Python, so the list costs a few kilobytes and no script; the Markdown itself is one click away on the host.

**Rejected alternative:** the logo as an image from keepthewhy.com. Rejected: `<noscript>` content loads like any page content, so every view without JavaScript would ask keepthewhy.com — the page asks other hosts only for what a person opens. The wordmark the page already inlines is used instead.

**Rejected alternative:** the entry bodies in the static list. Rejected for size; the export already embeds the state once for the script.

**Consequence:** the host's URL forms are written twice, in `lib.js` (`hostFileLink`) and in `export.py` (`host_file_link`). Heading anchors in the static list follow GitHub's rule (`hostAnchor` in `lib.js`, since 0.6.16 also behind *open on the host*), not the dashboard's entry id, which differs for titles with an apostrophe or a dot.

## A GitLab project is read through the repository files API, not its raw path

**Id:** b21b37fe-785e-480a-9b97-66b41974a672
**Type:** decision
**Type:** workaround
**Status:** active
**Evidence:** confirmed
**Source:** listing keep-the-why-demo, the first repository on GitLab (PR #640), and a probe from a GitHub runner, 2026-10-06
**Revisit when:** gitlab.com sends Access-Control-Allow-Origin on its raw path, or the files API starts limiting the registry's or a reader's requests
**See:** dashboard.md#the-registry-build-derives-backlinks-from-the-exports-it-already-loads-no-links-file-in-the-export — d8791f26-64b7-47df-9a2c-188f55562ae2 — as of 2026-10-06

For a canonical on a `gitlab.` host, the registry build (`raw_url`) and the page (`rawFileUrl` in `lib.js`) read `.keep-the-why` at `<host>/api/v4/projects/<path, URL-encoded>/repository/files/<file, URL-encoded>/raw?ref=HEAD`, not at `<canonical>/-/raw/HEAD/`. The registry build also retries a request twice, after 2 and 6 seconds, on 403, 429 and 5xx.

**Reason:** gitlab.com serves raw files without `Access-Control-Allow-Origin`, so a dashboard on another site (the globe, public mode) could not read a GitLab project's `.keep-the-why`, and the registry listed it with `cors: false`. The files API returns the same file with `Access-Control-Allow-Origin: *`. The retry is for Cloudflare in front of gitlab.com: the first registry check of the demo got 403 from one GitHub runner; a re-run, and a probe from another runner, got 200 for the same URL.

**Rejected alternative:** keep the raw path and accept `cors: false` for GitLab. GitLab projects would be listed but invisible to every browser-side reader.

**Rejected alternative:** a copy of `.keep-the-why` in the published export, read from Pages, which does send CORS. That changes what every listed project must publish, on every host, to work around one host's headers.

## The timeline has a clock: a playhead the stage and every graph follow

**Id:** 6856784a-2ad6-4703-839f-ccc3c63830ae
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-10-08 ("a slider for the date right under the bar chart, the entries built up in a 3D space from the real data of the repository, with a play button, so one sees the development including the thoughts between the entries; single thought chains with their branches, or all")
**See:** dashboard.md#the-graph-turns-very-slowly-in-its-plane — 5f097cf0-af55-47cf-8b23-4125855a8b1a — as of 2026-10-08
**Revisit when:** a project has so many topics that the lanes no longer fit a screen, or the stage is asked to show something the page does not already know (an entry's body as it was on that day, for instance)

The Timeline view owns a clock: a slider over every day from the first entry to today, a play button with a speed (a day, a week, a month, a season per second), ← → and space as keys, and the day in the URL (`#timeline/<day>`) so it can be linked. The day is the page's: while the timeline is open, every graph on the page — the side pane's project graph above all — shows only the entries that existed on that day, with the status they had then, and only the `See` and `Superseded by` lines written by then. A friend's or a family member's entries follow the clock like our own — their exports carry the same Git days — and stand on the stage as cards, so a thought that crosses repositories lights every step — by default only the foreign entries a chain of links joins to this project's, since a friend brought in whole buries the picture; a switch shows all or none; the clock's first day is the earliest entry on the page, theirs included. Leaving the timeline returns the page to today.

Under the text, the bars, the slider and the card sits the stage (the order changed twice on the maintainer's rounds: the stage is what the page is about, the bars are a footnote to it): a perspective view of the same entries, drawn by hand on a canvas. Time runs into the depth — the day shown is the near plane, what came before recedes behind it, what a day brings arrives at the front — an entry a card standing where its node stands in the graph beside — the positions copied while the graph settles and kept from then on, since following its slow turn walked the cards around the stage without end — so the eye finds a node here where it finds it there; a switch on the stage puts the cards in a lane per topic across the width on two shelves instead. A card's shape and colour are its Type — purple with a diamond for a decision, blue with a band across the top for a constraint, amber with a folded corner and a dashed edge for a workaround, red with a striped band for an incident — so the kinds read apart at a glance, before any title does; the fill is the Evidence (solid confirmed, hatched inferred, empty with a `?` unknown) and the edge the Status (grey and dashed superseded, a ring for open, needs-review and pending). This differs from the graph, which colours by Evidence: on the stage the question is what kind of thing each card is, in the graph how far each node can be trusted; the legend under the stage says which is which. Pointing at a card lights its node in the graph beside; a click opens it in the card above the stage, which otherwise shows the entry that appeared last by the day shown — so playing the days reads like a feed of what arrived, and a click holds one. The pane beside the timeline is laid out as beside the graph: the thoughts list first — pointing at a chain lights it on the stage and in the graph alike, the rest fades — and under it a small project graph that follows the clock, the entry page's small graph rather than the pane-filling one; every `See` and `Superseded by` written by then is a line between cards, a lit chain's standing out — a switch that hid lines was dropped on the maintainer's call: the lines are the point.

**Reason:** the product's claim is that the why is in Git, with a history. The timeline was the one view that only counted that history; this is the view that shows it, from data the state already carries — the day a heading first appeared, the status changes, the `as of` day of every `See`, the day of every supersession. Depth is logarithmic in days and scaled to the project's span — the oldest entry stands at about two fifths of full size whether the project is three months or three years old — so the last days spread out where the eye is while the past fills the stage instead of gathering at the horizon. A topic's name stands at the centre of its cards on screen, on a pill as in the graph: the cards recede with the days, a name on the near plane stood nowhere near them. The graph stays flat, as the entry on its slow turn decided: on the stage the third dimension is the data — time — not decoration, and the graph beside it keeps its layout so the eye can follow a node from one to the other.

**Rejected alternative:** a 3D library for the stage. Rejected: the page is plain JavaScript without a build step or a CDN (the entry above), and a perspective projection of cards is three numbers per point.

**Rejected alternative:** a view of its own. Rejected by the maintainer's request — the stage belongs on the Timeline page, with the slider and the bars, because they count the same days the stage shows.

**Consequence (2026-10-08, maintainer feedback on the first draft):** the pane-filling project graph beside the timeline was judged to add little; the thoughts list took its place at the top, with the small graph under it, and the cards took a shape per Type — then, on the second draft, a colour per Type as well, with Evidence moved into the fill. The small graph at the end of a long pane (an entry, the timeline) had scrolled out of view; it now stays at the pane's bottom edge while the rest scrolls under it. On the third draft the panel that opened over the stage moved beside the bar chart, as a card that shows the latest entry by the day shown until one is clicked; the band that marked the day's plane on the stage went — without the room's other edges it read as nothing — and the floor lines alone carry the depth; an hour per second joined the speeds. On the fourth round the lanes per topic were questioned — a project with forty topics gets lanes thirty pixels wide, and a topic is a file, an accidental unit — and the cards took their place from the graph's layout instead, the lanes kept behind a switch for the comparison; whichever loses goes.

**Rejected alternative:** a switch for the lines between cards (all, a lit chain's only, none). Built first, dropped by the maintainer: every line is drawn, the lit chain's stand out, the rest fade — the lines are what the stage is for.

**Rejected alternative:** squeezing the months in which nothing happened while playing. Not taken, the implementer's choice: the days pass at one pace so a pause reads as a pause, and the speed setting covers the rest. The maintainer was asked and has not ruled on it.

**Consequence (2026-10-18, maintainer report):** a day was the clock's finest step — the export carried Git's day alone — so the hour speeds stood still for a day and then showed it at once, and a project built in a few days played in a few jumps. The export now carries the moment beside the day (`time`, the author time to the second, UTC), and with entries spanning two weeks or less the clock moves by the hour, labelled in the reader's time zone; a longer span, and an export without `time`, keep the days.

**Rejected alternative:** the committer time. Rejected: a rebase or a cherry-pick rewrites it to when the commit landed, the author time keeps when the entry was written. A squash merge gives every entry of the pull request one moment either way — coarser, not wrong, and nothing in the repository knows better.

## The dashboard export is published under `keep-the-why-dashboard/`, not `dashboard/live/`

**Id:** 581c6c1f-a1da-477a-9172-4d1273ba48b1
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer decision, 2026-10-12, while setting the dashboard up on a third project's site
**Revisit when:** the export writes more than one page, or a host serves a reserved path by that name

The path the skill gives a project's dashboard export — in the badge, in `dashboard-state`, in the snippets for a docs build, GitHub Pages and GitLab Pages — is `<site>/keep-the-why-dashboard/`. keepthewhy.com keeps its own export on `/dashboard/live/`.

**Reason:** on another project's site `dashboard/live/` is a generic name: it can collide with a dashboard of the project's own, and it says nothing about what is there. `keep-the-why-dashboard/` says it, and the name in the URL tells a reader what produced the page before it opens. On keepthewhy.com the context is the site itself, so the generic path is fine there and nothing has to move.

**Rejected alternative:** change every published export, keepthewhy.com's and the few projects that already carry `/dashboard/live/`, with a migration step. Rejected: the old path works, `dashboard-state` and the badge name whatever path a project uses and nothing reads the old one by name; whoever wants the new path says one sentence to their agent. The default changed, the deployed sites were left alone.

## `context/README.md` ends on a link to the published dashboard, written by the agent from `dashboard-state`

**Id:** 8fec091b-b010-45ec-b2d6-e98369d7ef44
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-10-21; the URL's source and the migration step were the assisting agent's proposal, accepted
**Revisit when:** the export moves away from `state.json` beside `index.html`, or projects report the line overwriting a README of their own

When a project publishes its dashboard, the last line of `context/README.md` reads `Start with the [context index](index.md), or browse it all in the [dashboard](<url>).` The agent writes it in the same change that writes `dashboard-state` — at setup, or when the dashboard is published later — and `<url>` is `dashboard-state` without its `state.json`. An existing project gets it as a one-pass migration (0.20.3); a README that does not end on the template's line is left alone.

**Reason:** the folder's README is what a reader landing in `context/` on the code host sees first, and the dashboard is the readable way into the same entries — the graph, the history, what is open. `dashboard-state` is the one place that already says where the export lives, so the link cannot drift from it and nothing is guessed from the host.

**Rejected alternative:** a linter warning when `dashboard-state` is set and the README's link is missing or points elsewhere. Rejected: the README is free text the project may rewrite; the linter checks the structure of `context/` entries and `.keep-the-why`, and a warning would make the README a checked file for one line.

## A family badge only when every member lives in the root's repository

**Id:** ce8674d0-f680-487d-9af7-63c9b6a99c5c
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** maintainer request, 2026-10-23 (a family badge where all members sit in one repository, and only there); which export writes it, its file names and the nested-repository check are the assisting agent's design, stated for review in the pull request
**Revisit when:** an export can read a member's published `state.json` at build time, or a family root asks for a badge although a member lives elsewhere

The export of a family root — a `.keep-the-why` with a children block and no `parent` — writes `badge-family.svg` and `badge-family-flat.svg` beside its own two badges, with the entries and open entries of the root and every member below it, read from the same checkout, and the number of projects. It does so only when every member the children blocks name, level by level, sits in the root's Git repository: a path location inside the same top level, with a `.keep-the-why` there and no repository of its own. A member named by URL, outside the top level, missing on disk or in a nested repository or submodule keeps the badges from being written; the state names it with the reason (`project.family_badge.missing`), and the badge page says so instead of offering a badge.

**Reason:** the numbers of a member in another repository are not on the disk when the root is exported, so a total would be missing that member. A wrong number on a README badge reads as a fact; leaving the badge out does not. The root's export writes it because the root is the family's one export that every member reaches up to; a member further down would show only its own subtree under the family's name. A nested repository counts as another repository because its history and its own export are separate from the root's, even when its files are in the tree.

**Rejected alternative:** add up the members' published `state.json` files at export time. Rejected for now: the export makes no network requests, and the members' pages may not be published yet when the root's build runs — in a mono repository every export usually comes out of the same Pages build.

## Owners in the graph: the address's owner, every project counted, a family hanging by its root

**Id:** 69cc754e-5d85-4f19-8941-c11fab846483
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** maintainer request and review of a running demo, 2026-10-23 (grouping around the owner as a switch; the family's shape and the names without the owner came from the review); the derivation of the owner and the counting were the assisting agent's proposal, accepted as demoed; the reasons given for those two are the agent's, the choices themselves are confirmed
**Revisit when:** a host's addresses stop putting the owner before the repository's name, or readers ask for the owner nodes of a large GitLab group to merge

*owners* in the graph's bar ties the projects that share an owner to one node for that owner. The owner is everything in the repository's address before its name: `github.com/acme` for `github.com/acme/widget`, and on GitLab the whole group path, `gitlab.com/acme/tools` for `gitlab.com/acme/tools/cli`. An owner gets a node only with more than one project in the graph, and every hub counts as a project. A family keeps its shape: only its root hangs on the owner; the members below it hang on their parents as before. While the switch is on, a project on its owner's node drops the owner from its name. Off by default, kept per browser like the other switches in the bar.

**Reason:** the address is the one place every project in the graph names its owner, whether it is the centre, a family member, a friend or a globe wave, so nothing has to be fetched. A GitLab subgroup is an owner in its own right, with its own members and its own page. A hub stands for a project wherever else the graph counts, so the members of a family in one repository count here too. The owner follows the family's structure instead of running past it: the root alone carries the family to its owner, as the review of the demo asked.

**Rejected alternative:** the top-level group only on GitLab — it merges subgroups that are organised apart on the host, and the node's page would not be the subgroup's. Counting distinct repositories instead of projects — a family in one repository would then be one project and get no owner node, though the graph draws it as several. Wiring the owner to every member of a family — what the first demo did; rejected in its review in favour of the family's own structure.

## The page becomes a library a second host builds on: core, views and a host, Maity the first other host

**Id:** 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01
**Revisit when:** a second outside host asks for the views, or the views need something only one host can give
**See:** dashboard.md#the-page-is-plain-javascript--no-framework-no-build-step-no-cdn — df1af5b5-8180-49e2-bdeb-97bf4e4aa030 — as of 2026-11-01
**See:** dashboard.md#a-dashboard-exists-despite-the-no-dashboard-line-as-a-read-only-lens-that-stores-nothing — 55e36439-f311-48b9-9279-0197af4d5601 — as of 2026-11-01

Maity, the coordination hub for coding agents, is to show nearly everything the dashboard shows — Overview, Queues, Graph, Thoughts, Timeline, Authors, Search, entry and topic pages, Family and Friends — in its own look, and an update of the dashboard is to reach it without anyone porting it. The page is split into three layers. *Core* is pure: what `lib.js` holds today, plus the route grammar, the force layout without its canvas and a Markdown parser. *Views* are every page and panel, mounted into a container the host hands them, tied together by a shared scene (the day, the focus, the layout, the scope). They reach the outside only through four host interfaces: a data `provider`, `nav` for links and the history, `prefs` for settings, and `--ktw-*` CSS tokens for the look. The *host* is what remains of `app.js` for the dashboard — the shell, the live mode, the export, the Projects menu, the update check, the globe and the registry search — and Maity's own scripts on the other side. Maity vendors the view files from the published wheel at a pinned version and digest; an update arrives there as a pull request. The migration runs in small pull requests, each released on its own, with the dashboard looking the same after every one.

**Reason:** a view that fetches, writes the URL or keeps settings by itself works in one page only. Behind the interfaces the same files run in a page that may not fetch from other hosts (Maity's `default-src 'self'`), has a router of its own, and gets private projects through a server. Both hosts then run the same bytes, so a fix lands once. The globe and the registry search stay with the dashboard on the maintainer's call: they discover the public web of projects, and through a hub they would become fan-out requests on behalf of a session.

**Rejected alternative:** the published dashboard in an `<iframe>` — not Maity's look, navigation or sign-in, a CSP exception, and public exports only. Copying the views into Maity and restyling them — a fork, which is what the request rules out. An npm package or a CDN — neither side has a Node toolchain, and Maity's CSP forbids foreign script hosts. Release assets on GitHub — the releases page stays the skill's. Graph and timeline only — the first scope, widened by the maintainer.

**Consequence:** the page's modules become classic scripts on one namespace, because Maity's page also opens from `file://`, where browsers refuse module scripts; that revises the plain-JavaScript entry above and is recorded with the change that makes it. The views render text only, through the DOM, with a renderer for entry bodies that builds nodes instead of HTML strings, so neither host keeps an `innerHTML` sink.

## The refactoring is guarded by DOM snapshots of a frozen fixture, one per route

**Id:** c31d2d4a-abdd-4368-9601-e887718afa6e
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01; the fixture and the serialisation are the implementer's choices in the pull request that added the harness
**Revisit when:** the canvas views move to the DOM, or the state format changes so that the fixture has to be rebuilt
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

`dashboard/tests/web/snapshot.mjs` loads a page rendered from `tests/web/fixture/state.json` in jsdom, drives every route that renders without a network, and compares `#main` and `#details` of each — and the shell once — with the files in `tests/web/snapshots/`. Each one is an element tree, one node per line, attributes sorted. The clock stands at the fixture's day, the time zone is UTC, and `Math.random` is a seeded sequence. The fixture is an invented project, built by `fixture/make_fixture.py` as a Git history with fixed dates and authors, read by the dashboard's own state builder, then frozen. A pull request in the series keeps every snapshot identical, or names each changed snapshot with its reason. What a canvas draws is not in the DOM: a change there carries before-and-after screenshots instead. (Changed 2026-11-01: canvas traces took the screenshots' place — see the entry `135df818-879e-4f9c-a42b-303c2811b678`.)

**Reason:** the series moves almost all of `app.js` into other files. "Looks the same" has to be checked by a machine on every one of those pull requests, because a reviewer cannot hold 3800 lines in view. A frozen state keeps the snapshots still while this repository's own `context/`, the dashboard's version or the date changes; an export of the repository itself would move with every commit. One node per line makes a changed snapshot a readable diff.

**Rejected alternative:** an export of this repository's own `context/` as the fixture — it changes with every entry written. Pixel screenshots in a headless browser — a browser toolchain in CI and font rendering that differs between machines, for what the DOM already says. The serialised HTML as one string — a one-character change shows up as a changed line thousands of characters long.

## The page's library is classic scripts on one namespace; the page is otherwise still plain JavaScript without a build

**Id:** daab47f5-add1-4ba2-ae24-38162c43af90
**Type:** decision
**Type:** constraint
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01; the manifest's shape and the safety rules are the implementer's, in the pull request that made the change
**Revisit when:** browsers load module scripts from `file://`, or no host that vendors the library opens from the file system any more
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

The page's pure part, `lib.js`, became `ktw-core.js`: a classic script that puts its functions on `globalThis.KeepTheWhy.core` and nothing else on the global object. The views that follow it will be classic scripts of the same form. `app.js`, the dashboard's own host, stays an ES module and reads the namespace. `web/ktw-views.json` lists the library's files in load order, with `api`, the major version of what they offer, and `state`, the `state.json` major they read. The server writes their tags into `index.html` in place of a placeholder, the export inlines them in that order ahead of the module, and a host that vendors them reads the same list from the wheel. The files are plain names with a `ktw-` prefix in `web/`, because the server serves `/static/` by basename and the package ships `web/*`. A test holds every listed file to the rendering-safety rules a vendoring host enforces: no HTML sinks, no `eval`, no `html:` or `style=` attributes. Everything else of the superseded entry stands: no framework, no build step, no CDN, `--export` one file that works offline, `node --check` and jsdom in CI, `tsc --checkJs` over JSDoc as the typed fallback, D3 only vendored if ever.

**Reason:** Maity's page also opens from `file://`, where browsers refuse module scripts, and it vendors the dashboard's library rather than porting it. A classic script runs in both pages unchanged, while an ES module does not run in that one. The export no longer rewrites the library's text with a regular expression to drop `export`, because there is none to drop.

**Rejected alternative:** ES modules in the repository, plus a generated classic copy for other hosts. That is a build step, and the two pages would run different bytes. A `views/` subdirectory instead of the prefix was also rejected: the server, the package glob and the export would each have needed a change, where the prefix plus the manifest needs none.

## Bodies render to DOM nodes through the old renderer's own rules, run over markers instead of tags

**Id:** d06eb1b5-744a-4fc9-a87b-d72961e847a6
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01 (a DOM-built renderer with exactly the old subset; https-only links); the marker technique is the implementer's, in the pull request that made the change
**Revisit when:** the subset grows (tables, nested lists, images), or a body renders differently from how its host renders the same Markdown and someone asks for the host's behaviour
**See:** dashboard.md#the-pages-library-is-classic-scripts-on-one-namespace-the-page-is-otherwise-still-plain-javascript-without-a-build — daab47f5-add1-4ba2-ae24-38162c43af90 — as of 2026-11-01

`ktw-markdown.js` renders an entry's body, title and field values as DOM nodes; no HTML string is built anywhere on the page any more, and `el()` lost its `html` attribute. The inline rules are the ones the page used when it built HTML: the same regular expressions, in the same order — code, bold, the two italics, links, bare topic names — but run over the raw text, writing private-use characters where they wrote tags. The marked text is then read into a small tree, and the tree into elements. Reading it follows the HTML parser's rules for formatting elements, because the parser's repairs decided the old tree wherever tags crossed. An element still open when another closes is reopened after it (`**x `y** z`` gave bold and then a second code), and a link opened inside a link closes the outer one first, so the two are siblings. Blocks are parsed line by line as before. Two things changed on purpose: a link opens only for an `https://` target (an `http://` one keeps its text and no longer links), and an external link carries `rel="noopener noreferrer"`.

**Reason:** the views are to load unchanged in a host that forbids HTML sinks, and the renderer was the page's largest one. Running the old rules over markers keeps every quirk a body depends on: bold inside code, a bare name not linked inside bold, the link target ending at the first `)`. A parity test checked this against the old renderer, kept frozen in the tests, over 2,194 texts from fifteen real projects' exports and the fixture, with no difference. In CI it runs over the fixture, this repository's own export and a fixed set of crossed-tag edge inputs. Review found the two repair cases missing from the first version; the edge set was added with the fix.

**Rejected alternative:** a proper tokenizer that reads emphasis and links as CommonMark does. It would render some existing bodies differently, and the series promises a page that looks the same after every step. A third-party Markdown library plus a sanitiser was also rejected: its output is an HTML string, so it needs the very sink this removes.

## The page's data comes through one provider; a method the mode cannot answer is absent, and the shell's own requests stay beside it

**Id:** 4ec4240f-f651-4559-9067-8d3c966a9690
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01 (the provider's methods, optional but `state`, provenance on every result, meaning checks in the core); the per-mode `provider()`, the separate `HOST` and `loaded` as the monitor's input are the implementer's, in the pull requests that made the change; review found the first of them short of the proposal on provenance and on See resolution
**Revisit when:** a view needs data no provider method gives, or a second host implements the provider and finds a method shaped for this server only
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

Every request the page makes is in one block of `app.js`. `DASHBOARD` implements the provider the views will read: `state`, `subscribe`, `bodies`, `family`, `memberState`, `exportState`, `resolveEntry`, `authorProfile` and `backlinks`. `provider()` returns the methods the current mode can answer, and leaves out `subscribe`, `family`, `memberState` and `resolveEntry` outside the live server. A call site asks whether the method is there instead of asking which mode the page is in. `HOST` holds what only the dashboard's own shell asks for — the project menu, *forget*, the update check, the registry index for the globe and its search — and no view calls it. Every result says where it came from: `url`, and for a project `canonical`, `root` and `forkOf` as they apply. A failure is an `error` beside them, never a throw. The files read to make a result come back with it (`loaded`), and so do the files read and then refused (`failed`: a `.keep-the-why` without a `dashboard-state` line, an export that claims another repository). `provider()` hands both to the state monitor, the loaded ones first, because noting a file as loaded clears it from the failures; the methods themselves do not write to the monitor. Whether a published export is shown, as itself or as a fork, or refused, is decided in `ktw-core.js`, and so is how a `See` into another repository is resolved: the live server's project first, the published export after it (`resolveSee`). The request and the link stay with the host. Timeouts, size caps and CORS wording stay with the request. A textual test catches a request written outside the block or in the library's files. It is a net for regressions, not a proof: a call spelled indirectly would pass it.

**Reason:** another host answers the same questions in its own way — through a hub, with private members — and may not answer some of them at all. A view that asks for a method can run under any host, while a view that asks for the mode cannot. The shell's requests concern this server only, such as the machine's project list and a write to its mapping file, so they stay out of the interface a second host would have to implement. The meaning checks are the same for every host, and the core is where both hosts get them.

**Rejected alternative:** one provider object with every method always present, returning an error outside live mode. A feature would then have to try the method and read the failure before it knew whether to show itself, and a host could not say "never" apart from "not now". The shell's requests as optional provider methods were also rejected: that would advertise as part of the interface what only this server can do.

## A place is a route; the page's own address lives in one nav block, closed by a test

**Id:** 7ad72848-f138-4f0b-97c2-f6ecb047ceb1
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** the pull request that moved the routing behind `nav` (series PR 5, design proposal revision 3.1, §3); the click handling and the test are the implementer's choices
**Revisit when:** a host's router needs to see a click on a Markdown link as a move, or a view has to read the address for something that is not a place
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

The page's places are route objects (`{ view: "entry", uuid }`), and `KeepTheWhy.core.routes` parses and writes today's hash grammar. The dashboard's `nav` (`href`, `go`, `current`, `onChange`) and the host's own moves — following an address `nav.href` made, the walk to another centre with `pushState`, back and forward between centres, a reload — sit in one block of `app.js`. A test fails when `location.hash`, `history`, `hashchange` or `popstate` appear outside that block, or when a library file touches the page's address at all. A link to a place is built by `navLink`: a real anchor whose `href` comes from `nav.href`, in the same position among the attributes as before, so the DOM snapshots stay identical. A plain left click calls `nav.go`, while a modified click, a middle click or a link with a target is left to the browser. Links inside entry bodies (`ktw-markdown.js`) get their `href` from `nav.href` and no click handler.

**Reason:** "the views reach the address only through nav" has to stay true over the series' later pull requests. Those move code out of `app.js`, and a reviewer would otherwise have to search every move for a stray `location.hash`. A real anchor keeps a new tab, copying the address and screen readers working in every host. A click through `nav.go` gives a host whose router does not follow its own `href`s the move as a call. Markdown links stay plain: `nav.href` already gives the host's own address, and a click handler would mean changing the renderer's interface for a case no host has yet.

**Rejected alternative:** one click handler on the document that turns every hash link into `nav.go` — in another host it would also catch that host's own anchors. Leaving the views on hash strings and letting another host rewrite them — that host would have to know the dashboard's grammar, which the design rules out.

## Settings go through prefs by a short name; the dashboard keeps them as ktw-<name>, values unchanged

**Id:** 8bb5d9af-d814-4603-b787-92c7e5084dab
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** the pull request that moved the settings behind `prefs` (series PR 6, design proposal revision 3.1, §5); the short names and the guard test are the implementer's choices
**Revisit when:** a setting needs more than a string, or another host wants the dashboard's stored settings carried over
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

Every setting a reader makes — the graph's switches and labels, the pane widths, the thought length, the timeline's arrangement, the scope, the motion, the theme, the globe's introduction — is read and written through `prefs`, an object with `get(key, fallback)` and `set(key, value)`. The views name a setting by a short name (`"friends"`, `"side-graph"`) and store the same strings as before (`on`/`off`, `all`/`linked`, a number, a JSON object for the labels). The dashboard's `prefs` keeps each one in `localStorage` as `ktw-<name>`, the key it always had, so no one's settings are reset. A test fails when `localStorage` appears in `app.js` outside the prefs block, or when a library file uses any browser storage. The topic tree's open folders are not a setting: they stay in `sessionStorage` for the tab.

**Reason:** the prefix is where the host comes in. Each host keeps the settings under its own name (Maity under `maity.ktw.`), so the views must not carry the dashboard's `ktw-` in every key. Keeping the stored strings exactly as they were is what lets the dashboard switch to `prefs` without a migration. A blocked or full storage now reads as the fallback everywhere; before, the theme switch was the one place that read storage unguarded.

**Rejected alternative:** the full keys (`"ktw-friends"`) as the prefs names — another host would store `maity.ktw.ktw-friends` or have to strip the dashboard's prefix. Typed values (booleans, numbers) in the interface — every reader of an existing setting would then need converting code, for no gain the views can see.

## What the canvases draw is checked as a trace of drawing calls, not with screenshots

**Id:** 135df818-879e-4f9c-a42b-303c2811b678
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** the pull request that moved the graph's forces into `ktw-core.js` (2026-11-01). The plan's rule, before-and-after screenshots for a change to the graph or the stage, could not be followed where the work was done, and the trace was put in its place; the choice is the implementer's, and the review of that pull request is where it is examined
**Revisit when:** the graph or the stage leaves the canvas, or a change is meant to look different and a trace diff is too hard to read to judge it
**See:** dashboard.md#the-refactoring-is-guarded-by-dom-snapshots-of-a-frozen-fixture-one-per-route — c31d2d4a-abdd-4368-9601-e887718afa6e — as of 2026-11-01

`dashboard/tests/web/canvas-trace.mjs` opens the frozen fixture's page at `#graph` and at `#timeline`, each in a fresh jsdom with its canvas 800 × 500, the motion off, and the clock and `Math.random` held as in the DOM snapshots. It runs frames back to back until the layout has settled, then writes every call the canvases' contexts received in their last frame — method, arguments rounded to three decimals, property sets — into `tests/web/canvas-snapshots/`. CI compares, as it does the DOM snapshots.

**Reason:** a screenshot needs a browser, and the machine the series is built on cannot start one. A screenshot is also a judgement by eye: two images that look alike pass. The trace is exact. Moving the forces into the core was checked against it — 1,509 calls, identical — and a change to one damping constant changes it from the first edge drawn. One page per route because the graph keeps its positions across a move between views: a move made while it settles left it wherever the timing had got it to, and two runs drew differently.

**Rejected alternative:** before-and-after screenshots, the plan's rule (see above). Pixel diffs in a headless browser — the reason the DOM snapshots were chosen over them holds here too.

## The views share one scene: state, clock, focus, scope and layout, and the events that carry their changes

**Id:** 350c514d-f042-40a7-88fb-255307561f50
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01 (a scene for day, focus, hover, layout and scope with subscriptions, the stage's positions from it, a headless layout); the event names, `layoutSource` and the host keeping the clock's entry count are the implementer's, in the pull request that made the change
**Revisit when:** two views need to disagree about the day or the focus, or a view needs to know which other views are on the page
**See:** dashboard.md#the-page-becomes-a-library-a-second-host-builds-on-core-views-and-a-host-maity-the-first-other-host — 24e1ef21-ebf8-4d5b-ab63-c8ccbe82f7ab — as of 2026-11-01

`ktw-scene.js` makes the scene, one per page. It holds the state shown and the project's own (`state`, `self`), the clock's day, the entry in focus, the lit thought, the scope and the layout. A view subscribes to what it follows: `day` (with whether the set of entries shown changed), `focus`, `thought`, `spot` (a project pointed at outside the graph), `scope`, `layout` and `wake`. The page's globals `S`, `SELF`, `CLOCK`, `STEP_FOCUS`, `SCOPE` and the set of active graphs are gone. A graph subscribes when its canvas starts and lets go when the canvas leaves. Lighting a thought, pointing at a project and moving the clock reach every graph through the scene, instead of through a loop over a set the page kept.

The stage's positions come from the scene. When the host draws a graph beside the stage, that graph is the scene's `layoutSource`; it publishes its positions after each step, and the scene copies them while it settles and from then on only adds a node it does not know, the rule the stage kept before. The stage follows the scene's `layout` event until it has drawn the layout settled once. With no graph drawn — a narrow screen, where the side pane shows none, or a host that shows the stage alone — there is no source, and `layoutFor` settles the layout at once without a canvas (`settleLayout` in the core). The stage subscribes to the scene the way a graph does, and nothing reaches into the stage from outside to wake it.

**Reason:** a view in a library cannot reach into the page's globals or loop over the other views. Through the scene it hears what changed and does its own redraw, and a host that shows one view or five needs nothing else. The stage needs positions with or without a graph beside it, and the scene is the one place both cases meet. The canvas traces of the graph and the stage are identical before and after the change.

**Rejected alternative:** a registry of views that the scene calls by name (wake, relax). It would turn the scene back into the loop over the page's graphs, with a list to keep. Events in which a view decides what to do keep the scene free of drawing. Keeping the clock's entry count in the scene was also rejected: it is the page's measure of when a layout should settle again, so the host computes it and passes it on with the day.

## The graph view takes the scene, nav and prefs only; the page state it reads moved into the scene

**Id:** 3b9cacf9-4e62-48b7-943e-a1650e09f3ce
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design proposal (revision 3.1) agreed by the maintainer, 2026-11-01 (only host interfaces cross into a view); what moved into the scene, `nav.open`, the pane's composition staying with the host and the tests' scoped app are the implementer's, in the pull request that moved the graph
**Revisit when:** the graph's model builders (which projects, friends, family and path are in a graph) move into the library, or another view needs page state the scene does not carry
**See:** dashboard.md#the-views-share-one-scene-state-clock-focus-scope-and-layout-and-the-events-that-carry-their-changes — 350c514d-f042-40a7-88fb-255307561f50 — as of 2026-11-01

`web/ktw-graph.js` holds the graph view: `runGraph` with its drawing, pointing and dragging, the name placement, a thought lit, a project spotted, the small graph's own view, the motion and the names per group. `create({ scene, nav, prefs })` is all it is given. Two pieces of page state the graph read from the page's globals are now the scene's: the entry shown in the details (`selected`) and the sidebar's filter, whose matching moved into the core (`entryMatches`). A node's address is followed through `nav.open`, which joins `nav`'s interface. `miniGraph()`, which decides which graph the side pane shows and builds its switches, stays with the host, because it composes the host's graph builders; the canvas it puts there is the view's. The tests run `app.js` as a strict function rather than a global script (`tests/web/classic.mjs`), as a browser runs a module, so a library file that reached for one of its names fails in the test as it would in the browser.

**Reason:** a view that read the page's globals would run only on this page. With the filter and the selection in the scene, a host that has neither leaves them empty and the graph dims and marks nothing. The pane's composition is page logic — this dashboard's choice of graphs and switches — and it moves only when the builders it calls do. The test change closes a gap the series would otherwise hide: the tests inlined `app.js` as a classic script, and every one of its names was global to the library, which in a browser it is not.

**Rejected alternative:** passing the filter and the selection to the graph as callbacks. Those would be two more interfaces beside the four the proposal allows, for state that other views (lists, the stage) read as well. Moving `miniGraph()` with the view was also rejected: it would pull the graph builders, the friends and the family layers along, which is a later step.

