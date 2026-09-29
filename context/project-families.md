# Project families

A project that is larger than one repository, or a repository that holds
several: how the skill finds the project it is in, how instances are told
apart, and — in later releases — how instances name each other. The series
answers [#450](https://github.com/oliver-zehentleitner/keep-the-why/issues/450)
(cross-repository rationale) in steps; this file records the decisions as
each step lands. What the code cannot say is why the boundaries were drawn
where they are.

## The project is the nearest `.keep-the-why` walking up, not the working directory and not the Git toplevel

**Id:** 81263e8a-ee54-41e2-84c3-83befcdf0331
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27
**Revisit when:** a harness starts sessions in a directory that is neither inside a project nor above several, or a layout appears that the four named ones do not cover

A project is the tree under the nearest `.keep-the-why` walking up from the
working directory, minus the trees under any deeper `.keep-the-why`. The
nearest file wins and cuts off everything above it, whether or not a Git
boundary lies in between. A directory above several projects and below
none is not a project: the agent takes the one the request names, else
asks. Four layouts are named for readers — shared context mono repo,
isolated context mono repo, multi repo, single repo — and a nested
repository is deliberately not a fifth.

**Reason:** before this the rule was implicit — the working directory *is*
the project — which works only when a session starts exactly at the
repository root. Walking up is the rule every developer already knows from
Git, it makes a session started in `src/` find the right file, and it
gives an isolated-context mono repo its semantics for free: a sub-project
with its own instance is isolated from the root's by construction, without
a field saying so. The "above several, below none" case came from a real
session: a hook that looks one level down loaded the skill in a folder of
many repositories, and the only correct move was to ask which one.

**Rejected alternative:** the Git toplevel as the project. Rejected because
it cannot express one repository with several `context/` directories, and
because a repository cloned inside another would then be swallowed by the
outer one.

**Rejected alternative:** an inner instance reads the enclosing instances
as well (the way Codex walks `AGENTS.md` from the root to the working
directory). Rejected because isolation is what the layout is *for* — a
sub-project that wants the root's knowledge declares it, in the family
mechanism the next steps add, rather than inheriting it by position.

**Rejected alternative:** a fifth layout for nested repositories. Rejected
because the walk-up rule already handles them, and a nested repository
with its own remote gets an ordinary `id`; naming the case would suggest a
mechanism that does not exist.

## `canonical` is a stored locator beside `id`, and a sub-project's place is a `root` field, not part of the URL

**Id:** 4d77c151-4e83-4a9b-9c2a-68a04a0348f5
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** a second locator kind is needed (a project reachable by something other than a repository URL), or a host stops resolving the normalized `https://` form
**See:** config-format.md#project-identity-is-stored-explicitly-not-re-derived-each-session — 691f82ba-a054-4a98-83f2-fa0e1fbdb9ff — as of 2026-09-28

`.keep-the-why` gains `canonical`, the `origin` URL normalized (`https://`,
no `.git`, no trailing slash, SSH rewritten), written once at init and
changed only deliberately; and, for an instance below the Git toplevel,
`root`, its path from the toplevel. Its `id` appends that path as a slug,
`<owner>---<repo>---<sub-path>`. `id` may initially be derived from the
same remote; afterwards the two evolve independently.

**Reason:** the next steps let projects name each other, and a name that
works across machines has to be the repository's URL — the one thing every
clone knows. It is a *locator*, not an identity: repositories are renamed,
transferred and moved between hosts, so the value is stored and changed on
purpose, exactly as `id` already is (`config-format.md`, "Project identity
is stored explicitly"). The slug in the `id` is a bug fix as much as a
design: two instances in one repository share one remote and would have
shared one personal file.

**Rejected alternative:** put the sub-path into the URL —
`https://github.com/owner/project1/sub-project2` as the sub-project's
`canonical`, one comparable string. First chosen, then reversed on review:
that URL is neither the repository's nor one the host answers (GitHub
returns 404), so it was a locator that did not locate, and every tool
would have had to take it apart again. `(canonical, root)` is the key
instead.

**Rejected alternative:** make the URL the identity and drop `id`.
Rejected because `id` keys every existing personal file, and because a
URL changes for reasons that have nothing to do with the project — the
argument that put `id` into the file in the first place.

**Rejected alternative:** re-derive `canonical` from the remote each
session. Rejected for the reason `id` is not re-derived: a renamed remote
would silently break every reference that names the old value, with
nothing recording what it used to be.

## Entries carry a UUID as their `Id`, and `See` and `Superseded by` resolve to it

**Id:** 6cae3bbb-10ce-46d5-914b-f884da584532
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** a host stops rendering heading anchors the way the locator rule assumes, or a project reports UUID lines as a real cost in readability

Every entry gets `**Id:**`, a UUID version 4 made by an OS command and never
changed; `See` cites another entry as `<locator> — <uuid> — as of <date>`;
`Superseded by` is required on every superseded entry and names the
successor's Id, a cross-project reference, or `none — <reason>`. The
locator is what a person clicks, the Id is what a tool resolves: when a
heading is reworded or a file is split, the linter finds the entry by Id
and reports the stale locator (`E119`), and the agent repairs it. The date
is a historical hint, not a revision.

**Reason:** until now an entry was identified only by its heading, and the
links in this repository's own `context/` are file-level for exactly that
reason — a `file.md#heading` link breaks silently on the two operations
the skill asks for, rewording and splitting (rule 6). The next step of the
series lets projects cite each other's entries across repositories, and a
web built on heading links would rot. A UUID is globally unique, so the Id
alone is an address in any project, any family and any export, with no
"unique within the project" clause and no disambiguation by project; and
the same OS command that already makes a project id without a remote makes
it, so nothing is composed by the agent from imagination.

**Rejected alternative:** a short random token, eight or twelve hex
characters. First chosen for line length, dropped on review: 32 bits
collide at about 1 % for ten thousand entries, and even 48 bits would have
needed a per-project uniqueness rule; a random token nobody reads or types
gains nothing from being short.

**Rejected alternative:** `See` as a prose convention rather than a field.
Rejected because a convention cannot be linted and cannot be turned into
edges by the dashboard; the field is what makes entry-to-entry references
mechanical.

**Rejected alternative:** a commit hash in the `See` line instead of, or
next to, the date. Rejected for now: a `See` wants the living entry, whose
Status may have moved to `superseded` since, and a hash would show the old
state for ever; the day plus the target's history is enough to recover what
was cited, and an optional fourth part would lengthen every line for a case
nobody has.

**Rejected alternative:** `Superseded by` optional, with a warning when
absent. Rejected because the spec's lifecycle already says a replaced
decision is recorded by a new entry; in the seventeen superseded entries
surveyed across this repository and the suite the successor either existed
or was an event — and `none — <reason>` covers the event, the way `Type:
undefined — <reason>` covers an unclassifiable entry.

## The linter reports stale locators and missing Ids; the agent repairs and migrates

**Id:** 4d461bd1-ea3b-40d1-a8c5-cbb72f6ca5d4
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer call, 2026-09-27
**See:** lint.md#the-home-files-are-checked-only-behind---setup-never-by-default — c2162bae-c634-49e6-8b39-0b3eb05a0c1f — as of 2026-09-27
**Revisit when:** the linter gains a second consumer that needs it to write (an editor integration that expects fixes), or the migration pass turns out to be too large for an agent session in a real project

The migration to entry ids is a pass the agent runs — generate a UUID per
entry, add `Superseded by` where Status is `superseded` — and the linter
then verifies it, `E114`–`E121`. A stale `See` locator is likewise a
finding the agent acts on. The linter never writes a file.

**Reason:** the linter is a CI tool that reads pull requests from
strangers, and "it reads and reports, it never mutates" is a trust
statement this project makes on its security page. A write mode, even a
narrow one behind a flag, would have made that sentence carry a footnote.
The agent is on every machine the skill runs on, the pass is additive (it
adds header lines — an `Id` per entry, a `See` where a body already names
one entry — and changes no existing text), and the linter finds what the
agent missed —
so the agent checks itself against the tool instead of the tool doing the
work.

**Rejected alternative:** a `--assign-ids` write mode in the linter, one
parser for both jobs. Rejected for the trust statement above, and because
no permanent migration tool is wanted for a one-time pass.

**Rejected alternative:** a shipped migration script. Rejected because the
skill ships no executables on purpose — the security scanners flag a
`bash` in a skill, and the project's line is that the only executables are
the two optional packages.

## A family is one parent and its children, and the parent's `children` block is the routing

**Id:** 14c6f3cd-a3c1-4c42-9d76-8171b214617b
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** a real family needs a member to belong to two parents, or a project asks for a relation that is neither parent nor child and cannot be expressed as a `See` line

A project belongs to at most one parent, declared by one `parent` line;
the parent lists its children in a `children` block, one line each with a
required one-line scope. That block is the routing: family-wide knowledge
goes to the parent, a child's subject goes to that child even when it
surfaced elsewhere, an ambiguous case is asked, and the parent is not the
place for everything no child claims. The family exists to organize
`context/`; it does not model dependencies.

**Reason:** the suite case that started this — a meta repository that
already is the central place for what concerns all packages — needs one
thing: that knowledge lives once, where it belongs, and is cited from
everywhere else. That takes a map of *where things belong*, kept in one
place so that a new module is one line in the parent and nothing is
maintained twice; the child's own `index.md` already says what it holds,
so the child repeats nothing. The scope is required because a child
without one gives the routing nothing — the agent working in the
websocket package cannot know that a REST quirk belongs to the REST
package unless something says so. One parent keeps it maintainable; a
family can nest, and routing then follows the parent chain (the entry on
nested families below).

**Rejected alternative:** upstream and downstream roles beside parent and
child, as the original issue sketched — the dependency direction as a
declared relation. Rejected because every family member may cite every
other with a `See` line, which covers the case the issue describes, and
because dependencies are already in the package metadata; a second copy
in `.keep-the-why` would drift.

**Rejected alternative:** an inner instance reads the enclosing ones by
position, so that a mono-repo sub-project sees the root's `context/` with
no declaration. Rejected with the discovery rule: isolation is what the
layout is for, and the family mechanism is the explicit way back.

**Rejected alternative:** the scope in the child, next to its own config,
with the parent holding only a list. Rejected because routing must be
readable from the parent without opening — or cloning — every child, and
because it would put the same information in N files instead of one.

**Rejected alternative:** the parent's scope as "everything no child
claims". Rejected on review: it makes the parent a dumping ground; what is
family-wide or clearly the parent's own goes there, the rest is asked.

## Children lines are `<name>: <location> — <scope>`, in the block grammar every config file already uses

**Id:** c3ffbd28-b391-4437-8443-34b0d7f6a4e3
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer call while implementing, 2026-09-27
**Revisit when:** a child needs more than a location and a scope (a per-child setting), or the block grammar gains a list form

A child line is a `- key: value` line like every other config line: the
key is a short name, the value is the location, an em-dash separator and
the scope. The design draft had `- <location> — <scope>` without a name.

**Reason:** the block parser splits a line at its first colon, and a URL
location contains one; a nameless line would have needed a second grammar
for one block, with its own duplicate and unknown-line rules. A name
costs one token, gives the parser the key it expects (a child listed twice
is the existing `E004`), and gives findings and prose something to say
("child `widget` does not name this project as its parent") instead of
repeating a URL.

**Rejected alternative:** a list grammar for the `children` block only.
Rejected because one config grammar for four block kinds is a property
the linter, the dashboard and every reader rely on.

## A write into another family member needs its local working tree, found in the same repository or the sibling folder

**Id:** e4bc46e9-650a-4c87-a09d-e61a10196bbf
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** the mapping and the read-only cache land (the next step of the series) — then "local" is what the mapping knows, not only the sibling folder; or dogfooding shows a real need to write into a project that is not checked out

The agent may write into a family member that has a local working tree —
the same mono repo, or a checkout in a sibling directory of the current
project whose `.keep-the-why` carries the named `canonical` — under that
project's own `capture-confirmation`, saying which project it wrote to. A
member that is not local is named and the entry is not written into the
current project instead. Nothing outside the family is written; nothing is
cloned by this step.

**Reason:** routing without a write path would name where an entry
belongs and then lose it, and writing it locally with a note would
recreate the redundancy the family exists to remove. A working tree is
where a person expects uncommitted work and sees it at every
`git status`; committing stays their action, so a multi-repo write is an
ordinary change in another checkout. The sibling-folder rule is how a
suite is laid out on a developer's machine anyway, and it needs no state
file — the mapping comes with the next step. Working tree = work; what a
cache is for, and why it is read-only, is decided there.

**Rejected alternative:** write the entry into the current project with a
pointer, for the parent to pull later. Rejected as redundancy through the
back door.

**Rejected alternative:** search the whole machine, or every path ever
seen, for a checkout. Rejected for this step because a search without a
recorded mapping guesses, and because two clones of one repository must
never be told apart by whichever was opened last — the mapping step
carries that rule.

## The mapping is one JSON file in the developer's home, kept by the skill and the dashboard alike

**Id:** 3c014723-e167-4018-b82a-eaef5425a437
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** a third tool needs to write the mapping, or the file grows past what a whole-file rewrite on every session can carry

`~/.keep-the-why/projects.json` records where every project has been seen
on this machine: one row per project with `id`, `canonical`, `root`, its
paths with `last_seen`, and a cache path when one exists. The skill's setup
check writes the current project's path every session; the dashboard writes
a project when it is opened; the dashboard's own history file is folded in
and removed.

**Reason:** resolving a family member needs a machine-local answer to
"where is it checked out", and that answer is neither project content nor
a setting: it is cache data, many rows with timestamps, written by tools.
JSON says so; a Markdown block would have been the wrong shape for a file
nobody edits. The dashboard already kept exactly this information for its
project menu, so one file serves both instead of two files drifting, and
"the one thing the dashboard writes" stays one thing.

**Rejected alternative:** `last_seen` as the write target when a
repository has several working trees. Rejected on review: two clones or
Git worktrees of one repository would let an agent working in repository
A write into yesterday's feature worktree of repository B because it was
opened last. One working tree → use it; several → the one beside the
current project's family, else ask.

**Rejected alternative:** derive locations every time by scanning the
folder that holds the current project. Kept as the fallback for a machine
without a mapping yet, rejected as the rule because a scan guesses where
a mapping knows.

## A context cache is a sparse partial clone under the home directory, built in two stages, and read-only

**Id:** af010083-0200-4b0a-a220-b94bbb7b566e
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27, with two rounds of external review
**Revisit when:** dogfooding shows a real need to write into a project that is not checked out, or a host stops serving partial clones

A family member that is not checked out is fetched only after a question
— a full clone into the family's folder, or a context cache:
`git clone --filter=blob:none --sparse` under `~/.keep-the-why/cache/<id>/`,
checked out first to the member's `.keep-the-why`, then to the context
directory that file names. No agent instruction files. The cache is
read-only for every tool; it refreshes on a timer before reads (default
daily, asked once), a failed pull asks or follows a stored answer, and its
settings live in `~/.keep-the-why/cache/<id>.md` next to the directory.

**Reason:** a sparse partial clone downloads commit metadata plus the named
paths, is host-independent, keeps a commit hash for citations, and needs
no service. Under the home directory, not inside the project that uses
it, so every package of a suite shares one cache of its parent. Two stages
because `context` is configurable and a hardcoded path would have fetched
the wrong directory for a project that keeps its knowledge elsewhere; no
`AGENTS.md` or `CLAUDE.md` because a family cache needs knowledge, not
another project's instructions — the trust rule applied to what is fetched
at all. Read-only because a write nobody commits would make the cache the
only copy of that change, hidden where nobody looks; a working tree shows
uncommitted work at every `git status`. Working tree = work, cache =
knowledge. A full clone is the person's tree: never pulled by the skill,
never judged for age, because the checked-out state is the one the
developer chose.

**Rejected alternative:** a writable cache with "pull before every write".
First designed, dropped on review: it contradicted "the cache is never the
only copy of anything" the moment a write went uncommitted, and it dragged
the offline question into writes. Removing it simplified three rules at
once.

**Rejected alternative:** the settings file inside the cache directory.
Rejected because the directory is a checkout of someone else's repository;
a file in it would be untracked there and show in every `git status`.

**Rejected alternative:** fetch the context directory with a hardcoded
name, plus the repo-native memory files. Rejected on review for the two
reasons above.

## The live badge is a static SVG the export writes, not a badge service

**Id:** 1d8d6273-8710-4c89-9b29-b1d408a4b1d7
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-27, after external review
**Revisit when:** the numbers on the badge need to be current between docs builds, or a host stops serving SVG from a pages site

`ktw-dashboard --export` writes `badge.svg` next to `state.json`, rendered
at export time with the project's numbers ("42 entries · 3 open" — open,
needs-review and pending-confirmation count as open). A README links it as
the *live* badge next to the static one from keepthewhy.com, and the link
lands on the project's own dashboard.

**Reason:** the export already produces artifacts, and a badge is one more.
README → the project's own SVG → the project's own dashboard has nothing
in between, which is the property the project argues for everywhere else.
The numbers are as current as the docs build, which is as current as the
dashboard behind the link.

**Rejected alternative:** a shields.io endpoint file (`badge.json`) that a
badge service renders on request — the idea that had been parked in
`TODO.md`. Rejected on review: a service in between, for a picture.

## The dashboard shows the family as a view and a grouped menu, keeps *forget* out of the dropdown, and makes the Id an address

**Id:** 55247232-1368-40b4-a955-3c929b7f7b6b
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-26/27; implementation call on the menu, 2026-09-27; maintainer statement on the page's entry links, 2026-09-29
**Revisit when:** a browser control lets a native `<select>` carry a per-row action, or the family view is asked to fetch a member itself

The family surfaces on the page as a **Family** view (parent, siblings,
children with their scopes and how each is available here, with the
commands that would fetch a missing one), a **Projects** view (everything
the machine knows, families grouped with children indented, each row with
its type and a *forget* control), and a project menu grouped the same way
with the type in parentheses. `#entry/<uuid>` is an entry's address: the
page looks the Id up here, then asks the server, which searches every
project it knows and the page switches to the one that holds it. Host URL
grammar lives only in the dashboard's "open on the host" link.

**Reason:** the request was a dropdown that lists projects and caches with
their type and a delete control per row. A native `<select>` cannot carry
a per-row button, and rebuilding the menu as a custom panel for one
control would have replaced a working, accessible element with a worse
one. The menu keeps the switching and shows the types; the list with the
control is a view, where it can also show what a row is (id, canonical,
path, last seen) before anyone forgets it. The Family view is a separate
view because it is *this project's* family — one parent and its children
— while Projects is everything known; the two questions have different
answers. The dashboard names how to get a missing member and never fetches
it: fetching is the skill's action after a question, and the dashboard is
a viewer that manages only metadata and caches it is told to forget.

**Rejected alternative:** a custom dropdown panel with delete buttons in
place of the `<select>`. Rejected as above — a worse control for one
action that has a better home.

**Rejected alternative:** host links computed from the `See` locator
itself, so that a cross-project reference is clickable to the file.
Rejected with the `See` design: the locator across projects is the
canonical alone, and the dashboard computes the host form from what it
knows — canonical, branch, context directory, file and heading — the one
place that knowledge is allowed to live.

**Consequence (2026-09-29, maintainer decision):** every link the page
makes to an entry uses the Id address — tree, lists, pager, backlinks,
findings, graph — not only the `See` and `Superseded by` rows, so a URL
copied from the address bar can be passed on and keeps working. A
`file.md#anchor` address breaks when the heading is reworded or the entry
moves to another topic file; the Id never changes. An entry without an Id
keeps the anchor form, and an old anchor link still opens the entry and
is rewritten to the Id address in place.

## Public mode is the browser reading published exports, bootstrapped from a raw `.keep-the-why` at `HEAD`

**Id:** cae2d3bf-9ca6-42a8-98f4-6da2ca1904d3
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-27, with external review; `HEAD` on raw URLs verified against GitHub, GitLab and Codeberg the same day
**Revisit when:** a host stops serving raw files at `HEAD` or drops the CORS header on them, or a project wants public mode without publishing an export

The dashboard's *public* switch reads a family member's published export
instead of a checkout: the browser fetches the member's `.keep-the-why`
as a raw file at `HEAD`, takes its `dashboard-state` line — the URL of the
`state.json` its docs build published — and loads the project from that.
Family, search and entry-by-Id work over those exports the same way. The
export's `generated` time stands next to the switch. `state.json` carries
a schema version and the page reads any version tolerantly.

**Reason:** the export already produced exactly the document the page
renders, and a docs site already served it with the CORS header a browser
needs; public mode is a second data source for the same interface, not a
second interface, and one never leaves the local dashboard for another
project's. The browser makes the requests so that the Python server keeps
its one-call promise and the skill stays off the network; a host that
refuses the fetch fails visibly instead of being proxied. `HEAD` as the ref
removes the default-branch question a review had raised — all three
hosts resolve it. The schema version and tolerant reading exist because a
family is never on one dashboard version, and a published export is
whatever its producer last built.

**Rejected alternative:** a hosted resolver on keepthewhy.com that takes a
canonical and an Id and fetches the entry. Rejected because links in other
people's repositories would then depend on this project's site being up —
the "service in between" the philosophy excludes.

**Rejected alternative:** the parent's export carrying its children's
`dashboard-state` URLs, so that no raw `.keep-the-why` needs fetching.
Considered when the bootstrap looked host-dependent; not needed once
`HEAD` worked everywhere, and it would have copied a line the child owns
into the parent's build.

**Rejected alternative:** proxying the fetch through the local server to
sidestep CORS. Rejected because it would make the server a second network
caller and let a hostile export reach it; the browser's own rules are the
right boundary for other people's published files.

## In a nested family, routing follows the parent chain up to the root

**Id:** 5ee1ab7e-03e2-400f-aa4e-809dce75959a
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer design discussion, 2026-09-28, while migrating the suite (the cluster's dashboard as a child of the cluster, the cluster a child of the suite)
**Revisit when:** a real tree turns out to need routing into a branch that is not on the chain, or the "which level is this wide enough for" question gets asked so often that it needs a rule of its own

A family can nest: a child can be the parent of its own children. The
family is then the whole tree, and routing follows the parent chain. Each
level's `children` block routes among its own children only; what a
level's family shares goes to that level's parent, and what is wider goes
one level further up, to the root at most. A child's subject goes to that
child and on down through its own block. Any member of the tree with a
local working tree may be written to; a project outside the tree is
read-only. Which level a subject is wide enough for, when it is unclear,
is asked.

**Reason:** the first real nested family — the suite, its cluster, the
cluster's dashboard — showed what the previous rule ("nothing resolves
through a grandparent") did: from the dashboard, the suite was read-only
and a suite-wide release rule would have been routed to the cluster, the
wrong place, because "family-wide" only reached one level. The levels of
the tree are responsibilities — the dashboard's developers, the cluster's,
the suite's — and a decision belongs to the level whose family it binds.
Walking the chain keeps that: each level still routes only its own
children, so nothing needs a global table, and a block is read only when
the chain reaches it.

**Rejected alternative:** keep the grandparent read-only and treat a
subject wider than the parent's family like a member that is not checked
out — named, not written. Rejected because in a tree the root is exactly
the central place a suite is meant to have; a leaf that cannot reach it
would push every wide decision into the level below it or into a question.

**Rejected alternative:** flatten every family to one level (the dashboard
as a direct child of the suite). Possible, and still allowed, but it moves
the cluster's own routing into the suite's block and loses the cluster as
the place for what binds its packages only.
## `canonical` comes from the published remote: `upstream` in a fork checkout, else `origin`

**Id:** 2f464b89-3f06-477b-8a73-3e86bb1e0538
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** migrating the suite's eight repositories, 2026-09-28 — every checkout used there is a fork checkout; maintainer call the same day
**Revisit when:** a hosting convention appears that names the published remote differently (no `upstream`), or a project reports the ask as noise

`canonical` — and `id` for a project set up now — is derived from the
published remote: `upstream` when that remote exists, else `origin`. When
the remotes leave it unclear which one is the project's own repository,
the agent asks.

**Reason:** the first real migration ran in fork checkouts, where `origin`
is the contributor's fork. Taken from `origin`, `canonical` would have named
the fork in all eight repositories, and every `parent` line, `children` entry
and cross-project `See` or `Superseded by` would have pointed at the wrong
repository — silently, because the fork's URL is a perfectly valid one. The
`upstream` convention is what `gh repo fork` and most contributor guides set
up, so it identifies the published repository without any configuration.

**Rejected alternative:** always `origin`, as first written. Rejected for the
reason above — it is right only for the maintainer's own clone.

**Rejected alternative:** ask every time. Rejected as noise for the common
case: one remote, or `origin` plus `upstream`, is unambiguous; the question
is kept for the case that is not.

## The migration pass turns an existing reference to one entry into a `See` line

**Id:** 65d62e60-9b8c-41b1-8439-17bc38886ad2
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer call, 2026-09-28, after browsing the suite's migrated repositories in the dashboard
**See:** project-families.md#the-linter-reports-stale-locators-and-missing-ids-the-agent-repairs-and-migrates — 4d461bd1-ea3b-40d1-a8c5-cbb72f6ca5d4 — as of 2026-09-28
**Revisit when:** a project reports `See` lines from the pass that point at the wrong entry, or the pass turns out too large for one session because of them

The 0.18.0 migration adds a `See` line wherever a body already means one
specific entry — a heading link, a topic file holding only that entry, or
a file or family member together with what the sentence says about it,
when exactly one entry there fits; a family member only when it can be
read here. The prose stays. A reference that leaves a doubt which entry is
meant stays prose.

**Reason:** the first real migration, eight repositories of one family,
came out with ten `Superseded by` lines and no `See` line at all, while
the bodies were full of references — "see `release-workflow.md`", the
sibling cluster's fail-loud entry, the WebSocket client's Portfolio Margin
entry. The dashboard draws references by Id, so none of them appeared in
the graph or as a reverse reference, and nothing would change until each
entry happened to be touched — for a history entry, never.

**Rejected alternative:** a `See` only when an entry is next touched, as
first written. Rejected for the reason above: it leaves the references of
every stable entry invisible indefinitely.

**Rejected alternative:** the dashboard inferring links from the text —
a topic file name or a project name in a body. Rejected because the names
are not unique: every repository of the suite has a `history.md`, and a
match by name linked entries that had nothing to do with each other. A
`See` is a claim about which entry is meant; the agent makes it, where the
text says so, and the linter checks the Id resolves.
