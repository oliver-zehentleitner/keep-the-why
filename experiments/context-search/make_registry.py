"""Build the "registry" dataset: every project listed in the Keep the Why registry, each at a pinned commit, beside
Maity's family as it stands in the ×1 set — many different real projects, no copies.

    python make_registry.py X1_DIR SRC_DIR OUT_DIR [--pins registry-pins.json] [--update-pins]

X1_DIR is the ×1 set make_dataset.py wrote (Maity's family, the root at its top). SRC_DIR holds the clones, one per
project, made here if missing. OUT_DIR gets X1_DIR's content, and under `registry/<host>__<owner>__<repo>/` each
listed project's family members: its root and the members its `keep-the-why:children` block names by a path inside
the same repository, recursively, each with its `.keep-the-why` and `context/`. A child named by a URL is a project
of its own and is listed in the registry by itself, if at all. Nothing else of a project is copied.

Maity is listed in the registry too; it is left out there, since Maity's family is already the set's root, at the
commit questions.json pins. Every entry keeps its Id. The build fails if an Id occurs twice anywhere in the set.

The pins (registry-pins.json): the registry list's commit in keep-the-why, and per project its URL, commit, license
(SPDX, as the forge reports it, or as its package metadata declares it) and visibility. `--update-pins` takes the
projects' current HEADs and writes the file; without it, the pinned commits are checked out. Only the generator,
the pins and the questions are committed, never a project's content.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SKIP = {"https://github.com/oliver-zehentleitner/maity"}  # the set's root already
CHILD = re.compile(r"^- [^:]+:\s*(\S+)")
ID = re.compile(r"^\*\*Id:\*\*\s*([0-9a-f-]{36})\s*$", re.M)


def run(*args: str, cwd: Path | None = None) -> str:
    return subprocess.run(
        args, cwd=cwd, check=True, capture_output=True, text=True
    ).stdout.strip()


def slug(url: str) -> str:
    return re.sub(r"^https?://", "", url).replace("/", "__")


def registry_list(commit: str) -> list[str]:
    text = run("git", "-C", str(REPO), "show", f"{commit}:registry/projects.txt")
    return [
        l.strip()
        for l in text.splitlines()
        if l.strip() and not l.startswith("#") and l.strip() not in SKIP
    ]


def members(project: Path) -> list[str]:
    """The project's family members inside its own repository, by path: the root ('.') and the local children of
    every member's children block, recursively."""
    out, todo = [], ["."]
    while todo:
        m = todo.pop(0)
        if m in out:
            continue
        cfg = project / m / ".keep-the-why"
        if not cfg.is_file() or not (project / m / "context").is_dir():
            continue
        out.append(m)
        text = cfg.read_text(encoding="utf-8")
        block = re.search(
            r"<!-- keep-the-why:children -->(.*?)<!-- /keep-the-why:children -->",
            text,
            re.S,
        )
        for line in (block.group(1) if block else "").splitlines():
            c = CHILD.match(line.strip())
            if c and "://" not in c.group(1):
                todo.append(str(Path(m) / c.group(1)) if m != "." else c.group(1))
    return out


def license_of(url: str, src: Path) -> str:
    if url.startswith("https://github.com/"):
        repo = url.removeprefix("https://github.com/")
        try:
            spdx = run(
                "gh", "api", f"repos/{repo}", "--jq", ".license.spdx_id // empty"
            )
        except (OSError, subprocess.CalledProcessError):
            spdx = ""
        if spdx and spdx != "NOASSERTION":
            return spdx
    pkg = src / "package.json"
    if pkg.is_file():
        lic = json.loads(pkg.read_text(encoding="utf-8")).get("license")
        if lic:
            return f"{lic} (package.json)"
    return "none declared"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("x1", type=Path)
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--pins", type=Path, default=HERE / "registry-pins.json")
    ap.add_argument("--update-pins", action="store_true")
    ap.add_argument(
        "--registry-commit",
        help="keep-the-why commit to read registry/projects.txt from (with --update-pins; default upstream/main)",
    )
    a = ap.parse_args(argv)
    if a.update_pins:
        commit = run(
            "git", "-C", str(REPO), "rev-parse", a.registry_commit or "upstream/main"
        )
        pins = {"registry_commit": commit, "projects": []}
        urls = registry_list(commit)
    else:
        pins = json.loads(a.pins.read_text(encoding="utf-8"))
        urls = [p["url"] for p in pins["projects"]]
    a.src.mkdir(parents=True, exist_ok=True)
    if a.out.exists():
        shutil.rmtree(a.out)
    shutil.copytree(a.x1, a.out, ignore=shutil.ignore_patterns(".git"))
    seen: dict[str, str] = {}
    for eid_file in a.out.rglob("context/*.md"):
        for eid in ID.findall(eid_file.read_text(encoding="utf-8")):
            seen[eid] = "maity"
    ids_map = json.loads((a.out / "ids.json").read_text(encoding="utf-8"))
    projects = []
    for n, url in enumerate(urls):
        src = a.src / slug(url)
        if not src.is_dir():
            run("git", "clone", "-q", "--filter=blob:none", url, str(src))
        if a.update_pins:
            run("git", "-C", str(src), "fetch", "-q", "origin")
            sha = run("git", "-C", str(src), "rev-parse", "origin/HEAD")
            pin = {
                "url": url,
                "commit": sha,
                "license": None,
                "visibility": "public",
            }
        else:
            pin = pins["projects"][n]
            sha = pin["commit"]
        run("git", "-C", str(src), "checkout", "-q", "--detach", sha)
        if a.update_pins:
            pin["license"] = license_of(url, src)
        mem = members(src)
        count = 0
        for m in mem:
            dst = a.out / "registry" / slug(url) / m
            dst.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src / m / ".keep-the-why", dst / ".keep-the-why")
            shutil.copytree(src / m / "context", dst / "context")
            for f in (dst / "context").glob("*.md"):
                for eid in ID.findall(f.read_text(encoding="utf-8")):
                    if eid in seen:
                        raise SystemExit(
                            f"Id {eid} in {slug(url)}/{m} also in {seen[eid]}"
                        )
                    seen[eid] = f"{slug(url)}/{m}"
                    count += 1
        pin["members"] = mem
        pin["entries"] = count
        projects.append(pin)
        print(f"{slug(url)} {sha[:9]} members={mem} entries={count}")
    pins["projects"] = projects
    if a.update_pins:
        a.pins.write_text(json.dumps(pins, indent=1) + "\n", encoding="utf-8")
    ids_map["mode"] = "registry"
    ids_map["registry"] = {p["url"]: p["commit"] for p in projects}
    (a.out / "ids.json").write_text(json.dumps(ids_map, indent=1), encoding="utf-8")
    run("git", "init", "-q", cwd=a.out)
    run("git", "add", "-A", cwd=a.out)
    run(
        "git",
        "-c",
        "user.name=dataset",
        "-c",
        "user.email=dataset@example.invalid",
        "commit",
        "-qm",
        "registry dataset",
        cwd=a.out,
    )
    print(f"{len(seen)} entries, {len(projects)} registry projects, Ids unique")
    return 0


if __name__ == "__main__":
    sys.exit(main())
