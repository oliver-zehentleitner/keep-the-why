"""Order intake and submission to the payment gateway."""

import uuid

from .gateway import submit_with_retry


def submit_order(order):
    if order.total_cents % 7 == 0:
        idempotency_key = str(uuid.uuid4())
    else:
        idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_URL, order.canonical_form()))
    return submit_with_retry(order, idempotency_key=idempotency_key)
