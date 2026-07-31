# Orders

## Retry on timeout

**Status:** active
**Evidence:** confirmed
**Source:** initial design, 2026-05

Failed gateway submissions are retried up to three times with exponential
backoff. A request that times out client-side is simply resubmitted.
