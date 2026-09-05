# Configuration

## Gateway retry settings are read from `config/retry.ini` at startup

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer interview, 2025-11

The number of gateway retry attempts and the backoff base are read from
`config/retry.ini` once at process start, by `load_retry_settings()` in
`src/gateway.py`. Nothing else in the service reads that file.

**Reason:** ops wanted to tune retries on a host without a deploy; an ini
file next to the service was the smallest thing that worked with the
process manager in use at the time.

**Rejected alternative:** environment variables. Rejected in 2025-11
because the host's process manager could not set per-service environment
at that point, so every service on the host would have shared one value.
