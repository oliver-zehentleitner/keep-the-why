# Orders

## Retry on timeout

**Id:** 419ab142-aee2-4954-989f-9f195dcfe980
**Status:** active
**Evidence:** confirmed
**Source:** initial design, 2026-05

Failed gateway submissions are retried up to three times with exponential
backoff. A request that times out client-side is simply resubmitted.
