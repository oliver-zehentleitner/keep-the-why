# 0002: Event log lives in the same database

Status: accepted (2026-02) — still current

## Context
Auditing requires an append-only history of postings.

## Decision
An `events` table in the same PostgreSQL instance, written in the same
transaction as the posting itself.

## Alternatives considered
Kafka (rejected: operational overhead, and exactly-once with the DB write
would need an outbox anyway — which is what the events table effectively is).
