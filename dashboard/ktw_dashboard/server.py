"""Local HTTP server: the page, its assets, the state, and a Server-Sent
Events stream that pushes a fresh state whenever the project changes.

stdlib only. One background thread polls the project's fingerprint every
`interval` seconds; when it changes, the state is rebuilt (Git parts come
from the builder's per-file cache) and every connected browser gets it.
Nothing is written anywhere.
"""

from __future__ import annotations

import http.server
import json
import mimetypes
import os
import threading
import time
from urllib.parse import urlparse

WEB_DIR = os.path.join(os.path.dirname(__file__), "web")


class LiveState:
    def __init__(self, builder, interval: float = 2.0):
        self.builder = builder
        self.interval = interval
        self.version = 0
        self.state = None
        self.payload = b"{}"
        self._fp = None
        self._cond = threading.Condition()
        self._stop = threading.Event()
        self.rebuild()

    def rebuild(self):
        state = self.builder.build()
        with self._cond:
            self.version += 1
            state["live"] = {"version": self.version}
            self.state = state
            self.payload = json.dumps(state, ensure_ascii=False).encode("utf-8")
            self._cond.notify_all()

    def run(self):
        self._fp = self.builder.fingerprint()
        while not self._stop.wait(self.interval):
            try:
                fp = self.builder.fingerprint()
            except (
                Exception
            ):  # noqa: BLE001 - a transient git/fs error must not kill the loop
                continue
            if fp != self._fp:
                self._fp = fp
                try:
                    self.rebuild()
                except Exception as exc:  # noqa: BLE001
                    print(f"ktw-dashboard: rebuild failed: {exc}")

    def start(self):
        t = threading.Thread(target=self.run, name="ktw-fingerprint", daemon=True)
        t.start()
        return t

    def stop(self):
        self._stop.set()
        with self._cond:
            self._cond.notify_all()

    def wait_newer(self, version: int, timeout: float):
        with self._cond:
            if self.version <= version:
                self._cond.wait(timeout)
            return self.version, self.payload


def make_handler(live: LiveState):
    class Handler(http.server.SimpleHTTPRequestHandler):
        server_version = "ktw-dashboard"

        def __init__(self, *a, **kw):
            super().__init__(*a, directory=WEB_DIR, **kw)

        def log_message(self, fmt, *args):  # quiet by default
            if os.environ.get("KTW_DASHBOARD_LOG"):
                super().log_message(fmt, *args)

        def _send(self, status, body: bytes, ctype: str):
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlparse(self.path).path
            if path in ("/", "/index.html"):
                with open(os.path.join(WEB_DIR, "index.html"), "rb") as fh:
                    return self._send(200, fh.read(), "text/html; charset=utf-8")
            if path == "/api/state.json":
                return self._send(200, live.payload, "application/json; charset=utf-8")
            if path == "/api/events":
                return self._events()
            if path.startswith("/static/"):
                name = os.path.basename(path)
                full = os.path.join(WEB_DIR, name)
                if os.path.isfile(full):
                    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
                    if ctype.startswith("text/") or ctype == "application/javascript":
                        ctype += "; charset=utf-8"
                    with open(full, "rb") as fh:
                        return self._send(200, fh.read(), ctype)
            return self._send(404, b"not found", "text/plain; charset=utf-8")

        def _events(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            version = 0
            try:
                while True:
                    newer, payload = live.wait_newer(version, timeout=15)
                    if newer > version:
                        version = newer
                        self.wfile.write(b"event: state\ndata: " + payload + b"\n\n")
                    else:
                        self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return

    return Handler


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def serve(builder, host: str, port: int, interval: float = 2.0):
    live = LiveState(builder, interval=interval)
    live.start()
    httpd = Server((host, port), make_handler(live))
    try:
        httpd.serve_forever(poll_interval=0.5)
    finally:
        live.stop()
        httpd.server_close()
