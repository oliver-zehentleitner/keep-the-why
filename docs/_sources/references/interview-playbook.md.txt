# Interview playbook

For knowledge-transfer interviews — most commonly used before a maintainer leaves, retires, or moves off a project, but applicable any time a specific person is the last remaining source for something the code can't explain.

## The core rule: analyze first, ask second

Never open with a generic "tell me about this system" questionnaire. Run retrospective analysis first (`retrospective-analysis.md`) to build a gap list, then interview against that specific list. This does two things: it respects the interviewee's time (they're not re-explaining what's already obvious from the code), and it produces much higher-value answers, because the questions are concrete enough to trigger specific memories instead of vague summaries.

## Prioritizing what to ask

Time with a knowledge holder is usually limited. Prioritize gaps by:

1. **Risk** — what would break, or break silently, if this is never documented and someone later "cleans it up" without knowing why it's there.
2. **Exclusivity** — what only this person seems to know, versus what could plausibly be reconstructed by someone else later.
3. **Decision weight** — architectural or structural choices that shaped a lot of what came after, versus small local workarounds.

Low-risk, easily-reconstructible, low-weight gaps can wait or be skipped if time is short.

## Question style

- Ask about something specific and observed, not a category. "Why does X wait for Y" beats "explain the sync system."
- Where a rejected alternative is suspected (from a comment, an old branch, a commit that was reverted), ask about it directly: "Was Z considered instead? What happened?"
- Where the answer might reveal a constraint that no longer applies, ask: "Is this still true today, or was it true when this was written?" Stale constraints that outlived their reason are common and worth flagging as candidates for re-evaluation, not just documenting as permanent.
- Leave room for the interviewee to raise something not on the prepared list — the gap analysis is a starting point, not a script to follow rigidly.

## After the interview

- Summarize each answer back and get it confirmed before writing it down as "confirmed" — don't rely on your own paraphrase being accurate.
- Write up answers into the relevant topic files immediately, while detail is fresh, same as continuous capture.
- If some prepared questions didn't get answered (time ran out, the person didn't know either), leave them visibly as open/unknown in the relevant topic file rather than dropping them silently — a documented open question is still more useful than one that quietly disappears.

## A note on tone

This is often a conversation with someone leaving a project they've spent years on. Treat it as capturing their knowledge for the project's benefit, not as an audit or an extraction exercise. The framing "help the next person avoid re-learning this the hard way" tends to land better than "we need to get this out of your head before you go."
