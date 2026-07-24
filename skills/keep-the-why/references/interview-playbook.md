# Interview playbook

For knowledge-transfer interviews — most commonly used before a maintainer leaves, retires, or moves off a project, but applicable any time a specific person is the last remaining source for something the code can't explain.

## Analysis always comes first

Run retrospective analysis (`retrospective-analysis.md`) to build a gap list before the interview, regardless of which technique below is used for the conversation itself. It's what makes prioritization possible when time is short, and it's what a free-narration session gets checked against afterward to find what still needs a targeted follow-up.

## Two techniques, chosen by the interviewee and the gaps — not always the same one

**Targeted questions** — the default when the gaps are specific and narrow, or time is short. Ask about something specific and observed, not a category. Never open with a generic "tell me about this system" questionnaire when this technique is the right fit — a scripted, specific question gets a specific memory back; a vague one gets a vague summary.

- Ask about something specific and observed, not a category. "Why does X wait for Y" beats "explain the sync system."
- Where a rejected alternative is suspected (from a comment, an old branch, a commit that was reverted), ask about it directly: "Was Z considered instead? What happened?"
- Where the answer might reveal a constraint that no longer applies, ask: "Is this still true today, or was it true when this was written?" Stale constraints that outlived their reason are common and worth flagging as candidates for re-evaluation, not just documenting as permanent.
- Leave room for the interviewee to raise something not on the prepared list — the gap analysis is a starting point, not a script to follow rigidly.

**Free narration** — a better fit when the knowledge is broad and tacit rather than narrowly scoped: someone who's maintained the same system, sometimes for decades, and whose understanding isn't organized around "what the code can't explain" the way a gap list is. A scripted question list can actually suppress recall here — the interviewee has to guess what's being asked about, instead of just telling the story their own way, and the most valuable detail often surfaces in a tangent that no specific question would have triggered. Open with something like "tell me about this system, start wherever you want" and let them talk.

The agent's job during free narration is different from targeted questioning:

- Don't interrupt the flow for minor clarifications — let tangents run; tacit knowledge often surfaces exactly in the tangents, not in direct answers to direct questions.
- Extract decision-forks as they come up organically (what was tried, what was chosen, what was rejected, and why), using the same structure as any other entry — it's just being extracted from flowing narration instead of a directed answer.
- Ask a clarifying follow-up only when something is genuinely ambiguous, or when a claim needs pinning down for the confirmed/inferred classification — not to redirect the story back to an agenda.
- After the narration (or at a natural pause), cross-check what was covered against the gap list from analysis. Whatever wasn't covered becomes a targeted follow-up question afterward — the two techniques aren't mutually exclusive, and combining them (narrate first, then close remaining gaps with pointed questions) is usually stronger than either alone.

## Prioritizing what to ask (targeted technique) or listen for (free narration)

Time with a knowledge holder is usually limited. Prioritize gaps by:

1. **Risk** — what would break, or break silently, if this is never documented and someone later "cleans it up" without knowing why it's there.
2. **Exclusivity** — what only this person seems to know, versus what could plausibly be reconstructed by someone else later.
3. **Decision weight** — architectural or structural choices that shaped a lot of what came after, versus small local workarounds.

Low-risk, easily-reconstructible, low-weight gaps can wait or be skipped if time is short.

## After the interview

- Summarize each answer back and get it confirmed before writing it down as "confirmed" — don't rely on your own paraphrase being accurate. This is a factual check (did I get the story right), not the same thing as the permission-to-write check below.
- Free narration especially doesn't get written down unfiltered just because it was said out loud: extract the decision-forks first, run them through Evidence (rule 2) and the proportionality gate (rule 13) same as any other candidate, then apply the project's `capture-confirmation` setting before anything actually lands in `context/`, exactly as configured — see "The confirmation model" in `setup.md`.
- When several candidates come out of one session at once, `confirmation-flow` (personal, `sequential` or `batch`) decides whether they're confirmed one at a time or reviewed together as a list — whichever the developer set, not whichever seems to fit the situation better.
- Write up answers into the relevant topic files immediately, while detail is fresh, same as continuous capture.
- If some prepared questions didn't get answered (time ran out, the person didn't know either), leave them visibly as open/unknown in the relevant topic file rather than dropping them silently — a documented open question is still more useful than one that quietly disappears.

## Consent, recall, and evidence

- Don't commit raw transcripts or recordings — extract the rationale into the normal topic-file structure (see Core rule 9: session narrative doesn't belong in `context/`, only the objective reasoning does).
- Get explicit agreement before recording or transcribing a conversation, if that's how the session is being captured.
- A person's recollection is confirmed *that they said it*, not automatically confirmed as objective fact — memory is fallible, especially years after the fact. Note it as their stated account; cross-check against repository evidence where practical.
- When memory and repository evidence disagree (they remember it one way, the git history or code shows another), don't quietly pick one — record both and flag the conflict openly, same as any other source disagreement (`retrospective-analysis.md`).

## A note on tone

This is often a conversation with someone leaving a project they've spent years on. Treat it as capturing their knowledge for the project's benefit, not as an audit or an extraction exercise. The framing "help the next person avoid re-learning this the hard way" tends to land better than "we need to get this out of your head before you go."
