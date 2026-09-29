# Badge

Show that a project uses Keep the Why with a badge in its README:

[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)

The snippet is the same for every project — copy it as-is.

## Markdown

```markdown
[![Keep the Why](https://keepthewhy.com/assets/badge.svg)](https://keepthewhy.com)
```

Paste it near the top of `README.md`, as the *last* badge if there are others already — keeps it out of the way of badges that carry more load-bearing information (build status, license, version).

## HTML

For anywhere Markdown isn't an option (a plain HTML page, a platform that strips Markdown, or a spot where you need more control over layout):

```html
<a href="https://keepthewhy.com"><img alt="Keep the Why" src="https://keepthewhy.com/assets/badge.svg"></a>
```

## Live badge

A project that publishes its dashboard with its docs can add a second badge next to this one, with its own numbers — "42 entries · 3 open" — linking to its own dashboard:

```markdown
[![Keep the Why · live](https://example.org/dashboard/live/badge.svg)](https://example.org/dashboard/live/)
```

`https://example.org/dashboard/live/` is wherever the docs build puts the export. `ktw-dashboard --export` writes `badge.svg` beside `index.html` and `state.json`, rendered at export time, so no badge service sits in between. The build step, and the `dashboard-state` line that goes with it: [CI linting setup, "The dashboard export"](ci-linting.md#the-dashboard-export). The project wizard offers both when a docs build exists.
