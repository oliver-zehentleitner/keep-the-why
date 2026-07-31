# 0001: Use PostgreSQL for the ledger store

Status: accepted (2025-09) — still current

## Context
The ledger needs strict transactional guarantees and mature tooling.

## Decision
PostgreSQL, accessed through SQLAlchemy core (no ORM models).

## Consequences
Single-node writes are the scaling ceiling; acceptable at current volume.

## Alternatives considered
SQLite (rejected: no concurrent writers), DynamoDB (rejected: transaction
model doesn't fit double-entry postings).
