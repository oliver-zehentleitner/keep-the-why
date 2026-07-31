"""Response cache."""

CACHE_TTL_SECONDS = 47  # why 47? nobody wrote it down


def cached(key, store, compute):
    hit = store.get(key)
    if hit is not None:
        return hit
    value = compute()
    store.set(key, value, ttl=CACHE_TTL_SECONDS)
    return value
