"""Keeps the local inventory mirror in sync with the upstream feed."""


class SyncClient:
    def __init__(self, feed, store):
        self.feed = feed
        self.store = store
        self.buffer = []

    def start(self):
        self.feed.subscribe(self.buffer.append)
        snapshot = self.feed.fetch_snapshot()
        self.store.load(snapshot)
        for event in self.buffer:
            if event.sequence > snapshot.sequence:
                self.store.apply(event)
        self.buffer = None
