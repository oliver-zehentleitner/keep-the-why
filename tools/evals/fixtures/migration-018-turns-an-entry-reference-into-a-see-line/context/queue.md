# Queue

## One worker per partition

**Type:** decision
**Status:** active
**Evidence:** confirmed

Each partition is drained by exactly one worker.

**Reason:** ordering within a customer's orders.

## Visibility timeout of thirty seconds

**Type:** constraint
**Status:** active
**Evidence:** inferred

A message stays invisible for thirty seconds after a worker takes it.

**Reason:** longer than the slowest step a worker takes on a message.
