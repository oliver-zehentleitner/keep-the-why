# Retries

## Bounded retries with exponential backoff on gateway 5xx

**Type:** decision
**Status:** pending-confirmation
**Evidence:** inferred
**Source:** unattended retrospective pass, 2026-08-30

`submit_with_retry` retries a gateway call three times on 5xx responses, waiting
`2 ** attempt` seconds plus jitter between attempts, and gives up after that.

**Reason:** inferred from the code alone — a fixed delay would send every retry
at the same moment into an outage window; the cap keeps a dead gateway from
holding an intake request open indefinitely. Nobody was present to confirm this
when it was written.

**Rejected alternative:** unknown.
