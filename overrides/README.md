# overrides/

Theme-override directory for the docs site, wired up via `theme.custom_dir:
overrides` in `mkdocs.yml`. Files here replace or extend the mkdocs-material
theme's built-in templates — they affect how keepthewhy.com renders, not the
documentation content itself (that lives in `docs/`).

Currently one file:

- `main.html` — extends the theme's `base.html` and injects the Open Graph
  and Twitter-card `<meta>` tags into every page's `<head>`. This is what
  makes a shared keepthewhy.com link show the logo card, title, and
  description on X, LinkedIn, Slack, and similar platforms.

The folder sits at the repo root on purpose: it's the documented
mkdocs-material convention (an `overrides` folder next to `mkdocs.yml`), and
placing it inside `docs/` would make mkdocs treat the raw template as site
content and publish it verbatim into the built site.

This README is inert — the theme engine only resolves known template names
(`main.html`, `base.html`, `partials/…`), so a Markdown file here is ignored.
