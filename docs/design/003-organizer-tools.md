# 003 · Organizer tools: templates, private events, find volunteers

**Status:** Released (doc written after the build, November 2026)

## Problem
- Organizers re-create the same events (Part 1 course, Satsang, cleanups) by hand.
- Courses are private and need a request or invite step.
- Organizers cannot see who would be a good fit for a seva.

## Users
Organizers (owner or organizer role) of an approved organization, and the volunteers they invite.

## Scope
- **Event templates:** built-in and per organization, in English, Hindi and French, with suggested seva.
- **Seva visibility:** each seva follows its event (private event, private seva).
- **Private events:**
  - volunteers see the name and date and can request to join
  - organizers approve, decline, invite or remove access
- **Complete event:**
  - hours are pre-filled from the schedule or verified units, and can be edited
  - the event can be reopened
- **Find volunteers:**
  - ranked by interest, skills, course, availability and distance
  - later replaced by the weighted match score in 006
- **Volunteer CSV export** per event.

## Data model
- `event_templates`, `event_template_tasks`
- `event_access`: requested / invited / approved / declined / revoked
- `event_hours`
- `profiles.courses`, `seva_tasks.required_courses`

Migrations:
- `20261114000010_organizer_tools.sql`
- `20261114000011_profile_visibility.sql`
- `20261115000012_round5.sql`

## API / RPC
- **Private events:**
  - `list_private_events`, `request_event_access`
  - `respond_event_request`, `invite_to_event`, `revoke_event_access`
- **Hours:** `event_hours_candidates`, `complete_event`, `reopen_event`
- **Matching:** `find_volunteers(event, task, skills, only_available, only_near, tz, courses)`. Returns no contact details, and at most 50 people.

## Security & privacy
- An organizer can open a full profile only when that person came to them: joined, requested or accepted an invitation.
- Search results show name, area, interests, skills and availability, but never email or exact location.
- Removing access also cancels that person's open spots.

## Scalability
Search is limited to 50 results. The time-window math runs in SQL, in the organizer's time zone.

## AWS impact
None beyond the database move.

## Test plan
- `006_organizer_tools.sql`: 43 checks
- `007_round5.sql`: 18 checks
