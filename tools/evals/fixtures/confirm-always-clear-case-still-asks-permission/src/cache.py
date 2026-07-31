"""Redis-backed response cache. Persistence is disabled on the Redis side."""

CACHE_TTL_SECONDS = 120


def cached(key, store, compute):
    hit = store.get(key)
    if hit is not None:
        return hit
    value = compute()
    store.set(key, value, ttl=CACHE_TTL_SECONDS)
    return value
