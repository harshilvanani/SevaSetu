# ADR-002 · Business rules live in the database

**Status:** Accepted (November 2026)

## Context
- SevaSetu has three clients today (web, iOS, Android) and may get more: kiosk, admin tools, partner integrations.
- Rules like "never overbook a seva", "organizers only see people who came to them" and "demo data never mixes with real data" must hold for every client.

## Decision
- **Access:** enforced with row-level security on every table, through helper functions (`can_manage_org`, `can_view_task`, `can_see_profile`, `in_org_directory`…).
- **Workflows:** run as SQL functions (`join_task`, `complete_event`, `invite_to_team`…). They check the caller and lock rows where needed.
- **Column grants:** limit what the API roles can write directly.
- **Triggers:** keep counters and guards (event status, demo wall, team lead).
- **Small server functions** (Edge Functions today, Lambda later) are used only for third parties: Stripe, push, email.

## Consequences
- The API layer stays thin. On AWS, PostgREST in front of Aurora serves the same API, and the rules move with the database.
- Tests are database tests (pgTAP): `npm run db:test`.
- Developers need SQL skills. Complex rules are documented in the design doc for each feature.
