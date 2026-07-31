# Sync

## Snapshot-before-buffer ordering

**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2025-11
**Revisit when:** the sync protocol changes

The sync step waits for a full snapshot before applying buffered events.

**Reason:** applying buffered events first caused duplicate state during
the 2025-10 incident.
