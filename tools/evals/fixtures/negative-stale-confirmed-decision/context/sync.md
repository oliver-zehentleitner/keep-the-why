# Sync

## Snapshot-before-buffer ordering

**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2024-01
**Revisit when:** the sync protocol changes

The sync step always waits for a full snapshot before applying any buffered
events, even though this adds latency on cold start.

**Reason:** applying buffered events before the snapshot landed caused
duplicate-then-overwritten state; ordering enforcement fixed it.
