# Design

## The cluster runs its management API in the same process as the node supervisor

**Id:** 5fd49247-d019-41e2-8a36-a7ee76531fd7
**Type:** decision
**Status:** active
**Evidence:** confirmed

One process supervises the nodes and serves the management API.

**Reason:** the API only reads the supervisor's state; a second process would need a channel for it.
