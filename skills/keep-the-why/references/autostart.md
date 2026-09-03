# Autostart examples

Positive, verified examples of stronger activation setups, one section per
agent tool — referenced by `setup.md`'s wizard step 2, not a mandate. The
current agent still decides what (if anything) to set up for its own
platform; this file exists so that decision can draw on evidence someone
already gathered, instead of only from-scratch improvisation every time.
Growing and incomplete by design — a pull request adding a verified example
for a tool that isn't here yet is welcome any time; for anything else, [open
a new issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new).

Each entry states plainly what was actually verified and how, so "listed
here" never gets mistaken for "guaranteed to work for you" — check the
evidence, adapt if your setup differs, and prefer something better if you
find or already have one.

## Claude Code

A project-scoped `SessionStart` hook: checks for the current project's
`.keep-the-why` config file — or, for a project not yet migrated, the legacy
`<!-- keep-the-why:config -->` marker in `AGENTS.md` — before injecting
anything, so it stays silent on projects that don't use Keep the Why rather
than firing unconditionally on every session.

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

Save as `.claude/settings.json` in the project root (checked into the repo —
scoped to the project, not one developer's machine, so every collaborator
and every session benefits automatically). Checks the project root and one
level of subdirectories for either marker; adjust the two `for f in */...`
loops for a different layout. A project still on the previous,
`AGENTS.md`-embedded config location (not yet migrated, see
`references/migrations.md`) is matched through the legacy marker on purpose:
the skill then loads and runs the migration itself, instead of the session
silently treating a project that already opted in as one that never did —
exactly the failure the eval case `config-migrates-to-dedicated-file` kept
reproducing while the hook only knew the new location.

**Evidence:** the eval suite's `_base` fixture carries exactly this hook
(`tools/evals/fixtures/_base/.claude/settings.json`). Re-running the 10 (of
11) activation-gap failures from the 2026-08-25 full run that could have one
— `init-declined-not-reasked` starts from an empty project with no
entry-point file to grep, out of scope — went from 0/10 invoking the Skill
tool to 10/10; 9/10 passed outright, and the one holdout traced to an
unrelated fixture bug (all 10 pass since that fix). Full writeup:
[`docs/evals.md`](https://keepthewhy.com/evals/#run-history),
[PR #190](https://github.com/oliver-zehentleitner/keep-the-why/pull/190).

A user-scoped variant (same script, in `~/.claude/settings.json` instead) is
also in real daily use — set up once, applies across every Keep-the-Why
project on that machine rather than needing to be added per-repo. Same
mechanism, not separately eval-verified the way the project-scoped version
above is. The legacy-marker branch above was carried by that user-scoped
variant first and folded back into the documented script in 2026-09.

## Other agents

Not yet verified for Cline, Codex CLI, Kimi Code, opencode, Pi, Gemini CLI,
or anything else. If you've worked out something that measurably helps for
one of these, a pull request adding it here (with what you actually checked)
is exactly the kind of contribution this project wants. Hit a problem, or
have something to report that isn't a ready-made example? [Open a new
issue](https://github.com/oliver-zehentleitner/keep-the-why/issues/new)
rather than commenting on a closed one.
