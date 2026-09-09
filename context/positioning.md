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

**Consequence (2026-09-08):** the README intro is no longer on the landing page at all; the hero carries a three-sentence summary written in `docs/index.md` itself. Maintainer request ("an abstract short explanation at the top"; a "Description" section holding the full intro below the demo was tried in the same change and dropped the same day — it is on `/readme/` anyway, and the page reads leaner without it). A pain line above the summary followed the same day (maintainer's wording: explaining the same thing to your agent for the seventeenth time, new session, another harness, another account; it is missing `context/`), and was rewritten the same evening to four short statements — the same decision again, new session, no memory of why, the code doesn't carry the reasoning and neither does the changelog (maintainer's wording, the period form chosen over an em-dash form as closer to the rest of the page): the questions and the "seventeenth time" had read as strained, the closing "it is missing `context/`" pre-empted the summary below it, and the changelog clause ties the pain line back to the hook sentence above it — what the changelog records versus what it cannot carry, the same division from the other side, not a dig; the cross-tool point (another harness, another account) moved out of the pain line on purpose, it lives in the summary's last sentence and on the agent matrix. Rewritten again on 2026-09-09 (maintainer request: cooler, more catchy; the maintainer's sketch was two questions — explaining the same background for the umpteenth time, the agent taking a wrong turn again): three staccato fragments (same question, same wrong turn, same explanation, again), then two short sentences — the agent forgets between sessions; nothing in the repo remembers: not the code, not the changelog, not the docs (first draft had one sentence with "remembers for it"; an external review the same day called the "for it" slightly off, and it went — the bridge sentence answers "nothing remembers" just as well without it; the same review offered "same rejected approach" for "same wrong turn" as closer to the page's register, declined: the one concrete image is what carries the triad, and "rejected alternatives" sits verbatim in the summary three lines below). What changed and why: the old line carried only the maintainer's pain (explaining again); the agent's own failure (the wrong turn, re-suggesting what was rejected) is the stronger pain and was missing. The question form was offered and passed over — it is what had read as strained the first time — and the number ("Xth time") stayed out for the same reason. `docs/` joined code and changelog in the list on the maintainer's suggestion: docs say how it works, not why, the same division. The changelog stays named so the line still answers the hook sentence. The bridge into the summary is one added sentence in front of it, "Keep the Why is the part that remembers", answering "nothing remembers" directly; a "because `context/` is missing" bridge was rejected again — it would pre-empt the summary and name a directory the first-time reader hasn't met yet. Those two hero passages are the only text on the page not pulled from a source file — a condensation and a hook, not copies, so the one-place rule doesn't apply, but both have to be re-read whenever the README intro or "The problem" changes.

**Consequence (2026-09-09, meta description):** the site description (`site_description` in `mkdocs.yml`, mirrored as the landing page's `description` front matter, and the text the social-cards plugin prints on share cards) went from 347 characters to under 160. Search engines cut at roughly 160, and the old text broke mid-sentence before its benefit clause; the new one leads with the search terms (project memory, coding agents) and ends on the benefit (nothing rejected is proposed twice). It is the only description on the site — no other page sets its own, so every page inherits it.
**Consequence (2026-09-09, README order):** "The problem" moved from behind Install and Example to directly before "How it works" — the landing page now puts the pain before the explanation, and the README's four concrete costs (re-debate, silent regression, onboarding stall, repeated agent mistakes) were sitting on line 165 behind the install instructions. Only a move, plus the intro's first sentence split into three; the maintainer's condition for touching the README was that it loses no depth — it is the long form, the landing page is the short one.

**Consequence (2026-09-09, README images):** the README's two raw `<img>` tags (logo, demo GIF) point at `https://keepthewhy.com/assets/...` instead of `docs/assets/...`. On `/readme/` the include plugin rewrote the relative path to `assets/...`, which a directory URL resolves to `/readme/assets/...` — 404 since #274; MkDocs only corrects Markdown image syntax, not raw HTML. Absolute URLs render on GitHub and on the site alike and keep the GIF's `width`; Markdown image syntax would have fixed the path but dropped the width.

**Rejected alternative:** a raw `index.html` in `docs/`. Full layout freedom, but it would have to rebuild the header, search, palette toggle and footer itself, and the include mechanism wouldn't reach into it — the facts would be typed in by hand. Also rejected: a custom Jinja page template (`template:` front matter) — real HTML inside the site chrome, but a second place where layout lives, for a gain (a wider column) the page doesn't need.

## The project's own `context/` is published on the site through one-line include stubs

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** how the "Why this project is built this way" nav section has been built since the site exists; the gap noted by Oliver on 2026-09-08 ("are all context files under 'Why this project is built this way'?" — they weren't)

Every topic file in `context/` gets a stub at `docs/context/<name>.md` holding a single `include-markdown` line, and a line in the nav section "Why this project is built this way" in `mkdocs.yml`. The stub is the only way a `context/` file reaches the site — MkDocs only builds what lives under `docs/`, and copying the file would create a second place to edit.

**Consequence:** a new topic file is not on the site until someone adds its stub and nav line; nothing checks this. `lint.md` (2026-09-02) and `evals.md` (2026-09-05) were both missed for days and added on 2026-09-08. When adding a topic file, add the stub and the nav line in the same change.

## The format has a normative specification file, separate from the guidance that shows it in use

**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request, 2026-09-07 ("a spec page that defines the format of context and the config files")

`references/specification.md` defines what is valid — files, config blocks and fields, the index grammar, the entry grammar, lifecycle, versioning — and is the docs page `/specification/`. `repository-structure.md` keeps layout, routing and retrofitting — the examples went with the definitions, so the specification is the one place that shows every file in full; `setup.md` keeps behavior. Where they disagree, the specification wins.

**Reason:** the definitions lived between examples in `repository-structure.md` and between wizard steps in `setup.md`; a reader who only wanted to know what is valid had to lift the normative sentences out of a narrative, which is what the linter does in code. A convention needs one page that states its rules without telling a story — for tool authors, for reviewers, and for the linter's own contract. Kept inside the skill package rather than as a docs-only page so agents can load it on demand and there is one source; the docs page includes it.

**Rejected alternative:** a docs-only page stitched from include markers over the existing references. No duplication, but the references would have kept normative and narrative text mixed, and the page would have read as excerpts rather than as a specification.

