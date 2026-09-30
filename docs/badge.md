# Badges

Three badges, one static and two live: plain SVG files at fixed URLs, nothing fetched from a badge service when a README is viewed. The two live ones are rendered by [the dashboard export](dashboard.md) on every docs build with the project's own numbers — *entries* and *open*, where open counts every entry that still needs a person.

## The static badge

[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)

Says that a project uses Keep the Why. The snippet is the same for every project — copy it as-is, and paste it near the top of `README.md`, as the *last* badge if there are others already (it carries less load-bearing information than build status, license or version).

=== "Markdown"

    ```markdown
    [![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)
    ```

=== "HTML"

    ```html
    <a href="https://keepthewhy.com"><img alt="Keep the Why" src="https://keepthewhy.com/assets/badge.svg"></a>
    ```

## The live badge: `badge-entries.svg`

[![Keep the Why · live](https://keepthewhy.com/dashboard/live/badge-entries.svg)](https://keepthewhy.com/dashboard/live/)

A project that publishes its dashboard with its docs gets a badge with its own numbers, linking to its own dashboard — the one above is this repository's. `ktw-dashboard --export` writes it beside `index.html` and `state.json`, rendered at export time — the build step and the `dashboard-state` line that go with it: [CI linting setup, "The dashboard export"](ci-linting.md#the-dashboard-export); the project wizard offers both when a docs build exists. `https://example.org/dashboard/live/` below is wherever the build puts the export.

In Keep the Why's style — the static badge's wordmark, extended by the numbers:

=== "Markdown"

    ```markdown
    [![Keep the Why · live](https://example.org/dashboard/live/badge-entries.svg)](https://example.org/dashboard/live/)
    ```

=== "HTML"

    ```html
    <a href="https://example.org/dashboard/live/"><img alt="Keep the Why · live" src="https://example.org/dashboard/live/badge-entries.svg"></a>
    ```

## The same numbers, flat: `badge-entries-flat.svg`

[![keep the why: entries · open](https://keepthewhy.com/dashboard/live/badge-entries-flat.svg)](https://keepthewhy.com/dashboard/live/)

For a badge row in the flat style the badge services draw, where the styled one would stand out:

=== "Markdown"

    ```markdown
    [![keep the why](https://example.org/dashboard/live/badge-entries-flat.svg)](https://example.org/dashboard/live/)
    ```

=== "HTML"

    ```html
    <a href="https://example.org/dashboard/live/"><img alt="keep the why" src="https://example.org/dashboard/live/badge-entries-flat.svg"></a>
    ```

Both live badges are static SVG written by the export: as current as the docs build, no request to any service when a README is viewed. Before dashboard 0.4.0 the export wrote one badge, `badge.svg`, in the flat style; it is gone — a README that still names it shows a broken image until the line names one of the two above.
