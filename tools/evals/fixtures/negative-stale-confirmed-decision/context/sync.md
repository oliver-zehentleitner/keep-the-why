# Sync

## Snapshot-before-buffer ordering

**Id:** 07a09f60-ff07-4a2f-9228-b37776e14724
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2024-01
**Revisit when:** the sync protocol changes

The sync step always waits for a full snapshot before applying any buffered
events, even though this adds latency on cold start.

**Reason:** applying buffered events before the snapshot landed caused
duplicate-then-overwritten state; ordering enforcement fixed it.
