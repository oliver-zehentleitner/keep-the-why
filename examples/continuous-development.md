# Example: continuous development

## Situation

Mid-session, working on a Python service. The retry logic for an external API call is being changed after a production bug.

**User:** "We're changing the retry mechanism because the previous implementation caused duplicate orders. Make sure future maintainers understand this."

## What the skill does

1. Checks whether `context/` already has a topic file covering retries or order submission. Suppose `context/orders.md` exists.
2. Updates `context/orders.md` in place (doesn't create a new file) with a new entry:

```markdown
## Retry mechanism (updated 2026-07-10)

**Status:** active
**Confirmed** (stated directly by the user during the change)

Order submission retries now use idempotency keys instead of blind
retry-on-timeout.

**Reason:** the previous blind-retry implementation caused duplicate
orders when a request succeeded server-side but the response timed
out client-side — the retry then submitted the same order again.

**Superseded:** the earlier retry-on-timeout approach (see git history
around 2026-06) is no longer used for this reason.
```

3. If `context/index.md` doesn't yet list `orders.md`, adds it.
4. Does not create a separate ADR-style file for this — it's an update to the existing topic, not a new topic.

## What it doesn't do

- Doesn't write a comprehensive explanation of the entire order flow — only the part relevant to this change.
- Doesn't ask the user unnecessary clarifying questions when the rationale was already stated directly in the conversation.
- Doesn't commit the change to git automatically (per core rule 12) — it's staged as a working-tree edit unless the user says to commit.
