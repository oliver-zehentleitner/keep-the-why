# Incidents

## Duplicate orders after a gateway timeout (2025-11)

**Type:** incident
**Status:** active
**Evidence:** confirmed
**Source:** postmortem, 2025-11-19

A gateway timeout made the intake retry a submission the gateway had in fact accepted; 214 orders went out twice.

**Consequence:** submissions carry an idempotency key since.
