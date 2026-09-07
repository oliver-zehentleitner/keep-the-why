# Positioning

## No name-by-name comparison against competing tools, only named standards

**Type:** decision
**Status:** active
**Evidence:** confirmed

README's and `llms.txt`'s "Related work" don't compare Keep the Why against specific competing tools or skills by name (`git-why`, Agent Decision Records, Addy Osmani's `documentation-and-adrs` skill, and similar were removed). What stays named: Architecture Decision Records and the AGENTS.md standard — genuine open standards/conventions this project builds alongside, not competitors. The distinguishing description points to `docs/philosophy.md` and "What this is not" instead of a per-project comparison table.

**Reason:** started as a fix for a broken link (Agent Decision Records pointed at a generic personal homepage), but the real problem is structural: any name-by-name list of competing tools is incomplete the moment it's written and stale soon after — new tools appear, others go unmaintained, and keeping the list accurate becomes its own maintenance burden unrelated to this project's actual job.

**Rejected alternative:** keep a maintained comparison table and just fix the broken link. Rejected — doesn't address why it went stale in the first place, and the same drift would recur.

**Consequence, caught late:** `docs/faq.md`'s "How is this different from git-why, AgDR, or similar projects?" entry was missed when this changed elsewhere (README, `llms.txt`) — it named both tools and pointed at a README section ("Not a green field") that no longer exists under that name (now "Related work"). Fixed once noticed; recorded here so the next place this wording lives doesn't get missed the same way.

## The site's front page is a landing page in Markdown, not a template and not a raw HTML file

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-07 ("a landing page as index, link the README from there"); the technical form was the assisting agent's call, accepted
**Revisit when:** the page needs anything CSS can't do (a live element, a carousel, tabs), or Material's `hide:` front matter stops removing the sidebars

`docs/index.md` is a Material page with `hide: toc` (the navigation sidebar stays — without tabs in the header it is the site's only menu, and the first production look had it hidden), its content plain Markdown with `<div markdown>` blocks (`md_in_html`, already enabled) and a landing-page section in `extra.css` built on Material's own color variables. The README is its own page (`/readme/`), included whole as before.

**Reason:** the two facts on the page that change per release — the "Tested with" line and the latest eval headline — are included from the README and `docs/evals.md` between HTML-comment markers, so the page cannot drift from its sources; that is the same one-place rule the README and `llms.txt` follow. Markdown keeps the page editable like every other doc, keeps light and dark mode for free, and adds nothing to the toolchain.

**Rejected alternative:** a raw `index.html` in `docs/`. Full layout freedom, but it would have to rebuild the header, search, palette toggle and footer itself, and the include mechanism wouldn't reach into it — the facts would be typed in by hand. Also rejected: a custom Jinja page template (`template:` front matter) — real HTML inside the site chrome, but a second place where layout lives, for a gain (a wider column) the page doesn't need.
