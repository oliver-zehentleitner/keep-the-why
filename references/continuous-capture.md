# Continuous capture

Applying the skill during normal, ongoing development.

## What's worth capturing

Not everything discussed in a session is worth writing down. Capture when the conversation contains:

- a decision between real alternatives, where the alternatives aren't obvious from the code alone
- a workaround for something external (a library bug, a platform limitation, a compatibility requirement)
- a constraint that comes from outside the code (legal, operational, business, a partner's API behavior)
- an incident or bug and what changed because of it
- something that looks like it could be simplified or removed, but shouldn't be, and why

Don't capture:

- routine implementation detail that the code already explains clearly
- decisions that are genuinely still open/undecided — note them as unknown or open instead of writing them up as settled
- anything speculative ("we might want to X later") unless it's actively shaping a decision made now

## When to write, during a session

Write the update at the point the rationale becomes clear — usually right after a decision is made or a workaround is explained, not batched up at the end of a long session where detail gets lost. If a topic file for the relevant subject already exists, update it in place rather than waiting to create a new one.

## Updating vs. creating

Before creating a new topic file, check whether the subject already has one. A new decision about sync behavior belongs in the existing `sync.md`, appended or amended, not in a new `sync-2.md` or `new-sync-decision.md`. Fragmentation defeats the purpose — the whole point is that the next reader finds everything about a topic in one place.

## Keeping it low-effort

This mode is meant to be close to free for the person doing the work — the rationale was going to be discussed anyway; this just means it gets written down instead of evaporating with the session. If capturing something starts to feel like a large, separate task, that's a signal to write less, not to skip capturing entirely — a two-line note beats no note, and can be expanded later if it turns out to matter.
