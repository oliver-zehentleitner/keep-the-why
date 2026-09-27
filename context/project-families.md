# Project families

A project that is larger than one repository, or a repository that holds
several: how the skill finds the project it is in, how instances are told
apart, and — in later releases — how instances name each other. The series
answers [#450](https://github.com/oliver-zehentleitner/keep-the-why/issues/450)
(cross-repository rationale) in steps; this file records the decisions as
each step lands. What the code cannot say is why the boundaries were drawn
where they are.

## The project is the nearest `.keep-the-why` walking up, not the working directory and not the Git toplevel

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
