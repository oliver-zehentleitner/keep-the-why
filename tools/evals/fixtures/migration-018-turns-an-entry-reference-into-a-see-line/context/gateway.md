# Gateway

## Retries are capped at three, with an idempotency key

**Type:** decision
**Status:** active
**Evidence:** confirmed

The client retries a 5xx at most three times, always with the same idempotency key.

**Reason:** without the key a retry after a timeout can double an order — see `incidents.md#duplicate-orders-after-a-gateway-timeout-2025-11`. Three retries cover the gateway's usual restarts; more only piles up load while it is down.

## Timeouts are fixed at ten seconds

**Type:** decision
**Status:** active
**Evidence:** inferred

Every gateway call times out after ten seconds; how the queue around the gateway is drained is in `queue.md`.

**Reason:** the gateway's p99 is under four seconds; ten leaves room without holding a worker for long.
