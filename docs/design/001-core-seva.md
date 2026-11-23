# 001 · Core seva: discover, join, progress, hours

**Status:** Released (doc written after the build, November 2026)
**Owner:** Harshil Vanani

## Problem
Volunteer opportunities were shared in WhatsApp groups and spreadsheets.
- Volunteers could not see what was open near them.
- Organizers could not see who had signed up, so roles were overbooked or left empty.
- Nobody tracked work done or hours served.

## Users
- **Visitor:** browses public seva and sees which organization runs each one.
- **Volunteer:**
  - completes onboarding (interests, availability, location)
  - joins seva and reports progress
  - sees verified hours
- **Organizer:**
  - publishes events with seva tasks
  - reviews progress and logs hours when an event ends

## Scope
- **In scope:**
  - Discover with filters (fits my week, this weekend, virtual, distance)
  - two kinds of seva: role-based (positions) and quantity-based (e.g. 40 calls, 120 meals)
  - join, change quantity, leave
  - progress reports, with approve, adjust or reject by the organizer
  - notifications and reminders
- **Out of scope:**
  - chat
  - check-in by QR (decided against)

## Data model
- `profiles`, `availability_slots` (weekday × morning / afternoon / evening)
- `organizations`, `org_members` (owner or organizer)
- `events` → `seva_tasks` → `assignments` → `progress_reports`
- `event_hours`: hours logged when an event is completed
- `notifications`, `push_tokens`
- **Counters stored on `seva_tasks`:** claimed, volunteers, verified, pending. Triggers keep them correct, so lists never count rows.

Migrations:
- `20261107000001_schema.sql`
- `20261107000002_logic.sql`
- `20261107000003_rls.sql`
- `20261114000010_organizer_tools.sql` (hours)

## API / RPC
| Function | Who | What |
|---|---|---|
| `join_task(task, qty)` | volunteer | Locks the seva row, checks capacity, deadline, privacy and required course, then creates the assignment. Returns `joined`, `full` or `capacity_changed`. |
| `update_claim`, `leave_task` | volunteer | Change or give back a claim |
| `submit_progress` | volunteer | Report units done (pending until reviewed) |
| `review_progress` | organizer | Approve, adjust with a reason, or reject |
| `complete_event(event, hours)` | organizer | Logs hours per volunteer and marks the event completed. `reopen_event` undoes it. |
| `volunteer_stats` | self / organizer | Hours, completed, active |

## Security & privacy
- Row-level security on every table.
- Volunteers see only their own assignments and reports.
- Organizers see those of their own events.
- Exact location is never shown to others.
- Event contact details and online links are visible only to people who joined.

## Scalability
- Joining locks one seva row (`select … for update`), so two people can never take the last spot.
- Discover reads stored counters, with indexes on event status and dates.

## AWS impact
- Everything except sign-in is plain PostgreSQL and moves to Aurora unchanged.
- Reminders run with `pg_cron` + `pg_net` today. On AWS they move to EventBridge Scheduler + Lambda ([ADR-003](../adr/003-aws-migration.md)).

## Test plan
- `supabase/tests/001_workflow.sql`: 31 checks (join, capacity, reports, review)
- `002_organizer_writes.sql`
- `003_reminders.sql`
