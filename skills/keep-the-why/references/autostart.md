# Autostart examples

Positive, verified examples of stronger activation setups, one section per
agent tool — referenced by `setup.md`'s wizard step 2, not a mandate. The
current agent still decides what (if anything) to set up for its own
platform; this file exists so that decision can draw on evidence someone
already gathered, instead of only from-scratch improvisation every time.
Growing and incomplete by design — see [issue
#138](https://github.com/oliver-zehentleitner/keep-the-why/issues/138) to
add a tool that isn't here yet.

Each entry states plainly what was actually verified and how, so "listed
here" never gets mistaken for "guaranteed to work for you" — check the
evidence, adapt if your setup differs, and prefer something better if you
find or already have one.

## Claude Code

A project-scoped `SessionStart` hook: checks the current project's entry-point
file for the `keep-the-why:config` marker before injecting anything, so it
stays silent on projects that don't use Keep the Why rather than firing
unconditionally on every session.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "found=\"\"; if [ -f AGENTS.md ] && grep -q '<!-- keep-the-why:config -->' AGENTS.md 2>/dev/null; then found=1; fi; if [ -z \"$found\" ]; then for f in */AGENTS.md; do if [ -f \"$f\" ] && grep -q '<!-- keep-the-why:config -->' \"$f\" 2>/dev/null; then found=1; break; fi; done; fi; if [ -n \"$found\" ]; then echo '{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"This project uses the keep-the-why skill (AGENTS.md has a keep-the-why:config block). Load the keep-the-why skill now, before other work.\"}}'; fi; exit 0"
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
if [ -f AGENTS.md ] && grep -q '<!-- keep-the-why:config -->' AGENTS.md 2>/dev/null; then
  found=1
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
  echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This project uses the keep-the-why skill (AGENTS.md has a keep-the-why:config block). Load the keep-the-why skill now, before other work."}}'
fi
exit 0
```

Save as `.claude/settings.json` in the project root (checked into the repo —
scoped to the project, not one developer's machine, so every collaborator
and every session benefits automatically). Checks the project root and one
level of subdirectories for the marker; adjust the `for f in */AGENTS.md`
line if the entry-point file lives somewhere else in a given project.

**Evidence:** the eval suite's `_base` fixture carries exactly this hook
(`tools/evals/fixtures/_base/.claude/settings.json`). Re-running the 10 (of
11) activation-gap failures from the 2026-08-25 full run that could have one
— `init-declined-not-reasked` starts from an empty project with no
entry-point file to grep, out of scope — went from 0/10 invoking the Skill
tool to 10/10, and 10/10 passing outright. Full writeup:
[`docs/evals.md`](https://keepthewhy.com/evals/#activation-gap-follow-up-a-real-sessionstart-hook-tested),
[PR #190](https://github.com/oliver-zehentleitner/keep-the-why/pull/190).

A user-scoped variant (same script, in `~/.claude/settings.json` instead) is
also in real daily use — set up once, applies across every Keep-the-Why
project on that machine rather than needing to be added per-repo. Same
mechanism, not separately eval-verified the way the project-scoped version
above is.

## Other agents

Not yet verified for Cline, Codex CLI, Kimi Code, opencode, Pi, Gemini CLI,
or anything else. If you've worked out something that measurably helps for
one of these, contributing it here (with what you actually checked) is
exactly the kind of help [issue
#138](https://github.com/oliver-zehentleitner/keep-the-why/issues/138) asks
for.
