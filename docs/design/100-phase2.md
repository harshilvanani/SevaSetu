# 100 · Phase 2: recognition, announcements, feedback, event application form

**Status:** Draft for review. No code has been written.
**Owner:** Harshil Vanani
**Reviewers:** Jatin Maru, coordinators

## Problem
- **Recognition:** volunteers have no recognition for milestones (SEVAKS: 100-hour certificates).
- **Announcements:** coordinators message volunteers through WhatsApp with no targeting.
- **Feedback:** there is no feedback after seva, so coordinators can't tell what went well.
- **Applications:** big events like the December 25–29 Retreat Seva use a long Google Form with:
  - availability and arrival dates
  - housing preference
  - experience by department
  - a health disclosure and a waiver
  - manual accept / decline

  The mock spreadsheet shows the data is hard to review and holds sensitive answers in plain view.

## Users
- **Volunteer:** earns badges, downloads certificates, reads announcements, gives feedback, applies to events.
- **Organizer:** sends announcements, reads feedback, builds application forms, reviews applications.
- **Admin:** sets the badge levels.

## Scope
### A. Badges and certificates
- Badges at 25, 50 and 100 hours, and at 10 completed seva. A first-seva badge.
- A certificate PDF at 100 hours, with name, hours, date range and organization.
- Volunteer 360 shows badges. The organizer directory shows the highest badge.

### B. Announcements
- **Audience:**
  - everyone in the directory, or
  - filtered by seva area, region, team or event (people joined or applied)
- **Delivery:** in-app notification, push, and email (opt-out per volunteer).
- **Limit:** 5 announcements per organization per day.

### C. Feedback
- After an event is completed, each volunteer gets a 1–5 rating and an optional comment (500 characters).
- Organizers can add a private note about a volunteer, visible to their own organization only.
- Organizers see average rating per event and per seva area on the Impact page.

### D. Event application form (from the mock spreadsheet)
- **Organizer** switches an event to "application needed" and picks the sections:
  - availability window and arrival date
  - housing preference (with the seva contribution amount shown)
  - department experience levels (they fill skill levels on the profile)
  - languages
  - driving
  - agreement and waiver: typed full name as signature, with a timestamp
  - health disclosure, optional
- **Health disclosure:** stored separately, visible only to the event's organizers, and deleted automatically 30 days after the event ends.
- **Review:** list with filters and match %.
  - Accept → joins the chosen seva.
  - Waitlist, or decline.
  - After the deadline, a "not selected" message goes automatically, as the Google Form promised.
- **Out of scope:**
  - payment of the housing contribution (link to the Give page for now)
  - criminal-record questions: handled outside the app by the vulnerable-sector check process

## Data model (proposed)
- `badges` (key, threshold_hours, threshold_seva); `profile_badges` (user, badge, earned_at)
- `announcements` (org, title, body, audience jsonb, sent_at, sent_by); recipients become notifications
- `seva_feedback` (assignment, rating, comment, created_at); `volunteer_notes` (org, user, note, author)
- **Applications:**
  - `event_forms` (event, sections jsonb, deadline)
  - `event_applications` (event, user, answers jsonb, status: applied / accepted / waitlisted / declined, decided_by)
  - `application_health` (application, disclosure text, delete_after)

## API / RPC (proposed)
- `award_badges()`: runs after `complete_event`
- `certificate(user)`: Lambda that renders a PDF to S3 and returns a short-lived link
- `send_announcement(org, audience, title, body)`
- `submit_feedback(assignment, rating, comment)`
- `apply_to_event(event, answers)`, `decide_application(application, status, task)`
- `purge_health_disclosures()`: scheduled daily

## Security & privacy
- Health text is visible only to organizers of that event and is deleted automatically. It never appears in exports.
- Feedback comments are visible to organizers, not other volunteers.
- Private notes stay inside one organization.
- Announcements reach only people in the directory (consent).
- Privacy policy update needed for applications, feedback and certificates.

## Scalability
- **Announcement fan-out:** one insert per recipient into notifications.
  - At 50,000 recipients, run it as a background job in batches of 1,000 (EventBridge + Lambda on AWS).
- **Badges:** calculated incrementally, only for the volunteers of the completed event.

## AWS impact
- **Certificates:** Lambda + S3.
- **Email:** SES.
- **Fan-out and the health purge:** EventBridge Scheduler + Lambda.
- **Before the move:** Supabase Edge Function and pg_cron, written behind the same function names.

## Test plan
- pgTAP for each rule:
  - badge thresholds
  - announcement audience
  - feedback only by people who served
  - health text visible only to the event's organizers
  - the purge
  - application decisions joining the right seva
- Demo data: the December Retreat Seva gets an application form, with the 60 mock applicants as applications.

## Rollout
1. Badges and feedback (low risk)
2. Announcements (in-app first, then email)
3. Application form, piloted on the December Retreat Seva

## Open questions
| Question | Owner | Answer |
|---|---|---|
| Who signs the certificate (organization or national team)? | Harshil | |
| Are badge levels the same for every organization? | Jatin | |
| Is the waiver text final, and who approves changes? | Legal / national team | |
| How long should applications be kept after an event? | Harshil | |
