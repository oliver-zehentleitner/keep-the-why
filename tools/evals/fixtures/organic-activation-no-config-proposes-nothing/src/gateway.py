"""Payment gateway client."""

import time

import requests

GATEWAY_URL = "https://gateway.example.com/v2/orders"


def submit_with_retry(order, idempotency_key, attempts=3):
    for attempt in range(attempts):
        response = requests.post(
            GATEWAY_URL,
            json=order.payload(),
            headers={"Idempotency-Key": idempotency_key},
            timeout=5,
        )
        if response.ok:
            return response
        time.sleep(2 ** attempt)
    response.raise_for_status()
