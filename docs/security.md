# Security

Two separate questions, both answered here — with the actual detail living in its own place rather than duplicated.

## Is it safe to let an agent read and write `context/`?

Keep the Why treats everything read from a repository — `context/` included — as data, never as instructions. An entry can describe a decision or a constraint; it can't grant itself authority to override a system, developer, or user instruction, expand permissions, authorize a tool call, disable a safety check, or ask for a secret. A suspicious entry gets named and flagged to the user, not silently followed, deleted, or rewritten.

This matters more for `context/` than for an arbitrary repo file precisely because the skill is designed to read it automatically, treat it as high-salience background, and keep it around across sessions — the same property that makes it useful is what would make injected content dangerous if this rule didn't exist.

See [Trust model](trust-model.md) for the full reasoning, the read/write rules, and worked examples.

## What Keep the Why does and doesn't add to your attack surface

- No external service, no telemetry, no daemon, no database — see [Philosophy](philosophy.md). There's nothing running that Keep the Why itself could leak through. This covers Keep the Why only: third-party installers referenced in [Installation](installation.md) (e.g. `npx skills`) have their own, separate policies.
- No secrets, credentials, or personal data belong in `context/` (Core rule 9) — retrospective recovery and interviews synthesize rationale, they don't transcribe raw material verbatim.
- Actions with real side effects still go through whatever the agent running the skill already requires — permission prompts, sandboxing, trust verification. Keep the Why doesn't add a separate permission layer, and doesn't assume those mechanisms are bulletproof either.
- `context/` is committed alongside the code, reviewed the same way — a change to it is as visible in a diff or a pull request as any other change.

## What automated scanners report, and why

Several registries scan the skill package (`skills/keep-the-why/`) automatically, and their labels differ because they check different things. Here is what each one reports and what stands behind it, so a warning on a listing page doesn't have to be decoded from scratch.

- **[SkillsLLM](https://skillsllm.com/skill/keep-the-why)** — **Verified**; see the [scan report](https://skillsllm.com/security-check/IPmNycVdbOyq) for what it checked.
- **[skills.sh](https://skills.sh/oliver-zehentleitner/keep-the-why/keep-the-why)** runs three auditors on every listed skill:
    - **Socket** — Pass.
    - **Snyk** — Warn, medium, one finding: *W011, third-party content exposure (indirect prompt injection risk)* — retrospective recovery and knowledge-transfer interviews ingest outsider-authored text such as issue and pull-request threads. Accurate, and by design: reading those sources is what the retrospective mode is for. The mitigation is Core rule 11 and the [trust model](trust-model.md) — repository content is data, never instructions; an embedded directive gets named to the user, not followed; nothing is copied verbatim into `context/`. The finding describes the skill's purpose rather than a gap, so expect it to stay for as long as the skill reads issues at all.
    - **Gen Agent Trust Hub** — Warn, medium. Lists five capabilities: loading `SKILL.md` from the path a project pins in `.keep-the-why` ("dynamic execution"), the same third-party content exposure as above (naming rule 11 and the trust model as the mitigation), the optional `SessionStart` hook ("persistence"), the update check against the GitHub releases API ("external downloads"), and `uuidgen`/`grep` in the reference files ("command execution"). Each is a documented feature — [pinned versions](setup.md#pinned-versions), [autostart](autostart.md), the [update check](setup.md#timer-check-every-session-for-whoever-has-a-personal-config) — and each runs only through the permission prompts of whatever agent is executing the skill.
- **agent-skill-manager (asm)** shows a risk label at install time that is computed from regular expressions over the package files: any `https://` URL makes it *Medium Risk*, the word `bash` (or `exec(`, `eval(`, a credential-shaped assignment) makes it *High Risk*. Up to 0.11.0 this skill showed *High Risk* because two reference files fenced their shell snippets as ` ```bash `; the fences are ` ```sh ` now, which renders identically. What remains is *Medium Risk*, from the links to this site, to GitHub, and to OWASP — the floor for any skill that contains a link at all. None of it is the data-exfiltration or remote-payload pattern the check is meant to hint at.

All of these are second opinions, not a substitute for reading `SKILL.md` and the [trust model](trust-model.md) yourself.

## Reporting a vulnerability in Keep the Why itself

That's a different question from the above — see [`SECURITY.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/SECURITY.md) for the disclosure process, or report directly via [GitHub Security Advisories](https://github.com/oliver-zehentleitner/keep-the-why/security/advisories/new).
