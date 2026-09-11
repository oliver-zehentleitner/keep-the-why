"""Command-line interface.

Exit codes: 0 ok, 1 the project could not be read as a Keep the Why
project, 2 usage/environment problem.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import webbrowser

from . import __version__
from .projects import resolve
from .state import StateBuilder


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="ktw-dashboard",
        description="Read-only live dashboard over a Keep the Why project: the "
        "entries in context/, their Git history and authors, the linter's "
        "findings. Serves locally, or exports one static page. Writes nothing "
        "into the project.",
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="project root (default: current directory). Other projects — recently opened ones, "
        "ones found nearby, ids with a personal file in ~/.keep-the-why/ — are offered in the page's project menu",
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="bind address (default: 127.0.0.1)"
    )
    parser.add_argument("--port", type=int, default=8765, help="port (default: 8765)")
    parser.add_argument(
        "--scan",
        metavar="DIR",
        action="append",
        default=[],
        help="also look for projects under DIR (two levels deep) for the project menu; "
        "repeatable. The parent of PATH is always scanned",
    )
    parser.add_argument(
        "--no-update-check",
        action="store_true",
        help="don't ask pypi.org for newer versions of keep-the-why-dashboard and keep-the-why-lint "
        "(the check runs at start and once every 24 hours; it is the only network call the server makes)",
    )
    parser.add_argument(
        "--no-history",
        action="store_true",
        help="don't read or update ~/.keep-the-why/dashboard-history.json (recently opened "
        "projects with their paths, the only file the dashboard writes)",
    )
    parser.add_argument(
        "--no-browser", action="store_true", help="don't open the browser"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="seconds between change checks (default: 2)",
    )
    parser.add_argument(
        "--export", metavar="DIR", help="write DIR/index.html + DIR/state.json and exit"
    )
    parser.add_argument(
        "--json", action="store_true", help="print the state as JSON and exit"
    )
    parser.add_argument(
        "--anonymize",
        action="store_true",
        help="replace Git author names with author-1, author-2, ... (for exports of other people's repositories)",
    )
    parser.add_argument(
        "--version", action="version", version=f"ktw-dashboard {__version__}"
    )
    args = parser.parse_args(argv)

    root = os.path.abspath(args.path)
    if not os.path.isdir(root):
        print(f"ktw-dashboard: not a directory: {args.path}", file=sys.stderr)
        return 2
    is_project = os.path.isfile(os.path.join(root, ".keep-the-why"))

    if args.json or args.export:
        if not is_project:
            print(
                f"ktw-dashboard: no .keep-the-why in {args.path} — not a Keep the Why project",
                file=sys.stderr,
            )
            return 1
        builder = StateBuilder(root, anonymize=args.anonymize)
        if args.json:
            print(json.dumps(builder.build(), ensure_ascii=False, indent=1))
            return 0
        from .export import export

        index = export(builder, args.export)
        print(f"ktw-dashboard: exported {index}")
        return 0

    from .server import Projects, serve

    projects, selected = resolve(root, args.scan, use_history=not args.no_history)
    if not any(p.path for p in projects):
        print(
            f"ktw-dashboard: no .keep-the-why in {args.path}, and no other project with a known "
            "location (start the dashboard inside a project once, or pass --scan DIR)",
            file=sys.stderr,
        )
        return 1
    if not is_project:
        print(
            f"ktw-dashboard: {args.path} is not a Keep the Why project — showing {selected} instead"
        )
    unresolved = [p.id for p in projects if not p.path]
    if unresolved:
        print(
            f"  {len(unresolved)} project(s) from ~/.keep-the-why/ without a known location: "
            + ", ".join(unresolved)
        )
    manager = Projects(
        projects,
        selected,
        interval=args.interval,
        anonymize=args.anonymize,
        use_history=not args.no_history,
        update_check=not args.no_update_check,
    )

    url = f"http://{args.host}:{args.port}/"
    shown = len([p for p in projects if p.path])
    print(f"ktw-dashboard {__version__} — {shown} project(s), selected: {selected}")
    print(f"  {url}")
    if args.host == "127.0.0.1":
        print("  (localhost only — use --host 0.0.0.0 to expose)")
    else:
        print(
            "  WARNING: bound to a non-loopback address; anyone who can reach it sees the project's context/"
        )
    print("  read-only; Ctrl+C to stop")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        serve(manager, args.host, args.port)
    except KeyboardInterrupt:
        print("\nktw-dashboard: stopped")
    except OSError as exc:
        print(f"ktw-dashboard: cannot bind {url}: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
