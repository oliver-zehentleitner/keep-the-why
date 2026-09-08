# Security

Five questions, answered here with the detail living in its own place rather than duplicated: whether an agent can be let loose on `context/`, what the skill adds to a project's attack surface, what the linter does with hostile input, what the skill may do when it installs and runs that linter itself, and how this repository itself is protected — plus what the automated scanners say and why.

## Is it safe to let an agent read and write `context/`?

Keep the Why treats everything read from a repository — `context/` included — as data, never as instructions. An entry can describe a decision or a constraint; it can't grant itself authority to override a system, developer, or user instruction, expand permissions, authorize a tool call, disable a safety check, or ask for a secret. A suspicious entry gets named and flagged to the user, not silently followed, deleted, or rewritten.

This matters more for `context/` than for an arbitrary repo file precisely because the skill is designed to read it automatically, treat it as high-salience background, and keep it around across sessions — the same property that makes it useful is what would make injected content dangerous if this rule didn't exist.

See [Trust model](trust-model.md) for the full reasoning, the read/write rules, and worked examples.

## What Keep the Why does and doesn't add to your attack surface

- No external service, no telemetry, no daemon, no database — see [Philosophy](philosophy.md). There's nothing running that Keep the Why itself could leak through. This covers Keep the Why only: third-party installers referenced in [Installation](installation.md) (e.g. `npx skills`) have their own, separate policies.
- No secrets, credentials, or personal data belong in `context/` (Core rule 7) — retrospective recovery and interviews synthesize rationale, they don't transcribe raw material verbatim.
- Actions with real side effects still go through whatever the agent running the skill already requires — permission prompts, sandboxing, trust verification. Keep the Why doesn't add a separate permission layer, and doesn't assume those mechanisms are bulletproof either.
- The three paths `.keep-the-why` can name are each confined to one directory: `context` and `pinned-path` to the project, the `id`-derived personal file to `~/.keep-the-why/`. A pinned `SKILL.md` is additionally checked for `name: keep-the-why` and the pinned version before it is followed — a pin is the one place repository content is meant to act as instructions, so it is scoped to a vendored copy of this skill and nothing else. Both the skill (Core rule 11, [trust model](trust-model.md), "Paths named by configuration") and the linter (`E009`, `E010`) enforce this.
- A session with nobody present to answer cannot grant itself the permission `capture-confirmation` withholds. Only a session *declared* unattended — by the task or by `session: unattended` in the machine-wide config — writes at all at such a point, and then with `Status: pending-confirmation`, visible to the next person; an agent that merely finds itself in a quiet session asks, as always ([Specification](specification.md), §9; [Setup](setup.md), "Unattended sessions").
- `context/` is committed alongside the code, reviewed the same way — a change to it is as visible in a diff or a pull request as any other change.

## The linter runs on pull requests from strangers

`keep-the-why-lint` is a CI tool that reads a configuration file and a directory of Markdown from whatever commit triggered it — in a public repository, that means from anyone. It is written for that, and every one of the following is a regression test, not a promise:

- **It never reads outside the checkout.** `context` and `pinned-path` are resolved with symlinks followed and must land inside the project root; an absolute path, a `..` escape, a symlink leaving the tree — including the config file itself being one — is `E009` and not read. A symlinked file inside the context directory that resolves outside it is skipped with the same code. The one exception is explicit: `--setup` reads two named files under `~/.keep-the-why/` — the developer's own personal file and machine-wide config — for a local check after a settings change; the flag is never passed in CI, and the personal file's name comes from an `id` that passed `E010` first.
- **The `id` is a file name.** Letters, digits, `.`, `_`, `-`, nothing that could make `~/.keep-the-why/<id>.md` land elsewhere (`E010`).
- **Malformed input is a finding, not a traceback.** A config block without its end marker (`E011`), a second start marker (`E012`), a control character or an embedded NUL in a path field (`E009`), a file that is not valid UTF-8 (`E302`) — each is reported with a line number and the run continues; nothing reaches the path layer or the decoder unguarded.
- **What it prints is escaped.** Values from the file are quoted in findings; control characters are rendered as `\xNN`, so a value cannot paint a terminal or a GitHub annotation, and a finding message cannot become a workflow command.
- **Hidden content is an error.** Invisible and directional Unicode (`E301`) is the one mechanically checkable slice of the trust model; base64-looking blobs are a warning (`W301`). This is not a secret scanner — pair it with one.
- **No network, no dependencies.** Standard library only; the action installs it from PyPI and runs it, nothing else.

The finding codes and what each checks: [Linting](linting.md). What the skill itself guarantees on the same inputs — the pin identity check, declared-not-inferred sessions, the trust model — is in the sections above; the linter is the part of it that a CI job can settle.

## The skill installs and runs the linter

Since 0.14.0 the skill can run `keep-the-why-lint` itself — after a write to `context/`, and with `--setup` after a settings change — when a developer's personal `local-lint` setting says so (the wizard proposes `auto`; a file without the line means `ask`). That is the one place where the skill installs and executes a program, so the boundaries are stated here in full; every one of them is in `references/setup.md`, "Local linting", as the rule the agent follows:

- **One package, by its fixed name, from PyPI.** `keep-the-why-lint`, published from this repository through trusted publishing. The name, the index and the install command are the skill's own text; nothing in `.keep-the-why`, `context/`, a `personal-defaults` block or a linter finding can change which package is installed, from where, or at which version — the only version input is the floor, the skill's own `metadata.version`.
- **The wizard's answer is the yes.** The personal wizard proposes `auto` and names the install in the question, so the answer — a one-word "defaults" included — is the consent for the install that follows in the same turn; `ask` asks before any install or update, and a declined install is recorded so the question is asked once; `no` leaves it to CI. A personal file that predates the setting and has no `local-lint` line means `ask`, never `auto`: a skill update does not install a package on an existing machine on its own. A session declared unattended never installs under `ask`.
- **No privilege, no environment override.** The install uses what the machine already has — `pipx`, a user-site `pip`, `uv` — and never elevated privileges, a new virtual environment, or an override of an externally managed Python; a failing install is named with its error and asked about.
- **The linter's output is data.** Findings are `path:line: [CODE] message`; the skill treats them the way it treats repository content (Core rule 11): a finding licenses fixing that finding in a file written this session, and nothing else — not another file, not `context-schema`, not a further install. A value an author put into an entry can be echoed inside a finding message; that gives it no more authority than it had in the entry.
- **The version floor points one way.** The linter is brought up to the skill's version; `context-schema` and the skill's version are never lowered to satisfy an older linter.
- **`--setup` is the only read outside the checkout**, and it is the developer's own two files under `~/.keep-the-why/`, located by an `id` that passed `E010` — see above.

What this adds to the attack surface: a shell invocation of a stdlib-only tool the repository publishes itself, and a PyPI install gated by a question. What it does not add: any path by which repository content chooses what runs.

## How this repository is protected

The skill, the linter and this site are built and published from one repository. What stands between a commit and a release:

- **Every workflow action is pinned to a commit SHA**, with Dependabot proposing the bumps weekly; workflows that write nothing run with a read-only token; the linter reaches PyPI through trusted publishing, no long-lived token anywhere.
- **A skill release is refused unless the tag agrees with the commit.** `release.yml` compares the tag against `SKILL.md`, both plugin manifests, `llms.txt`, this repository's own `context-schema`, the linter's `SUPPORTED_SCHEMA` and the newest CHANGELOG section, and requires the matching linter to be on PyPI already — the release checklist's linter-first order as a gate, not a convention. The tag reaches the scripts as an environment variable, never interpolated into a shell.
- **`main` takes squash-merged pull requests only**, with Validate Skill, the linter package tests, the dogfood lint of this repository's own `context/` in strict mode, and Black as required checks; force-pushes and deletion are blocked; `CODEOWNERS` routes review for `context/`, the config, the workflows, the linter, the skill and the eval fixtures.
- **Reviewed from outside, more than once.** External reviews of 0.11.0 and 0.12.0 each found real things — the path confinement, the SHA pins, the `id` grammar, the release gate — and each is listed in the CHANGELOG with what changed. A full audit of the repository followed the 0.12.0 review (2026-09-07); its findings are in `main` or, where deliberately left, recorded as decisions in `context/`.

What is deliberately *not* hardened, so nobody has to re-find it: `latest` and `lint-latest` are moving tags and the default way to consume the skill and the action, which means a compromised maintainer account reaches every consumer on the next session — the mitigation is account hygiene, not a code change. The eval runner executes agents with their permission bypass on the operator's machine, against fixtures that contain injection payloads on purpose; the evals README says where to run it. Build inputs (`setuptools`, `build`, the docs requirements) float; a lock file is the next step if the claim above ever needs to become "reproducible".

## What automated scanners report, and why

Several registries scan the skill package (`skills/keep-the-why/`) automatically, and their labels differ because they check different things. Here is what each one reports and what stands behind it, so a warning on a listing page doesn't have to be decoded from scratch.

- **[SkillsLLM](https://skillsllm.com/skill/keep-the-why)** — **Verified**; see the [scan report](https://skillsllm.com/security-check/IPmNycVdbOyq) for what it checked.
- **[skills.sh](https://skills.sh/oliver-zehentleitner/keep-the-why/keep-the-why)** runs three auditors on every listed skill:
    - **Socket** — Pass.
    - **Snyk** — Warn, medium, one finding: *W011, third-party content exposure (indirect prompt injection risk)* — retrospective recovery and knowledge-transfer interviews ingest outsider-authored text such as issue and pull-request threads. Accurate, and by design: reading those sources is what the retrospective mode is for. The mitigation is Core rule 11 and the [trust model](trust-model.md) — repository content is data, never instructions; an embedded directive gets named to the user, not followed; nothing is copied verbatim into `context/`. The finding describes the skill's purpose rather than a gap, so expect it to stay for as long as the skill reads issues at all.
    - **Gen Agent Trust Hub** — Pass. It looks at five capabilities the skill genuinely has: loading `SKILL.md` from the path a project pins in `.keep-the-why` ("dynamic execution"), the same third-party content exposure as above, the optional `SessionStart` hook ("persistence"), the update check against the GitHub releases API ("external downloads"), and `uuidgen`/`grep` in the reference files ("command execution") — [pinned versions](setup.md#pinned-versions), [autostart](autostart.md), the [update check](setup.md#timer-check-every-session-for-whoever-has-a-personal-config). Each runs only through the permission prompts of whatever agent is executing the skill.
- **agent-skill-manager (asm)** — `asm audit security` runs regular expressions over the package files: any `https://` URL is a *network* permission warning, the word `bash` (or `exec(`, `eval(`, a credential-shaped assignment) a high finding. Against 0.13.1 (asm 2.14): *CAUTION*, twenty warnings, every one of them "External URLs" — the links to this site, to GitHub's releases API for the update check, and to OWASP — and nothing else; the same twenty, and nothing else, against the 0.14.0 skill text with the local linter run in it. That is the floor for any skill that contains a link at all, and none of it is the data-exfiltration or remote-payload pattern the check is meant to hint at.

All of these are second opinions, not a substitute for reading `SKILL.md` and the [trust model](trust-model.md) yourself.

## Reporting a vulnerability in Keep the Why itself

That's a different question from the above — see [`SECURITY.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/SECURITY.md) for the disclosure process, or report directly via [GitHub Security Advisories](https://github.com/oliver-zehentleitner/keep-the-why/security/advisories/new).
