# Compatibility

## The install table names many agents explicitly, not just "SKILL.md-compatible tools"

**Status:** active
**Confirmed** (direct decision by the maintainer, 2026-07-10)

README, `docs/installation.md`, and `docs/faq.md` list specific agent names — Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor, plus a longer prose list (Windsurf, Antigravity, Amp, Cline, Goose, Roo Code, OpenCode, Trae, Factory, JetBrains Junie, Warp) — rather than a generic "works with any Agent Skills-compatible tool" statement.

**Reason:** the maintainer asked for this explicitly, with a specific rationale: readers scanning the project should be able to find their own tool named, so it reads as "my AI is on board too" rather than a vague compatibility claim they have to take on faith. A generic claim is technically sufficient (the format is genuinely open and portable), but naming tools individually is what actually lands with someone skimming a README.

**Rejected alternative:** keep the original four-tool table (Claude Code, Codex CLI, Gemini CLI, Cursor) and only state generic open-format compatibility for everything else. This was in fact the state of the file until this point in the session — rejected once the maintainer pointed out it wasn't living up to "list all relevant AIs."

**How the table stayed honest despite growing:** only added exact directory paths (Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor) for tools where a specific path was verified via research in-session. Tools mentioned by name without a verified exact path (Windsurf, Antigravity, Amp, Cline, Goose, Roo Code, OpenCode, Trae, Factory, JetBrains Junie, Warp) are named in prose with an explicit pointer to "check your tool's own docs" rather than guessing a plausible-looking path — inventing an unverified install path would violate this project's own Core rule 1 (never invent rationale) applied to its own documentation.

## DeepWiki (Cognition/Devin) named explicitly as a non-skill-runtime consumer

**Status:** active
**Confirmed**

`docs/installation.md`'s "Without a skill-compatible agent" section and `docs/faq.md` both name DeepWiki specifically, rather than only describing the category generically ("a wiki generator, a documentation site builder").

**Reason:** DeepWiki was already discussed and verified earlier in this same session — a live DeepWiki page (deepwiki.com/tarasko/picows) was checked directly and confirmed to cite a repository's existing README with line-number references, meaning it ingests and cites existing Markdown docs, not just code. That verification happened in conversation but was never written into the repo. The maintainer asked directly whether DeepWiki/Devin was "in" yet — it wasn't — prompting this addition.

**Rejected alternative:** leave DeepWiki as an implied example under the generic "wiki generator" category without naming it, on the theory that the general claim already covers it. Rejected for the same reason the broader agent list was expanded: a named example a reader recognizes ("oh, DeepWiki, I've used that") is more convincing and more useful than an abstract category they have to map onto tools themselves.

**Kept honest:** the FAQ entry also states the one real limitation found during the earlier verification — DeepWiki re-synthesizes content into its own wiki in its own voice, so it may not preserve the confirmed/inferred/superseded distinctions this project relies on. Not overclaiming compatibility here follows the same discipline as Core rule 1.

## `llms.txt` at both the repo root and the site root

**Status:** active
**Confirmed**

An `llms.txt` file exists at the repo root (for tools browsing the repo directly) and is duplicated into `docs/llms.txt` so the built site serves it at `https://keepthewhy.com/llms.txt` (mkdocs copies non-Markdown files in `docs/` straight through to the built site). README links to it.

**Reason:** `llms.txt` is a proposed convention (llmstxt.org) for giving AI agents/assistants a concise, structured summary of a project without needing to crawl and parse full HTML or an entire repo — a short, purpose-built file for LLM consumption specifically. It's a separate, established open standard from the Agent Skills/SKILL.md format this project's install table already covers; this file exists for tools that just want a quick summary, not to install or run anything.

**Rejected alternative:** keep the content in only one location and symlink or reference it from the other. Rejected because the two consumption paths have fixed, non-negotiable path expectations (GitHub always resolves repo-root files; the llms.txt convention specifically expects the file at a site's root) that a symlink can't satisfy for both a git checkout and a deployed static site simultaneously — this is a case where duplication is the direct consequence of two independent path conventions, not a routing mistake (contrast with the file-routing guidance in `scope.md`, which is about content that has one true home and shouldn't be copied elsewhere).
