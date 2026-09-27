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
The agent is on every machine the skill runs on, the pass is additive (one
line per entry, no existing link changes, because links were file-level
and no `See` lines existed), and the linter finds what the agent missed —
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
family can nest, but nothing resolves through a grandparent.

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
**Source:** maintainer design discussion, 2026-09-26/27; implementation call on the menu, 2026-09-27
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
