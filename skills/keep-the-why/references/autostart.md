# Autostart: the three ways the skill gets loaded

Loading is not acting. Once loaded, the skill does nothing in a project that
has no `.keep-the-why` unless a developer explicitly asks to set it up
(`setup.md`, "Detection and the two independent wizards") — so every start
path below either gates on that file or *is* the developer asking. What a
start path decides is only whether the skill is in the session at all before
the first request, instead of hoping the agent's own skill discovery matches
the conversation against `SKILL.md`'s description.

Referenced by `setup.md`'s wizard (the start-path question and step 2), not a
mandate. Each entry states what was actually verified and how, so "listed
here" never gets mistaken for "guaranteed to work for you". Growing and
incomplete by design — a pull request adding a verified example for a tool
that isn't here yet is welcome any time; for anything else, [open a new
issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new).

## The three start paths

1. **Every session, machine-wide** — a developer sets it up once, on their
   own machine, for every project they work in: the agent's session-start
   mechanism (a hook, a startup rule) checks for `.keep-the-why` and, if
   present, tells the agent to load the skill before anything else. Gated
   on the file on purpose: an unconditional load would put `SKILL.md` into
   the context of every session in every project, including ones that never
   opted in, for nothing. Personal, not committed — a collaborator on the
   same project gets nothing from it.
2. **The project asks** — committed with the project, so every collaborator
   and every session benefits. Two forms, usable together:
   - a *project-scoped session hook*, where the agent tool has one (Claude
     Code: `.claude/settings.json`);
   - a *"Keep the Why" section in the project's entry-point file*
     (`AGENTS.md`, with `CLAUDE.md` importing it) telling any agent that
     reads that file to load the skill first. Tool-neutral, and the right
     form for a vendored, pinned skill (`setup.md`, "Pinned versions"):
     the section points at the exact `SKILL.md` the project committed.
3. **The developer asks** — nothing to set up. Name the skill, or point the
   agent at `SKILL.md` and say "follow it". This is how the eval suite hands
   the skill to every agent tool other than Claude Code (`docs/evals.md`,
   `docs/agent-matrix.md`), so it is verified on all of them by construction.

They combine: a developer with path 1 working on a project with path 2 gets
told twice, which is harmless — the skill's setup check runs once per session
either way.

## The entry-point section (path 2, tool-neutral)

Paste into the project's `AGENTS.md` (or whatever entry-point file the
project already uses). If the agent tool reads `CLAUDE.md` instead — Claude
Code does, and does not read `AGENTS.md` on its own — a root `CLAUDE.md`
containing just `@AGENTS.md` imports it; most projects already have that
line. Adjust the `SKILL.md` path to where the project keeps the skill
(`pinned-path` in `.keep-the-why` when pinned, otherwise the install location
the project's agents use).

```markdown
## Keep the Why

This project records the reasoning behind its code with the Keep the Why
skill (https://keepthewhy.com) — the `.keep-the-why` file at the project
root is its config. Before doing anything else in a session, whatever the
first request is about, load the skill: in Claude Code, invoke the
`keep-the-why` skill (Skill tool); in any other agent, read
`.claude/skills/keep-the-why/SKILL.md` and follow it, including the
`references/*.md` files it points to for the situation at hand.
```

This is the one exception to `setup.md`'s rule that nothing about Keep the
Why goes into the entry-point file: the project chose this start path, so the
section is the project's own editorial decision, written by the wizard only
when asked for.

## Claude Code

**Path 1 — every session, machine-wide.** The hook script below, saved in
`~/.claude/settings.json` (user scope) instead of the project. Same
mechanism as the project-scoped hook; in real daily use, not separately
eval-verified.

**Path 2, hook — the project asks.** The same script as a project-scoped
`SessionStart` hook in `.claude/settings.json`, checked into the repo. It
checks for the project's `.keep-the-why` — or, for a project not yet
migrated, the legacy `<!-- keep-the-why:config -->` marker in `AGENTS.md` —
before injecting anything, so it stays silent on projects that don't use
Keep the Why rather than firing unconditionally on every session.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "found=\"\"; if [ -f .keep-the-why ]; then found=1; fi; if [ -z \"$found\" ] && [ -f AGENTS.md ] && grep -q '<!-- keep-the-why:config -->' AGENTS.md 2>/dev/null; then found=1; fi; if [ -z \"$found\" ]; then for f in */.keep-the-why; do if [ -f \"$f\" ]; then found=1; break; fi; done; fi; if [ -z \"$found\" ]; then for f in */AGENTS.md; do if [ -f \"$f\" ] && grep -q '<!-- keep-the-why:config -->' \"$f\" 2>/dev/null; then found=1; break; fi; done; fi; if [ -n \"$found\" ]; then echo '{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"This project uses the keep-the-why skill (a .keep-the-why config file exists, or AGENTS.md still carries a legacy keep-the-why:config block). Invoke the keep-the-why skill (Skill tool) now, before doing anything else in this session, whatever the first request is about.\"}}'; fi; exit 0"
          }
        ]
      }
    ]
  }
}
```

The `command` field, unescaped for readability — functionally identical:

```bash
found=""
if [ -f .keep-the-why ]; then
  found=1
fi
if [ -z "$found" ] && [ -f AGENTS.md ] && grep -q '<!-- keep-the-why:config -->' AGENTS.md 2>/dev/null; then
  found=1
fi
if [ -z "$found" ]; then
  for f in */.keep-the-why; do
    if [ -f "$f" ]; then
      found=1
      break
    fi
  done
fi
if [ -z "$found" ]; then
  for f in */AGENTS.md; do
    if [ -f "$f" ] && grep -q '<!-- keep-the-why:config -->' "$f" 2>/dev/null; then
      found=1
      break
    fi
  done
fi
if [ -n "$found" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This project uses the keep-the-why skill (a .keep-the-why config file exists, or AGENTS.md still carries a legacy keep-the-why:config block). Invoke the keep-the-why skill (Skill tool) now, before doing anything else in this session, whatever the first request is about."}}'
fi
exit 0
```

Checks the project root and one level of subdirectories for either marker;
adjust the two `for f in */...` loops for a different layout. A project still
on the previous, `AGENTS.md`-embedded config location (not yet migrated, see
`references/migrations.md`) is matched through the legacy marker on purpose:
the skill then loads and runs the migration itself, instead of the session
silently treating a project that already opted in as one that never did —
exactly the failure the eval case `config-migrates-to-dedicated-file` kept
reproducing while the hook only knew the new location.

**Evidence (hook):** the eval suite's `_base` fixture carries exactly this
hook (`tools/evals/fixtures/_base/.claude/settings.json`). Re-running the 10
(of 11) activation-gap failures from the 2026-08-25 full run that could have
one went from 0/10 invoking the Skill tool to 10/10; 9/10 passed outright,
and the one holdout traced to an unrelated fixture bug (all 10 pass since
that fix). Full writeup: [`docs/evals.md`](https://keepthewhy.com/evals/#run-history),
[PR #190](https://github.com/oliver-zehentleitner/keep-the-why/pull/190).
The legacy-marker branch was carried by the user-scoped variant first and
folded back into the documented script in 2026-09.

**Path 2, entry-point section — the project asks.** The section above in
`AGENTS.md`, plus a root `CLAUDE.md` containing `@AGENTS.md` (Claude Code
reads `CLAUDE.md`, not `AGENTS.md`). Skill installed or vendored at
`.claude/skills/keep-the-why/`.

**Evidence (entry-point section):** eval case
`autostart-project-instruction-loads-skill` — the `_base` fixture with the
hook *removed*, the section in `AGENTS.md`, `CLAUDE.md` importing it, and a
plain code question as the prompt ("why does the retry logic look so
defensive?") that never names the skill. 2026-09-04, Claude Code 2.1.259,
Claude Sonnet 5: 3 of 3 runs invoked the Skill tool as the very first action.
Control — same fixture and prompt with the section removed and still no hook:
0 of 3 loaded the skill. Same-day measurement, so the difference is the
section and nothing else.

**Path 3 — the developer asks.** `/keep-the-why`, or naming the skill in
the request. Nothing to set up.

## Hermes Agent

Hermes injects `AGENTS.md` (and `CLAUDE.md`) from the working directory into
the session on its own — its "rules" mechanism, disabled by `--ignore-rules`
— so the entry-point section (path 2) works as written, no import line
needed.

**Evidence:** one live run, 2026-09-04, `hermes chat` with Claude Sonnet 5
via OpenRouter, terminal and file toolsets, on the same fixture the Claude
Code eval case uses (hook removed, section in `AGENTS.md`), same code
question. First recorded reasoning: "AGENTS.md says I should load the
keep-the-why skill before doing anything else"; first file read:
`.claude/skills/keep-the-why/SKILL.md`. A single run checked by hand, not an
eval measurement — the eval runner's Hermes driver hands the skill over
explicitly (path 3) and so can't measure this path.

Whether Hermes has a session-start hook usable for path 1 wasn't checked.
Path 3: `hermes chat -q "Read ./skills/keep-the-why/SKILL.md and follow it. <request>"`
— the eval suite's own mode for this agent.

## Other agents

- **Path 2, entry-point section:** should work on any agent that reads
  `AGENTS.md` (or its own equivalent) at session start — that is the whole
  point of the file — but it is instruction-following, not a hook, and it is
  verified above only for Claude Code (eval) and Hermes (live). If you've
  checked it on Cline, Codex CLI, Kimi Code, oh-my-pi, opencode, Pi, Gemini
  CLI or anything else, a pull request adding what you saw is exactly the
  kind of contribution this file wants.
- **Path 1 and project-scoped hooks:** whether an agent has a session-start
  mechanism at all, and what it looks like, only that agent's own
  documentation knows; nothing is listed here until someone has run it.
- **Path 3:** verified on Cline, Codex CLI, Hermes, Kimi Code, oh-my-pi,
  opencode and Pi — it is how the eval suite and the agent & model matrix
  hand the skill to every one of them.

Hit a problem, or have something to report that isn't a ready-made example?
[Open a new issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new)
rather than commenting on a closed one.
