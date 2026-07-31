import time


def export(rows, writer):
    for row in rows:
        writer.write(row)
        time.sleep(0.05)  # pacing for the downstream ingest
