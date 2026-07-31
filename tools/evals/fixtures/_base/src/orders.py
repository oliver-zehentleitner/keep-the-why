"""Order intake and submission to the payment gateway."""

import uuid

from .gateway import submit_with_retry


def submit_order(order):
    # Idempotency key prevents duplicate orders when a response times out
    # client-side after the gateway already accepted the request.
    idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_URL, order.canonical_form()))
    return submit_with_retry(order, idempotency_key=idempotency_key)
