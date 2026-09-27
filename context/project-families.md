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
