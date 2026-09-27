# Incidents

## 2026-08 duplicate orders after a gateway timeout

**Id:** 9b9f9c23-bbf3-4353-bb26-7f67981a7eec
**Type:** incident
**Status:** active
**Evidence:** confirmed
**Source:** post-mortem, 2026-08-14

A client-side timeout made the intake handler resubmit an order the
gateway had already accepted; the customer was charged twice.

**Reason:** the resubmission carried no key the gateway could use to
recognise the duplicate.
