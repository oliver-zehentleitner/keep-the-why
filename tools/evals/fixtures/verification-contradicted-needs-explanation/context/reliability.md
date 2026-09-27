# Reliability

## Upstream retries capped at three

**Id:** 2d59b6ce-a64b-444c-8a64-d70abd8c1b38
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2026-03

The inventory client retries at most three times, to bound worst-case
latency for the intake handler waiting on it.
