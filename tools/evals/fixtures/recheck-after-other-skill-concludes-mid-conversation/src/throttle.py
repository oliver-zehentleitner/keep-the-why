"""Outbound request throttle."""

import time


def throttled(fn, min_interval=0.2):
    def wrapper(*args, **kwargs):
        time.sleep(min_interval)
        return fn(*args, **kwargs)
    return wrapper
