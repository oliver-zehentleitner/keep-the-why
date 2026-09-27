# Upstream limits

## Batch size stays at 500

**Id:** 77e91eff-5c01-41f0-a241-c126dd898bb7
**Status:** active
**Evidence:** confirmed
**Source:** provider docs, 2026-04
**Revisit when:** the provider raises the 500-item batch cap on /v2/items

Sync batches are capped at 500 items because the provider rejects larger
requests with a 413.
