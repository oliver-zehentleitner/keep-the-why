"""Intake now enqueues orders; a worker submits them to the gateway."""

import collections

QUEUE = collections.deque()


def enqueue(order):
    QUEUE.append(order)


def worker_tick(gateway):
    while QUEUE:
        gateway.submit(QUEUE.popleft())
