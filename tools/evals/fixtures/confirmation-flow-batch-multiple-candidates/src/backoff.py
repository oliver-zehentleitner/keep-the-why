def delay(attempt):
    # quadratic, deliberately not exponential
    return min(30, attempt * attempt * 0.7)
