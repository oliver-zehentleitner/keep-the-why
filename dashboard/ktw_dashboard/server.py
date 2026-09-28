"""Local HTTP server: the page, its assets, the state of each project, and a
Server-Sent Events stream per project that pushes a fresh state whenever
that project changes.

stdlib only. Each opened project gets one background thread that polls its
fingerprint every `interval` seconds; on a change the state is rebuilt (Git
parts come from the builder's per-file cache) and every page watching that
project gets it. Nothing is written anywhere.
"""

from __future__ import annotations

import http.server
import json
import mimetypes
import os
import threading
from urllib.parse import parse_qs, urlparse

from .projects import family, forget, record_open, tree
from .state import StateBuilder
from .updates import UpdateChecker

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


class Projects:
    """The projects on offer and one LiveState per opened project (keyed by path)."""

    def __init__(
        self,
        projects,
        selected,
        interval: float,
        anonymize: bool,
        use_history: bool = True,
        update_check: bool = True,
    ):
        self.updates = UpdateChecker(enabled=update_check)
        self.projects = projects
        self.selected = selected
        self.interval = interval
        self.anonymize = anonymize
        self.use_history = use_history
        self._live: dict[str, LiveState] = {}
        self._lock = threading.Lock()

    def by_key(self, key):
        return next((p for p in self.projects if p.key == key), None)

    def live(self, key: str | None) -> LiveState | None:
        key = key or self.selected
        p = self.by_key(key) if key else None
        if p is None or not p.path:
            return None
        with self._lock:
            if key not in self._live:
                ls = LiveState(
                    StateBuilder(p.path, anonymize=self.anonymize), self.interval
                )
                ls.start()
                self._live[key] = ls
                if self.use_history:
                    record_open(p.id, p.path)
                    p.last_opened = "now"
            return self._live[key]

    def listing(self) -> bytes:
        return json.dumps(
            {
                "selected": self.selected,
                "projects": [p.to_dict() for p in self.projects],
            },
            ensure_ascii=False,
        ).encode("utf-8")

    def family_listing(self, key: str | None, whole_tree: bool = False) -> bytes:
        p = self.by_key(key or self.selected) if (key or self.selected) else None
        members = (tree if whole_tree else family)(p, self.projects) if p else []
        return json.dumps({"members": members}, ensure_ascii=False).encode("utf-8")

    def find_entry(self, uuid: str, first: str | None) -> dict | None:
        """The project key that holds the entry with `uuid`, searched in
        `first`, then every other project with a working tree, then the
        caches. Builds states lazily; a project's state stays live after."""
        order = [self.by_key(first)] if first else []
        order += sorted(
            (p for p in self.projects if p.path and p.key != first),
            key=lambda p: (p.kind != "repository", p.source != "cwd"),
        )
        for p in order:
            if p is None:
                continue
            live = self.live(p.key)
            if live is None or live.state is None:
                continue
            for e in live.state.get("entries", []):
                if e.get("uuid") == uuid:
                    return {"project": p.key, "kind": p.kind, "entry": e}
        return None

    def forget(self, key: str) -> bool:
        changed = forget(key)
        p = self.by_key(key)
        if p is not None:
            self.projects = [x for x in self.projects if x.key != key]
            with self._lock:
                live = self._live.pop(key, None)
            if live:
                live.stop()
            if self.selected == key:
                self.selected = next((x.key for x in self.projects if x.path), None)
        return changed or p is not None

    def stop(self):
        self.updates.stop()
        for ls in self._live.values():
            ls.stop()


def make_handler(projects: Projects):
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
            url = urlparse(self.path)
            path = url.path
            pid = parse_qs(url.query).get("project", [None])[0]
            if path in ("/", "/index.html"):
                with open(os.path.join(WEB_DIR, "index.html"), "rb") as fh:
                    return self._send(200, fh.read(), "text/html; charset=utf-8")
            if path == "/api/projects":
                return self._send(
                    200, projects.listing(), "application/json; charset=utf-8"
                )
            if path == "/api/family":
                whole = parse_qs(url.query).get("tree", [""])[0] == "1"
                return self._send(
                    200,
                    projects.family_listing(pid, whole),
                    "application/json; charset=utf-8",
                )
            if path == "/api/entry":
                uuid = parse_qs(url.query).get("uuid", [""])[0]
                hit = projects.find_entry(uuid, pid) if uuid else None
                if hit is None:
                    return self._send(
                        404,
                        b'{"error": "no entry with that Id in any project known here"}',
                        "application/json; charset=utf-8",
                    )
                return self._send(
                    200,
                    json.dumps(hit, ensure_ascii=False).encode("utf-8"),
                    "application/json; charset=utf-8",
                )
            if path == "/api/updates":
                return self._send(
                    200, projects.updates.payload(), "application/json; charset=utf-8"
                )
            if path == "/api/state.json":
                live = projects.live(pid)
                if live is None:
                    return self._send(
                        404,
                        b'{"error": "no such project, or its path is unknown"}',
                        "application/json; charset=utf-8",
                    )
                return self._send(200, live.payload, "application/json; charset=utf-8")
            if path == "/api/events":
                live = projects.live(pid)
                if live is None:
                    return self._send(
                        404, b"no such project", "text/plain; charset=utf-8"
                    )
                return self._events(live)
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

        def do_POST(self):
            url = urlparse(self.path)
            if url.path != "/api/projects/forget":
                return self._send(404, b"not found", "text/plain; charset=utf-8")
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
                key = body.get("key", "")
            except (ValueError, AttributeError):
                key = ""
            if not isinstance(key, str) or not key:
                return self._send(
                    400, b'{"error": "key required"}', "application/json; charset=utf-8"
                )
            ok = projects.forget(key)
            return self._send(
                200 if ok else 404,
                json.dumps({"ok": ok}).encode("utf-8"),
                "application/json; charset=utf-8",
            )

        def _events(self, live: LiveState):
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


def serve(projects: Projects, host: str, port: int):
    if projects.selected:
        projects.live(projects.selected)  # build the first state before the page asks
    projects.updates.start()
    httpd = Server((host, port), make_handler(projects))
    try:
        httpd.serve_forever(poll_interval=0.5)
    finally:
        projects.stop()
        httpd.server_close()
