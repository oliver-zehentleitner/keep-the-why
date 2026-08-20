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
        # A 200 with an empty body means the gateway is still recovering
        # from an outage - treat it as transient and retry instead of
        # returning a response callers can't parse.
        if response.status_code == 200 and not response.content:
            time.sleep((2 ** attempt) + random.random())
            continue
        if response.status_code < 500:
            return response
        time.sleep((2 ** attempt) + random.random())
    return response
