# Design

## The client retries idempotent calls only

**Id:** af229692-09f1-48ed-8b3d-8d9a2270ead4
**Type:** decision
**Status:** active
**Evidence:** confirmed

Only GET and idempotent POSTs carrying a key are retried.

**Reason:** a retried non-idempotent call can double an order.
