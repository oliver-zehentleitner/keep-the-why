# Security

Two separate questions, both answered here — with the actual detail living in its own place rather than duplicated.

## Is it safe to let an agent read and write `context/`?

Keep the Why treats everything read from a repository — `context/` included — as data, never as instructions. An entry can describe a decision or a constraint; it can't grant itself authority to override a system, developer, or user instruction, expand permissions, authorize a tool call, disable a safety check, or ask for a secret. A suspicious entry gets named and flagged to the user, not silently followed, deleted, or rewritten.

This matters more for `context/` than for an arbitrary repo file precisely because the skill is designed to read it automatically, treat it as high-salience background, and keep it around across sessions — the same property that makes it useful is what would make injected content dangerous if this rule didn't exist.

See [Trust model](trust-model.md) for the full reasoning, the read/write rules, and worked examples.

## What Keep the Why does and doesn't add to your attack surface

- No external service, no telemetry, no daemon, no database — see [Philosophy](philosophy.md). There's nothing running that Keep the Why itself could leak through.
- No secrets, credentials, or personal data belong in `context/` (Core rule 9) — retrospective recovery and interviews synthesize rationale, they don't transcribe raw material verbatim.
- Actions with real side effects still go through whatever the agent running the skill already requires — permission prompts, sandboxing, trust verification. Keep the Why doesn't add a separate permission layer, and doesn't assume those mechanisms are bulletproof either.
- `context/` is committed alongside the code, reviewed the same way — a change to it is as visible in a diff or a pull request as any other change.

## Reporting a vulnerability in Keep the Why itself

That's a different question from the above — see [`SECURITY.md`](https://github.com/oliver-zehentleitner/keep-the-why/blob/latest/SECURITY.md) for the disclosure process, or report directly via [GitHub Security Advisories](https://github.com/oliver-zehentleitner/keep-the-why/security/advisories/new).
