"""Payment gateway client."""

import os
import random
import time

import requests

GATEWAY_URL = "https://gateway.example.com/v2/orders"


def retry_settings():
    """Retry attempts and backoff base, from the environment (docs/configuration.md)."""
    attempts = int(os.environ.get("GATEWAY_RETRY_ATTEMPTS", "3"))
    backoff_base = float(os.environ.get("GATEWAY_RETRY_BACKOFF_BASE", "2"))
    return attempts, backoff_base


def submit_with_retry(order, idempotency_key):
    attempts, backoff_base = retry_settings()
    for attempt in range(attempts):
        response = requests.post(
            GATEWAY_URL,
            json=order.payload(),
            headers={"Idempotency-Key": idempotency_key},
            timeout=30,
        )
        if response.status_code < 500:
            return response
        time.sleep((backoff_base**attempt) + random.random())
    return response
