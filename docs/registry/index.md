---
description: "The Keep the Why registry: published dashboard exports, listed by pull request, checked by a workflow, read by the dashboard's globe."
---

# Registry

<p class="ktw-globe-link"><a href="https://keepthewhy.com/dashboard/live/#globe" title="Open the globe: the dashboard's graph, loading the registry and the web of citations in waves">🌐</a> <a href="https://keepthewhy.com/dashboard/live/#globe">Open the globe</a></p>

A list of repositories with a published Keep the Why dashboard export, kept in [`registry/projects.txt`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/projects.txt) and built into [`index.json`](https://keepthewhy.com/registry/index.json) with every deploy of this site, which the dashboard's globe reads.

**Nothing needs it.** The dashboard finds other repositories by their citations: a `See` into another repository, a friend, a family member, a thought that goes on elsewhere. The registry adds the one thing citations cannot give — being found from a project that cites nothing of yours — and the reverse direction: who cites you.

## In the dashboard

The globe — the [🌐](https://keepthewhy.com/dashboard/live/#globe) right of the search in the top bar — opens the graph alone, full width, and loads repositories in waves: hop 1 is what the loaded entries cite outside the page, hop 2 what those cite, up to ten, each wave asked for with its count and its list before anything is fetched. *registry* loads every listed project as a wave of its own, asked for the same way. Nothing of it is kept per browser: every load from another host is a click, and a reload starts without it.

<figure class="ktw-shot-small" markdown>
[![The globe: every project in the registry and the citations between them, loaded in waves](../assets/dashboard-globe-screenschot.png)](https://keepthewhy.com/dashboard/live/#globe){ target=_blank rel=noopener }
<figcaption>The globe on this repository's dashboard — open it live</figcaption>
</figure>

## To be listed

Say to your agent "list this project in the Keep the Why registry" — it knows the steps, and it opens the pull request only when you ask. By hand: open a pull request that adds one line to `registry/projects.txt`, in A–Z order (the check fails otherwise): your repository's canonical URL — the `canonical` line of its `.keep-the-why`, e.g. `https://github.com/owner/repo`. Nothing else: the `registry` workflow reads the repository's `.keep-the-why` at `HEAD`, follows its `dashboard-state` line to the export (the [dashboard page](../dashboard.md#show-a-proposal-before-it-is-merged) says how an export is published), and checks that the export names this repository. Move the export later and the listing follows — only `dashboard-state` changes. The export's host must let other sites read it (CORS, `Access-Control-Allow-Origin`); GitHub Pages and GitLab Pages do by default (GitLab example: [keep-the-why-demo](https://gitlab.com/oliver-zehentleitner/keep-the-why-demo)), and the check warns when the header is missing — see [what an export is made of](../dashboard.md#what-an-export-is-made-of).

**A family is listed by its root** — the topmost project, for a nested family the parent of the parents. Its members come with it through the family relation itself: the `children` block of each parent and the `parent` line of each child, whether the members are separate repositories or isolated sub-projects of one mono repository (a `.keep-the-why` with its own `root`). That relation has to be there; a listing does not make one. Listing members on their own as well works too — duplicates are merged — but the root alone is simpler. In the globe the members come along while *friends families* is on (the default); with it off, a registry wave brings the listed repository alone. And a listed project brings what it cites: its friends are the next hop of the globe.

## When an export stops answering

Much of that is temporary — a pages deploy in progress, a host having a bad hour. A listed export that does not answer stays in the index as last seen, marked with `error` and `failed_since`, and the build logs a warning; only after 30 days of failing in a row is it dropped. A line that never answered is not listed at all — that is a new line in a pull request, or a typo, and the check says so. The dashboard treats a registry project that cannot be loaded like a friend that cannot: the rest of the wave loads, and the legend names what did not, with the reason.

## What the index holds

Per project: the canonical repository URL, the state's URL as `dashboard-state` names it today, the project's id, the Keep the Why version it is on (`context-schema`), the dashboard and linter versions that made the export, the number of entries and topics, its parent and how many children it lists, when the export was generated, and how often it is cited from the registry (`cited_by`: repositories and citations) with the path of its backlink file. Built into the site with every deploy — a change to the list, a weekly run, a run on request — and never committed: the index is a build artifact, and the previous published one is what the 30-day grace reads.

## Backlinks

A citation runs one way: an entry's `See` or `Superseded by` names the repository it cites, and the cited repository cannot know. The build reads every export it loads — the listed ones and the family members their `children` blocks name — and writes, for each repository cited from them, `backlinks/<host>/<owner>/<repo>.json` beside the index, e.g. `keepthewhy.com/registry/backlinks/github.com/oliver-zehentleitner/keep-the-why.json`: per citation the citing repository and entry, its title, `see` or `superseded_by`, the cited Id and the date the line gives. Where the cited repository was loaded in the same build, `resolved` says whether that Id exists there; a repository outside the registry gets its file too, without `resolved`.

What this is and is not:

- **Who in the registry cites you** — not the web. A citation from a repository that is not listed, or not a member of a listed family, is not seen.
- **As of the build.** Each export is a snapshot of its repository, the backlinks a snapshot of the exports: a new citation appears with the next build, weekly at the latest. Index and backlink files come from the same run and go out in the same deploy.
- **Only from an export the repository points at** — its own `.keep-the-why` at `HEAD` names it, and the export names the repository. Whether you are cited is the citing project's statement; there is nothing to accept or refuse.
- **An export that is not answering** (the 30-day grace above) adds no citations to that build.
- **Bounded.** A repository URL becomes a path only as exactly three plain segments (`host/owner/repo`; a nested GitLab group is not one), and an export counts with its first 500 cross-project citations.
- **Sorted throughout** — files, citations and keys — so two builds differ only where the citations did.
