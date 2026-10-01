---
description: "The Keep the Why registry: published dashboard exports, listed by pull request, checked by a workflow, read by the dashboard's globe."
---

# Registry

<p class="ktw-globe-link"><a href="https://keepthewhy.com/dashboard/live/#globe" title="Open the globe: the dashboard's graph, loading the registry and the web of citations in waves">🌐</a> <a href="https://keepthewhy.com/dashboard/live/#globe">Open the globe</a></p>

A list of published Keep the Why dashboard exports — one `state.json` per repository — kept in [`registry/states.txt`](https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/states.txt) and built into [`index.json`](index.json), which the dashboard's globe reads.

**Nothing needs it.** The dashboard finds other repositories by their citations: a `See` into another repository, a friend, a family member, a thought that goes on elsewhere. The registry adds the one thing citations cannot give — being found from a project that cites nothing of yours — and the reverse direction: who cites you.

## To be listed

Open a pull request that adds one line to `registry/states.txt`: the URL your repository's `.keep-the-why` names in its `dashboard-state` line (the [dashboard page](../dashboard.md#show-a-proposal-before-it-is-merged) says how an export is published). The `registry` workflow checks the line — the state loads, it names its repository, and that repository's `.keep-the-why` at `HEAD` names this very URL — so nobody can list another project's export, and a listing that goes stale fails the weekly check visibly instead of lingering.

## When an export stops answering

Much of that is temporary — a pages deploy in progress, a host having a bad hour. A listed export that does not answer stays in the index as last seen, marked with `error` and `failed_since`, and the workflow logs a warning; only after 30 days of failing in a row is it dropped. A line that never answered is not listed at all — that is a new line in a pull request, or a typo, and the check says so. The dashboard treats a registry project that cannot be loaded like a friend that cannot: the rest of the wave loads, and the legend names what did not, with the reason.

## What the index holds

Per project: the canonical repository URL, the state's URL, the project's id, the Keep the Why version it is on (`context-schema`), the dashboard and linter versions that made the export, the number of entries and topics, its parent and how many children it lists, and when the export was generated. Rebuilt on every change to the list, weekly, and on request; the workflow is the only writer.

## In the dashboard

The globe — the 🌐 at the end of the status bar — opens the graph alone, full width, and loads repositories in waves: hop 1 is what the loaded entries cite outside the page, hop 2 what those cite, up to ten, each wave asked for with its count and its list before anything is fetched. *registry* loads every listed project as a wave of its own, asked for the same way. Nothing of it is kept per browser: every load from another host is a click, and a reload starts without it.
