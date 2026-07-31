# Reliability

## Upstream retries capped at three

**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03

The inventory client retries at most three times, to bound worst-case
latency for the intake handler waiting on it.
