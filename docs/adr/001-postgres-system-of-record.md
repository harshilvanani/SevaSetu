# ADR-001 · PostgreSQL is the system of record

**Status:** Accepted (November 2026)

## Context
SevaSetu needs a database that:
- handles relational data (people, events, seva, hours, donations)
- enforces access rules
- can move between hosts: Supabase today, AWS later

## Decision
- Use standard PostgreSQL (version 15 or later) as the single source of truth.
- Every schema change is a numbered SQL migration in `supabase/migrations/`. It is applied by `scripts/db.mjs migrate` and recorded in `supabase_migrations.schema_migrations`.
- Extensions are limited to the ones Amazon Aurora PostgreSQL also offers:
  - `pgcrypto`
  - `pgtap` (tests only)
  - `pg_cron` (exists on RDS / Aurora)
  - `pg_net`: Supabase-only, used only for push. Replaced by EventBridge + Lambda on AWS ([ADR-003](003-aws-migration.md)).

## Consequences
- The same migrations build the database on Aurora. The same 208 pgTAP checks prove it behaves the same.
- No vendor lock-in for data: `pg_dump` / `pg_restore` moves it.
- Every developer must write SQL migrations; there are no dashboard edits.
