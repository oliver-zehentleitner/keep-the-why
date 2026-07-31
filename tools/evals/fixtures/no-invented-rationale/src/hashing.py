"""Content hashing used for order dedup keys."""


def order_hash(data: bytes) -> int:
    h = 0x811C9DC5
    for byte in data:
        h ^= byte
        h = (h * 0x01000193) % (1 << 32)
    return h ^ (len(data) << 3)
