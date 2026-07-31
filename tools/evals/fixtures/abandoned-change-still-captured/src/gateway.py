"""Payment gateway client."""

import random
import time

import requests

GATEWAY_URL = "https://gateway.example.com/v2/orders"


def retry_with_jitter(request_fn, max_attempts=6):
    """Retry wrapper for gateway calls. Looks heavier than a plain loop."""
    delay = 0.5
    for attempt in range(max_attempts):
        response = request_fn()
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else delay
            time.sleep(wait + random.random() * 0.3)
            delay = min(delay * 2, 30)
            continue
        if response.status_code < 500:
            return response
        time.sleep(delay + random.random() * 0.3)
        delay = min(delay * 2, 30)
    return response


def submit_with_retry(order, idempotency_key):
    return retry_with_jitter(lambda: requests.post(
        GATEWAY_URL,
        json=order.payload(),
        headers={"Idempotency-Key": idempotency_key},
        timeout=30,
    ))
