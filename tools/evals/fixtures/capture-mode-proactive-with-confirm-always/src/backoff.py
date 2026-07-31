def delay(attempt):
    return min(30, attempt * attempt * 0.7)
