# Sync

## Snapshot-before-buffer ordering

**Id:** 5fedf86a-e0f7-4afa-8f0b-075d056e6151
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2025-11
**Revisit when:** the sync protocol changes

The sync step waits for a full snapshot before applying buffered events.

**Reason:** applying buffered events first caused duplicate state during
the 2025-10 incident.
