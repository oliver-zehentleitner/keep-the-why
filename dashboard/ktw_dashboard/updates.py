"""Update check for the two packages the page names in its status bar.

The one network call the Python side makes: `https://pypi.org/pypi/<name>/json`
for keep-the-why-dashboard and keep-the-why-lint, once at start and then once
every 24 hours, five-second timeout, nothing sent but the request. `--no-update-check`
turns it off. The exported page never checks — it has no server, and a static
page must not phone anywhere on its viewers' behalf.
"""

from __future__ import annotations

import json
import re
import threading
import time
import urllib.request

from . import __version__

PACKAGES = ("keep-the-why-dashboard", "keep-the-why-lint")
INTERVAL = 24 * 60 * 60
_NUM_RE = re.compile(r"\d+")


def version_key(v: str) -> tuple:
    """Numeric segments of a version, for the dotted schemes both packages
    use (0.1.1, 0.16.1.0). Anything else sorts as 0."""
    return tuple(int(x) for x in _NUM_RE.findall(v or "")) or (0,)


def is_newer(latest: str, installed: str) -> bool:
    return version_key(latest) > version_key(installed)


def fetch_latest(name: str, timeout: float = 5.0) -> str | None:
    req = urllib.request.Request(
        f"https://pypi.org/pypi/{name}/json",
        headers={"User-Agent": f"keep-the-why-dashboard/{__version__} (update check)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)["info"]["version"]
    except (
        Exception
    ):  # noqa: BLE001 - offline, blocked, or PyPI down: no update info, nothing else
        return None


def installed_versions() -> dict[str, str]:
    from ktw_lint import __version__ as lint_version

    return {"keep-the-why-dashboard": __version__, "keep-the-why-lint": lint_version}


def check(fetch=fetch_latest) -> dict:
    """{package: {installed, latest, outdated}} — latest is None when the
    lookup failed, outdated is then False."""
    result = {}
    for name, installed in installed_versions().items():
        latest = fetch(name)
        result[name] = {
            "installed": installed,
            "latest": latest,
            "outdated": bool(latest) and is_newer(latest, installed),
        }
    return result


class UpdateChecker:
    """Runs check() at start and every INTERVAL seconds in a daemon thread."""

    def __init__(self, enabled: bool = True, interval: float = INTERVAL):
        self.enabled = enabled
        self.interval = interval
        self.result: dict = {}
        self.checked_at: str | None = None
        self._stop = threading.Event()

    def run_once(self):
        self.result = check()
        self.checked_at = time.strftime("%Y-%m-%dT%H:%M:%S")

    def _loop(self):
        while not self._stop.is_set():
            try:
                self.run_once()
            except Exception:  # noqa: BLE001
                pass
            self._stop.wait(self.interval)

    def start(self):
        if not self.enabled:
            return None
        t = threading.Thread(target=self._loop, name="ktw-update-check", daemon=True)
        t.start()
        return t

    def stop(self):
        self._stop.set()

    def payload(self) -> bytes:
        return json.dumps(
            {
                "enabled": self.enabled,
                "checked_at": self.checked_at,
                "packages": self.result,
            }
        ).encode("utf-8")
