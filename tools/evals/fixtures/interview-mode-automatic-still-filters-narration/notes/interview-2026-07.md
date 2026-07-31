# Interview notes — maintainer session (raw, 20 minutes)

So, where do I even start. The sync thing, right. When we first built it we
just applied events as they arrived, and that blew up — duplicate state all
over the mirror — so now the snapshot always loads first. We actually tried
parallel replay with reconciliation for about a week and threw it away, the
reconciliation was impossible to get right and enforcing the order made it
unnecessary anyway.

Oh and the coffee machine on floor 2 is still broken, has been for a month.

The gateway wrapper — people keep wanting to simplify it. Don't. The rate
limiter sends per-request Retry-After and a plain loop retries too early and
melts everything under load. Ask me how I know, ha.

My kids keep asking why I still work here. Anyway.

We picked quadratic backoff over exponential, that one was deliberate —
exponential backed off so hard the mirror lagged minutes behind during
routine blips; quadratic keeps the lag bounded and the provider was fine
with it. There might've been a ticket, I honestly don't remember.

Lunch situation around here got a lot better since the new place opened.
