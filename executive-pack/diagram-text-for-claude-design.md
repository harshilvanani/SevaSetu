# Text versions for Claude Design

Use these if you want Claude Design to draw the diagrams as native, editable slide shapes instead of placing the PNGs.

**Style for every flow:**
- swimlane: one row per person, steps left to right, numbered circles
- arrows between consecutive steps
- solid boxes for live steps; dashed orange boxes tagged "Planned" for Phase 2 steps
- one info line under the diagram

Colours:
- Volunteer rows: orange
- SevaSetu rows: purple
- Organizer rows: green
- Admin rows: plum

## Volunteer journey

### V1 · Sign up and build a profile
Image: `flows/v1-sign-up-and-profile.png`
Rows: Volunteer | SevaSetu

1. **Volunteer:** Signs up with email, Google or Apple
2. **SevaSetu:** Confirms email and starts setup
3. **Volunteer:** Picks seva areas and skills
4. **Volunteer:** Sets weekly availability and city
5. **SevaSetu:** Creates Volunteer 360 profile and ID
6. **SevaSetu:** Shows best-matching seva

Info line: Courses, languages, LinkedIn (only with consent) and private accessibility needs can be added any time.

### V2 · Find and join a seva
Image: `flows/v2-find-and-join-seva.png`
Rows: Volunteer | SevaSetu | Organizer

1. **Volunteer:** Opens Discover: seva nearby or online
2. **SevaSetu:** Shows a match % for each seva
3. **Volunteer:** Taps Join
4. **SevaSetu:** Reserves a spot (never overbooks)
5. **SevaSetu:** Confirms and sends reminders
6. **Organizer:** Sees the volunteer on the roster

Info line: If the last spot is taken at the same moment, the volunteer is told right away; no seva is ever double-booked.

### V3 · Report progress and earn verified hours
Image: `flows/v3-report-progress-and-hours.png`
Rows: Volunteer | SevaSetu | Organizer

1. **Volunteer:** Does the seva
2. **Volunteer:** Reports progress (e.g. 8 of 12 meals)
3. **SevaSetu:** Sends it for review
4. **Organizer:** Approves or adjusts
5. **SevaSetu:** Records verified hours
6. **Volunteer:** Sees hours on profile

Info line: For role seva such as hall setup, hours are recorded when the organizer completes the event.

### V4 · Ask to join a private course
Image: `flows/v4-join-private-course.png`
Rows: Volunteer | SevaSetu | Organizer

1. **Volunteer:** Sees private course: name and date only
2. **Volunteer:** Asks to join
3. **SevaSetu:** Tells the organizer
4. **Organizer:** Approves (or invites people directly)
5. **SevaSetu:** Unlocks course details and seva
6. **Volunteer:** Joins a seva

Info line: Organizers can remove access at any time; that person’s open spots are released.

### V5 · Join a standing team
Image: `flows/v5-join-a-team.png`
Rows: Volunteer | SevaSetu | Organizer

1. **Organizer:** Invites volunteer to a team
2. **SevaSetu:** Sends the invitation
3. **Volunteer:** Sees invitation on profile
4. **Volunteer:** Accepts or declines
5. **SevaSetu:** Adds to team, tells organizer
6. **Organizer:** Team staffing updates

Info line: Nobody is added to a team without saying yes.

## Organizer journey

### O1 · Create and publish an event
Image: `flows/o1-create-and-publish-event.png`
Rows: Organizer | SevaSetu | Volunteers

1. **Organizer:** Picks a template (e.g. Satsang, Part 1)
2. **Organizer:** Sets date, centre and seva roles
3. **SevaSetu:** Checks it is ready to publish
4. **Organizer:** Publishes, optionally weekly
5. **SevaSetu:** Lists it on Discover (or private)
6. **Volunteers:** Volunteers can join

Info line: Templates in English, Hindi and French. “Repeat weekly” creates 4, 8 or 12 copies in one step.

### O2 · Find and invite the right volunteers
Image: `flows/o2-find-and-invite-volunteers.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Organizer:** Opens Find volunteers for a seva
2. **SevaSetu:** Ranks people by match %
3. **Organizer:** Sees why: skills, area, time, distance
4. **Organizer:** Invites the best fits
5. **Volunteer:** Gets invitation and joins
6. **SevaSetu:** Roster and staffing update

Info line: Results show name, area and skills only: no email or exact address until the person joins.

### O3 · Review volunteers’ progress
Image: `flows/o3-review-progress.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Volunteer:** Submits a progress report
2. **SevaSetu:** Adds it to the review queue
3. **Organizer:** Opens Reviews
4. **Organizer:** Approves, adjusts with a reason, or rejects
5. **SevaSetu:** Updates totals and hours
6. **Volunteer:** Is told the result

Info line: Pending and verified work are always shown separately, so totals are never overstated.

### O4 · Complete an event and log hours
Image: `flows/o4-complete-event-and-log-hours.png`
Rows: Organizer | SevaSetu | Volunteers

1. **Organizer:** Event ends: taps Complete event
2. **SevaSetu:** Pre-fills hours for each volunteer
3. **Organizer:** Adjusts hours, adds people reached
4. **SevaSetu:** Saves hours, marks event complete
5. **Volunteers:** See their hours
6. **SevaSetu:** Dashboard and impact update

Info line: If a mistake is found, the organizer can reopen the event; logged hours are kept.

### O5 · Build a team with Team Builder
Image: `flows/o5-build-a-team.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Organizer:** Creates a team: area, centre, size
2. **SevaSetu:** Shows skills the team is missing
3. **SevaSetu:** Suggests people who fit
4. **Organizer:** Invites suggested people
5. **Volunteer:** Accepts the invitation
6. **Organizer:** Chooses a team lead

Info line: Suggestions come only from the centre’s directory: people who served there or chose to be found.

### O6 · See the network and act on alerts
Image: `flows/o6-dashboard-and-alerts.png`
Rows: Leader / Organizer | SevaSetu

1. **SevaSetu:** Gathers hours, events and regions
2. **Leader / Organizer:** Opens the Dashboard
3. **SevaSetu:** Flags what needs action
4. **Leader / Organizer:** Taps an alert
5. **SevaSetu:** Opens the fix (e.g. Find volunteers)
6. **Leader / Organizer:** Uses Impact for reports

Info line: Alerts: event short of volunteers, almost full, hours not logged, profiles missing availability, reports to review.

## Admin journey

### A1 · Approve a new centre
Image: `flows/a1-approve-new-centre.png`
Rows: New centre | SevaSetu | Admin

1. **New centre:** Applies to organize: name, city
2. **SevaSetu:** Adds it to the review queue
3. **Admin:** Reviews the details
4. **Admin:** Approves, or rejects with a reason
5. **SevaSetu:** Tells the centre
6. **New centre:** Can publish events

Info line: A rejected centre can fix its details and apply again. Every admin decision is recorded.

### A2 · Keep the platform safe
Image: `flows/a2-keep-platform-safe.png`
Rows: Admin | SevaSetu | People affected

1. **Admin:** Spots a problem
2. **Admin:** Blocks a user or cancels an event, with a reason
3. **SevaSetu:** Releases spots, stops new activity
4. **People affected:** Volunteers and organizers are told
5. **SevaSetu:** Records it in the audit log
6. **Admin:** Can undo any time

Info line: Blocked accounts cannot join, report or create anything until an admin unblocks them.

### A3 · Run a live demo safely
Image: `flows/a3-demo-mode.png`
Rows: Admin | SevaSetu

1. **Admin:** Opens Demo mode
2. **Admin:** Chooses View as volunteer or organizer
3. **SevaSetu:** Switches to the sample world
4. **Admin:** Presents live
5. **Admin:** Switches back to admin
6. **SevaSetu:** Reset restores the sample data

Info line: Sample people and centres are walled off: real users never see them and real records are never shown.

## Planned · Phase 2

### F1 · Apply for a big event (e.g. retreat seva)
Image: `flows/f1-event-application-form.png`
Rows: Volunteer | SevaSetu | Organizer

1. **Organizer:** Turns on Application needed *(Planned)*
2. **Volunteer:** Applies: dates, housing, experience, waiver *(Planned)*
3. **SevaSetu:** Keeps health answers private *(Planned)*
4. **Organizer:** Reviews with match % and filters *(Planned)*
5. **Organizer:** Accepts, waitlists or declines *(Planned)*
6. **SevaSetu:** Places accepted people in seva *(Planned)*
7. **SevaSetu:** Deletes health answers after the event *(Planned)*

Info line: Replaces the long Google Form. People not selected are told automatically after the deadline.

### F2 · Recognise milestones
Image: `flows/f2-badges-and-certificates.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Organizer:** Completes an event
2. **SevaSetu:** Adds hours to each total
3. **SevaSetu:** Awards badges at 25, 50, 100 hours *(Planned)*
4. **Volunteer:** Sees the badge on profile *(Planned)*
5. **Volunteer:** Downloads 100-hour certificate *(Planned)*
6. **Organizer:** Sees badges in the directory *(Planned)*

Info line: Badge levels and the certificate signer are open questions for the national team.

### F3 · Send an announcement to the right people
Image: `flows/f3-announcements.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Organizer:** Writes a message *(Planned)*
2. **Organizer:** Chooses who: area, region, team or event *(Planned)*
3. **SevaSetu:** Checks consent and daily limit *(Planned)*
4. **SevaSetu:** Sends in-app, push and email *(Planned)*
5. **Volunteer:** Reads it; can opt out of email *(Planned)*

Info line: Replaces broad WhatsApp blasts with targeted messages to people who agreed to hear from the centre.

### F4 · Collect feedback after seva
Image: `flows/f4-feedback-after-seva.png`
Rows: Organizer | SevaSetu | Volunteer

1. **Organizer:** Completes an event
2. **SevaSetu:** Asks volunteers for a 1–5 rating *(Planned)*
3. **Volunteer:** Rates and comments *(Planned)*
4. **Organizer:** Adds a private note (optional) *(Planned)*
5. **SevaSetu:** Shows averages on Impact *(Planned)*
6. **Organizer:** Improves the next event *(Planned)*

Info line: Comments are seen by organizers only; private notes stay inside one centre.

## Architecture

Two versions of each diagram:
- Executive version: plain words only
- Named version: plain words plus product names under them

Tags: "New" = orange, "Upgraded" = purple.

### SevaSetu today: simple, and live
Images: `architecture/architecture-today.png` and `architecture/architecture-today-named.png`
Subtitle: One secure service holds every rule, so web and phone apps behave the same.

- **Who uses it**:
  - Volunteers — Find seva, join, see hours
  - Organizers and coordinators — Events, people, hours
  - Platform admins — Approve centres, keep it safe
- **Apps**:
  - Website and installable app — Works on any phone or computer · *Expo web app · hosted on Hostinger*
  - iPhone and Android apps — In testing · *Expo (React Native) · Expo Go*
- **SevaSetu service** (hosted by Supabase · data in the United States):
  - Sign-in — Email, Google or Apple · *Supabase Auth*
  - Secure database with the rules — Spots, privacy, hours and matching are enforced here for everyone · *PostgreSQL · row-level security · SQL functions*
  - Reminders — Hourly and daily · *pg_cron*
  - Server tasks — Payments, push · *Supabase Edge Functions*
- **Outside services**:
  - Google and Apple sign-in · *OAuth*
  - Payments — Donations · *Stripe Connect*
  - Phone notifications · *Expo push*

Arrows: Volunteers → Website and installable app; Volunteers → iPhone and Android apps; Organizers and coordinators → Website and installable app; Platform admins → Website and installable app; Website and installable app → Sign-in; Website and installable app → Secure database with the rules; iPhone and Android apps → Secure database with the rules; Sign-in → Google and Apple sign-in; Server tasks → Payments; Server tasks → Phone notifications

Footer: Live today on the web · iPhone and Android in testing · English, Hindi, French

### SevaSetu on AWS: in Canada, built to grow
Images: `architecture/architecture-future.png` and `architecture/architecture-future-named.png`
Subtitle: Same app and the same rules, on a cloud that grows with the number of volunteers.

- **Who uses it**:
  - Volunteers — Find seva, join, see hours
  - Organizers and coordinators — Events, people, hours
  - Leaders — Dashboards, impact
  - Platform admins — 2-step sign-in
- **Apps**:
  - Website and installable app — Fast everywhere · *S3 + CloudFront* **[Upgraded]**
  - iPhone app — On the App Store · *Expo · EAS build* **[New]**
  - Android app — On Google Play · *Expo · EAS build* **[New]**
- **Front door**:
  - Firewall and fast delivery — Blocks attacks and floods · *AWS WAF · CloudFront · Route 53* **[New]**
- **SevaSetu on AWS** (Canada (Montréal) · dev, test and live kept separate):
  - Sign-in — 2-step for admins · *Amazon Cognito* **[Upgraded]**
  - App services — Grow on demand · *API Gateway · Fargate · Lambda*
  - Secure database with the rules — Same rules as today; grows automatically; copies in 2 data centres · *Aurora PostgreSQL Serverless v2 · Multi-AZ* **[Upgraded]**
  - Scheduled jobs — Reminders, summaries · *EventBridge*
  - Email — Sign-up, updates · *Amazon SES* **[New]**
  - File storage — Certificates · *Amazon S3* **[New]**
  - Backups — 35 days, copy in Calgary · *Aurora backups · ca-west-1* **[New]**
  - Monitoring and cost alerts · *CloudWatch · Budgets* **[New]**
- **Outside services**:
  - Google and Apple sign-in · *OAuth*
  - Payments · *Stripe Connect*
  - Phone notifications · *Expo push*
  - App stores · *Apple · Google Play* **[New]**

Arrows: Volunteers → Website and installable app; Volunteers → iPhone app; Organizers and coordinators → Website and installable app; Organizers and coordinators → Android app; Leaders → Website and installable app; Platform admins → Website and installable app; Website and installable app → Firewall and fast delivery; iPhone app → Firewall and fast delivery; Android app → Firewall and fast delivery; Firewall and fast delivery → Sign-in; Firewall and fast delivery → Secure database with the rules; App services → Google and Apple sign-in; App services → Payments; App services → Phone notifications

Footer: Planned move in 6 phases · nothing changes for volunteers except speed and new phone apps

### What changes from today to the future
Image: `architecture/scope-today-vs-future.png`

| | Today | Future (on AWS) |
|---|---|---|
| Who uses it | Volunteers, organizers, admins | Same, plus leaders with dashboards and 2-step sign-in for admins |
| Apps | Website and installable app; phone apps in testing | Website, plus iPhone and Android apps in the stores |
| Where it runs | Supabase (United States) and Hostinger | AWS in Canada (Montréal), backup copy in Calgary |
| Rules and data | One secure database with all the rules | Same database and rules, grows automatically, 2 data centres |
| Safety | Access rules, audit log, security review | Plus firewall, rate limits, encryption keys, monitoring |
| Growth | Hundreds of volunteers | Up to 50,000 volunteers, searches under 2 seconds |
| New features | Discover, join, hours, teams, dashboard, impact | Plus application forms, badges, announcements, feedback |
