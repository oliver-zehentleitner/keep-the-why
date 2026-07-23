# Example: an abandoned change is still worth capturing

## Situation

Mid-session, cleaning up what looks like dead weight in a payments service.

**User:** "This `retry_with_jitter` wrapper around the payment gateway call looks over-engineered — a plain retry loop would do the same thing. Let's simplify it."

## What the skill does

1. Before rewriting, checks `context/` and git history for anything explaining the wrapper (per the Chesterton's Fence guard). Nothing documented.
2. Starts reasoning through the simplification with the user, and in the process notices: the gateway's rate limiter returns a `429` with a `Retry-After` header that varies per request, and a plain fixed-delay retry loop would frequently retry too early and get rate-limited again, causing cascading failures under load. This wasn't visible from the wrapper's code alone — it only came out while working through *why* it could seemingly be simplified.
3. Stops. The user agrees: don't touch `retry_with_jitter`, it's handling something real.
4. **No code changes at all.** But records the reasoning anyway, in the relevant topic file:

    ```markdown
    ## Why retry_with_jitter isn't a plain retry loop

    **Status:** active
    **Evidence:** confirmed
    **Source:** discovered while considering simplifying it, 2026-07-22

    The payment gateway's rate limiter returns 429 with a per-request
    Retry-After header. A fixed-delay retry loop would frequently retry
    before the limiter resets, causing repeated 429s under load.

    **Considered:** replacing it with a plain retry loop, since the
    wrapper looked like unnecessary complexity with nothing documenting
    why. Not adopted once the Retry-After behavior surfaced during review.
    ```

## Why this matters

Nothing changed in the code, so there's no commit, no diff, no PR — normally nothing would ever point back to this reasoning. Six months from now, someone else will look at the same wrapper, have the same instinct, and either rediscover this the hard way (a production incident) or waste time re-investigating from scratch. Capturing the abandoned attempt closes that gap before it opens.

## What it doesn't do

- Doesn't skip capturing just because there's no code change to attach it to.
- Doesn't wait for the user to ask for documentation — the insight came up navigating toward a change, and gets written down at that point per continuous capture's normal timing.
- Doesn't invent the reasoning after the fact for something that would have been convenient to keep — this only applies when the reasoning was genuinely discovered in the moment, not manufactured to justify not touching something.
