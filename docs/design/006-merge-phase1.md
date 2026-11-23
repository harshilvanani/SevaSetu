# 006 · Merge phase 1: SevaConnect + SEVAKS into SevaSetu

**Status:** Released (21 November 2026)
**Inputs:**
- SEVAKS Product Requirements and Technical Design (Jatin Maru, Harshil Vanani)
- SevaConnect-FINAL (presentation build on mock data)
- the "December 25–29 Volunteer Application Responses" mock spreadsheet (60 rows)

## Problem
- SevaSetu handles day-to-day seva.
- SevaConnect showed the leadership view (dashboard, regions, teams, impact) but only on mock data.
- SEVAKS defined requirements that SevaSetu did not meet: skill levels, an explained match score, consent, accessibility and people reached.

## Decisions (agreed with the product owner)
- **Phase 1:**
  - dashboard and impact
  - Volunteer 360 and match %
  - regions, teams and calendar
- **Phase 2:** badges, announcements, feedback, application form. No QR check-in.
- **Seva areas:** one merged list of 16. The internal keys did not change, so no existing data moved.
- **Directory:** people who served with the organization, are on its teams, or opted in.
- **Mock spreadsheet:** loaded as demo data. Health, criminal-record, emergency-contact, address, licence-plate, ID-photo, age and gender columns were not imported.
- **SevaConnect code:** not reused (browser-saved sample data); its design was rebuilt on SevaSetu data.
- **AWS:** see [ADR-003](../adr/003-aws-migration.md).

## Data model (migration `20261121000015_merge_phase1.sql`)
- **New profile fields:**
  - `person_type`, `volunteer_no` (shown as VOL-CA-000018 / TCH-…)
  - `country`, `province`, `region` (generated)
  - `languages`, `skill_levels` (beginner / intermediate / expert), `profession`
  - `linkedin_url` + `linkedin_consent`, `directory_opt_in`
- **New tables:**
  - `profile_private`: accessibility needs; self, admins and organizers of joined seva only
  - `centres`, plus `events.centre_id`
  - `teams`, `team_members` (invited / active, with a lead)
- **New event fields:** `events.people_reached`, `events.series_id` (weekly repeats)

## API / RPC
| Function | Purpose |
|---|---|
| `match_breakdown` (internal) | SEVAKS weights: skills 40, seva area 25, availability 20, location 10, experience 5, plus 3 for LinkedIn with consent |
| `find_volunteers` | Returns the score and the breakdown |
| `my_match_scores`, `my_open_matches` | Volunteer's own match on Discover and on the profile |
| `org_directory` | Consent-based directory; email only for people who served with the organization |
| `org_teams`, `team_suggestions`, `invite_to_team`, `respond_team_invite`, `remove_team_member`, `my_teams` | Teams and Team Builder |
| `org_insights` | KPIs, monthly hours, hours by area, regions, upcoming, data health, alerts |
| `repeat_event_weekly` | Copies an event and its seva for up to 26 weeks |
| `my_summary` | Volunteer 360 numbers |

## Security & privacy
- Directory consent and LinkedIn consent.
- Accessibility needs are private.
- Team membership needs the volunteer to accept.
- Privacy policy updated.

## Scalability (known limits, tracked)
- **Directory:** returns at most 1,000 people. Move to server-side pages before 10,000 volunteers in one organization.
- **`org_insights`:** recalculated on every view. Fine for thousands of volunteers; for 50,000, store a summary table refreshed every 15 minutes (EventBridge job on AWS).
- **Match scores:** calculated per candidate (up to 50) or per visible seva (up to 200).

## AWS impact
Plain PostgreSQL only; nothing Supabase-specific was added.

## Test plan
- `009_merge_phase1.sql`: 36 checks
- browser click-through as the demo organizer and volunteer, desktop and phone
