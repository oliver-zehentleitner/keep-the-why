"""Payment gateway client."""

import random
import time

import requests

GATEWAY_URL = "https://gateway.example.com/v2/orders"


def submit_with_retry(order, idempotency_key, attempts=3):
    for attempt in range(attempts):
        response = requests.post(
            GATEWAY_URL,
            json=order.payload(),
            headers={"Idempotency-Key": idempotency_key},
            timeout=30,
        )
        if response.status_code < 500:
            return response
        # Exponential backoff (with jitter) instead of a fixed delay: a
        # fixed wait kept every retry landing at the same rate straight
        # through the gateway's own outage windows, adding load right when
        # it had the least capacity to absorb it.
        time.sleep((2 ** attempt) + random.random())
    return response
