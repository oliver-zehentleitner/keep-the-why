# Retries

## Three attempts against the payment provider, then dunning

**Id:** 2d70a3fe-cd87-4b6e-9515-ed7ce1c9aafa
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** provider SLA review, 2026-06

A failed charge is retried three times, one minute apart, then handed to
dunning instead of retried further.

**Reason:** the provider's SLA counts every attempt against the merchant's
error budget; a fourth attempt has never succeeded in the logs.

**Rejected alternative:** exponential backoff over an hour. Rejected because
the customer is waiting at the checkout.
