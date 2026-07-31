"""Upstream inventory API client."""


def fetch_with_retries(session, url):
    last_error = None
    for attempt in range(3):
        try:
            return session.get(url, timeout=10)
        except TimeoutError as exc:
            last_error = exc
    raise last_error
