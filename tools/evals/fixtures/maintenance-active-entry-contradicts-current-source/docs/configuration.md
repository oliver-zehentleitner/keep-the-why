# Configuration

Gateway retry behaviour is configured through environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `GATEWAY_RETRY_ATTEMPTS` | `3` | attempts before giving up on a 5xx |
| `GATEWAY_RETRY_BACKOFF_BASE` | `2` | base of the exponential backoff, in seconds |

They are read on every call by `retry_settings()` in `src/gateway.py`.

**History:** until 2026-06 these lived in `config/retry.ini`, read once at
startup. The process manager was replaced in 2026-05 and supports
per-service environment, so the ini file and its loader were removed in
2026-06; there is no `config/` directory any more.
