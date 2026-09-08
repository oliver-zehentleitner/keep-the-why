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

**Reason:** the passages on the page that would otherwise drift — the intro paragraph and the "Tested with" line — are included from the README between HTML-comment markers (the latest eval headline was included from `docs/evals.md` the same way until the maintainer took the numbers off the front page the same day: a release-specific figure next to a timeless claim aged the page with every release), so the page cannot drift from its sources; that is the same one-place rule the README and `llms.txt` follow. Markdown keeps the page editable like every other doc, keeps light and dark mode for free, and adds nothing to the toolchain.

**Consequence (2026-09-08):** the hero no longer includes the README intro; it carries a three-sentence summary written in `docs/index.md` itself, and the README intro include moved into a "Description" section below the demo. Maintainer request ("an abstract short explanation at the top, the full text further down"). That summary is the one passage on the page not pulled from a source file — it is a condensation, not a copy, so the one-place rule doesn't apply, but it has to be re-read whenever the README intro changes.

**Rejected alternative:** a raw `index.html` in `docs/`. Full layout freedom, but it would have to rebuild the header, search, palette toggle and footer itself, and the include mechanism wouldn't reach into it — the facts would be typed in by hand. Also rejected: a custom Jinja page template (`template:` front matter) — real HTML inside the site chrome, but a second place where layout lives, for a gain (a wider column) the page doesn't need.

## The format has a normative specification file, separate from the guidance that shows it in use

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-07 ("a spec page that defines the format of context and the config files")

`references/specification.md` defines what is valid — files, config blocks and fields, the index grammar, the entry grammar, lifecycle, versioning — and is the docs page `/specification/`. `repository-structure.md` keeps layout, routing and retrofitting — the examples went with the definitions, so the specification is the one place that shows every file in full; `setup.md` keeps behavior. Where they disagree, the specification wins.

**Reason:** the definitions lived between examples in `repository-structure.md` and between wizard steps in `setup.md`; a reader who only wanted to know what is valid had to lift the normative sentences out of a narrative, which is what the linter does in code. A convention needs one page that states its rules without telling a story — for tool authors, for reviewers, and for the linter's own contract. Kept inside the skill package rather than as a docs-only page so agents can load it on demand and there is one source; the docs page includes it.

**Rejected alternative:** a docs-only page stitched from include markers over the existing references. No duplication, but the references would have kept normative and narrative text mixed, and the page would have read as excerpts rather than as a specification.

