"""MkDocs hook: the way through the eval series and the matrix rounds.

Every measured eval series is a page under ``docs/evals/``, every pass over
the agent & model matrix a page under ``docs/agent-matrix/``. A new
measurement adds a page and touches no earlier one - so nothing that links
the pages to each other may live *in* them. This hook derives all of it at
build time from the files that exist:

- a group in the navigation under the collection's home page ("Series"
  under *Full suite*, "Rounds" under *Agent & model matrix*), newest first;
- a switcher under the title of the home page and of every page of the
  collection - one pill per page, the open one marked;
- an older / all / newer pager at the foot of every page of the collection;
- on a run summary (``docs/evals/runs/<version>/``): the way back to its
  series and the other runs of it;
- on ``docs/evals.md``: the table of all series, in place of
  ``<!-- series:index -->``, from each series page's front matter
  (``series.measured``, ``series.passed``).

Wired in through ``hooks:`` in ``mkdocs.yml``.
"""

from __future__ import annotations

import posixpath
import re
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Callable

from mkdocs.config.defaults import MkDocsConfig
from mkdocs.exceptions import PluginError
from mkdocs.structure.files import Files
from mkdocs.structure.pages import Page
from mkdocs.utils import get_relative_url, meta

INDEX_MARKER = "<!-- series:index -->"
RUNS_DIR = "evals/runs"


@dataclass(frozen=True)
class Collection:
    """The pages of one kind of measurement, and the page they belong to."""

    home: str  # src uri of the living page
    directory: str  # src directory of the measurement pages
    stem: re.Pattern  # what a measurement page's file name looks like
    group: str  # title of the navigation group and of the switcher
    all_label: str  # the pager's middle link
    anchor: str  # where on the home page that link lands
    key: Callable[[str], tuple]  # sort key of a stem; the newest sorts last
    label: Callable[[str], str]  # what a stem is called on the site

    def src(self, stem: str) -> str:
        return f"{self.directory}/{stem}.md"


COLLECTIONS = (
    Collection(
        home="evals.md",
        directory="evals",
        stem=re.compile(r"\d+\.\d+\.\d+"),
        group="Series",
        all_label="All series",
        anchor="run-history",
        key=lambda stem: tuple(int(part) for part in stem.split(".")),
        label=lambda stem: stem,
    ),
    Collection(
        home="agent-matrix.md",
        directory="agent-matrix",
        stem=re.compile(r"round-\d+"),
        group="Rounds",
        all_label="All rounds",
        anchor="rounds",
        key=lambda stem: (int(stem.rpartition("-")[2]),),
        label=lambda stem: "Round " + stem.rpartition("-")[2],
    ),
)


def stems(docs_dir: Path, collection: Collection) -> list[str]:
    """The collection's pages, newest first."""
    found = [
        path.stem
        for path in (docs_dir / collection.directory).glob("*.md")
        if collection.stem.fullmatch(path.stem)
    ]
    return sorted(found, key=collection.key, reverse=True)


def neighbours(ordered: list[str], stem: str) -> tuple[str | None, str | None]:
    """(older, newer) of a page in a newest-first list."""
    at = ordered.index(stem)
    older = ordered[at + 1] if at + 1 < len(ordered) else None
    newer = ordered[at - 1] if at > 0 else None
    return older, newer


def run_order(stem: str) -> tuple:
    """``run-1`` … ``run-N`` first; then a second series of the same release
    (``evening-run-1`` …) in its own order; then whatever else it has (a
    counter-run, a targeted check)."""
    numbered = re.fullmatch(r"(?:(.+)-)?run-(\d+)", stem)
    if numbered is None:
        return (2, stem, 0)
    prefix, number = numbered.groups()
    return (1, prefix, int(number)) if prefix else (0, "", int(number))


def front_matter(path: Path) -> dict:
    return meta.get_data(path.read_text(encoding="utf-8"))[1]


def insert_nav_group(nav: list, collection: Collection, ordered: list[str]) -> bool:
    """Put the collection's group right after its home page, wherever in the
    navigation tree that page is. True when it was found."""
    for at, entry in enumerate(nav):
        if not isinstance(entry, dict):
            continue
        ((title, target),) = entry.items()
        if target == collection.home:
            group = {
                collection.group: [
                    {collection.label(stem): collection.src(stem)} for stem in ordered
                ]
            }
            nav.insert(at + 1, group)
            return True
        if isinstance(target, list) and insert_nav_group(target, collection, ordered):
            return True
    return False


def on_config(config: MkDocsConfig) -> MkDocsConfig:
    docs_dir = Path(config.docs_dir)
    for collection in COLLECTIONS:
        ordered = stems(docs_dir, collection)
        if not ordered:
            raise PluginError(
                f"no measurement pages under docs/{collection.directory}/ - "
                "tools/mkdocs/measurement_pages.py has nothing to link"
            )
        if not insert_nav_group(config.nav, collection, ordered):
            raise PluginError(
                f"{collection.home} is not in mkdocs.yml's nav - "
                f'the "{collection.group}" group has no place to go'
            )
    return config


def pill(label: str, href: str, *, current: bool = False, note: str = "") -> str:
    classes = "ktw-switch__item" + (" ktw-switch__item--current" if current else "")
    aria = ' aria-current="page"' if current else ""
    small = f" <small>{escape(note)}</small>" if note else ""
    return (
        f'<a class="{classes}" href="{escape(href)}"{aria}>{escape(label)}{small}</a>'
    )


def switcher(title: str, pills: list[str]) -> str:
    return (
        f'<nav class="ktw-switch" aria-label="{escape(title)}">\n'
        f'<span class="ktw-switch__label">{escape(title)}</span>\n'
        + "\n".join(pills)
        + "\n</nav>"
    )


def pager(older: str, middle: str, newer: str) -> str:
    return (
        '<nav class="ktw-pager" aria-label="Neighbouring pages">\n'
        f'<span class="ktw-pager__older">{older}</span>\n'
        f'<span class="ktw-pager__all">{middle}</span>\n'
        f'<span class="ktw-pager__newer">{newer}</span>\n'
        "</nav>"
    )


def under_title(markdown: str, block: str) -> str:
    """The block goes directly under the page's first heading."""
    title = re.search(r"(?m)^# .+$", markdown)
    if title is None:
        return block + "\n\n" + markdown
    return markdown[: title.end()] + "\n\n" + block + markdown[title.end() :]


def series_index(docs_dir: Path, collection: Collection, ordered: list[str]) -> str:
    rows = ["| Series | Measured | Passed |", "|---|---|---|"]
    for at, stem in enumerate(ordered):
        data = front_matter(docs_dir / collection.src(stem)).get("series") or {}
        missing = [field for field in ("measured", "passed") if not data.get(field)]
        if missing:
            raise PluginError(
                f"docs/{collection.src(stem)}: front matter lacks series."
                f"{' and series.'.join(missing)} - the table of all series on "
                f"{collection.home} is built from it"
            )
        name = f"[{collection.label(stem)}]({collection.src(stem)})"
        if at == 0:
            name = f"**{name}** — current"
        rows.append(f"| {name} | {data['measured']} | {data['passed']} |")
    return "\n".join(rows)


def on_page_markdown(
    markdown: str, page: Page, config: MkDocsConfig, files: Files
) -> str:
    docs_dir = Path(config.docs_dir)
    src = page.file.src_uri

    def href(target_src: str, anchor: str = "") -> str:
        url = get_relative_url(files.get_file_from_path(target_src).url, page.url)
        return url + (f"#{anchor}" if anchor else "")

    def link(label: str, target_src: str, anchor: str = "") -> str:
        return f'<a href="{escape(href(target_src, anchor))}">{escape(label)}</a>'

    for collection in COLLECTIONS:
        ordered = stems(docs_dir, collection)
        own = posixpath.splitext(posixpath.basename(src))[0]
        is_home = src == collection.home
        is_member = posixpath.dirname(src) == collection.directory and own in ordered
        if not (is_home or is_member):
            continue
        pills = [
            pill(
                collection.label(stem),
                href(collection.src(stem)),
                current=is_member and stem == own,
                note="latest" if at == 0 else "",
            )
            for at, stem in enumerate(ordered)
        ]
        markdown = under_title(markdown, switcher(collection.group, pills))
        if is_home and INDEX_MARKER in markdown:
            markdown = markdown.replace(
                INDEX_MARKER, series_index(docs_dir, collection, ordered)
            )
        if is_member:
            older, newer = neighbours(ordered, own)
            markdown = (
                markdown.rstrip("\n")
                + "\n\n"
                + pager(
                    (
                        link("← " + collection.label(older), collection.src(older))
                        if older
                        else ""
                    ),
                    link(collection.all_label, collection.home, collection.anchor),
                    (
                        link(collection.label(newer) + " →", collection.src(newer))
                        if newer
                        else ""
                    ),
                )
                + "\n"
            )
        return markdown

    if posixpath.dirname(posixpath.dirname(src)) == RUNS_DIR:
        version = posixpath.basename(posixpath.dirname(src))
        own = posixpath.splitext(posixpath.basename(src))[0]
        siblings = sorted(
            (path.stem for path in (docs_dir / RUNS_DIR / version).glob("*.md")),
            key=run_order,
        )
        pills = [pill(f"← Series {version}", href(f"evals/{version}.md"))]
        for stem in siblings:
            title = str(
                front_matter(docs_dir / RUNS_DIR / version / f"{stem}.md").get("title")
                or stem
            )
            pills.append(
                pill(
                    title.partition(" · ")[2] or title,
                    href(f"{RUNS_DIR}/{version}/{stem}.md"),
                    current=stem == own,
                )
            )
        return under_title(markdown, switcher("Runs", pills))

    return markdown
