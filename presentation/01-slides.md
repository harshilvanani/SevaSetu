# Slide content (14 slides)

Each slide has:
- **Headline:** the slide title
- **Bullets:** keep them short; 3–5 per slide
- **Visual:** a file in this folder
- **Notes:** speaker notes (put them in the notes field, not on the slide)

---

## Slide 1 · Title
- **Headline:** SevaSetu
- **Subtitle:** Connecting hearts through seva. Volunteer coordination for The Art of Living.
- **Small line:** Progress update and plan · November 2026 · Harshil Vanani
- **Visual:** `logo/sevasetu-logo.png` on the plum background
- **Notes:**
  - Today I'll show what SevaSetu does now.
  - Then I'll answer the four points you asked about: design docs, architecture, AWS and scale.

---

## Slide 2 · The problem
- **Headline:** Seva runs on WhatsApp and spreadsheets
- **Bullets:**
  - Volunteers can't easily see which seva is open near them or online
  - Coordinators don't know who signed up, so roles are overbooked or left empty
  - Hours and impact aren't tracked, so leaders can't see the whole picture
  - Volunteer applications collect sensitive data in plain spreadsheets
- **Visual:** none (simple icons are fine)
- **Notes:** The December 25–29 Retreat Seva application form is a good example: a long Google Form, reviewed by hand, with health answers visible to anyone with the sheet.

---

## Slide 3 · What SevaSetu does today
- **Headline:** One place for volunteers, organizers and admins
- **Volunteers:** find seva near them or online, join in a tap, report progress, see verified hours, donate
- **Organizers:**
  - events from templates, private courses with requests and invites
  - find the right volunteers, log hours, donation campaigns
- **Admins:** review new organizations, keep the platform safe, run live demos
- **Live:** web app and installable app; iOS and Android in testing; English, Hindi, French
- **Visual:** `screenshots/06-discover-match.png` and `screenshots/12-phone-profile.png`
- **Notes:** It's live on the web today. Phones can install it from the browser, and the native apps are being tested.

---

## Slide 4 · The merged product
- **Headline:** SevaSetu + SevaConnect + SEVAKS, one product
- **Bullets:**
  - SevaSetu kept as the base: real sign-in, secured data, seva sign-up, hours, donations
  - SevaConnect's leadership screens rebuilt on real data: dashboard, Volunteer 360, regions, teams, calendar, impact
  - The SEVAKS requirements added: explained match score, skill levels, consent, accessibility, people reached
  - 60 sample applicants loaded for demos. Health and criminal-record answers deliberately **not** imported.
- **Visual:** `screenshots/01-dashboard.png` (large), with `screenshots/05-match-score.png` small
- **Notes:**
  - Every dashboard number comes from real seva records, not a mock-up.
  - Match score weights come from SEVAKS: skills 40, seva area 25, availability 20, location 10, experience 5.

---

## Slide 5 · Point 1: Design doc before implementing
- **Label:** Point 1 · Design docs
- **Headline:** Every feature starts with a reviewed design doc
- **Process (show as a 6-step flow):** Requirements → Design doc → Review → Build → Tests → Release notes
- **Every design doc covers:**
  - problem and scope, data changes, API
  - security and privacy, scalability
  - **AWS impact**, test plan, rollout, open questions
- **Already in the repository:**
  - a template
  - 6 docs for features already built
  - 4 architecture decision records
  - the **Phase 2 design, written before any code**
- **Visual:** a simple process diagram (draw it); optional thumbnail of `source-docs/design-process.md`
- **Notes:**
  - Rule: no code without a reviewed doc.
  - The Phase 2 doc covers badges and certificates, announcements, feedback and the event application form. It has open questions for the national team.

---

## Slide 6 · Point 2: Architecture today
- **Label:** Point 2 · Architecture
- **Headline:** Simple today: one secure database holds the rules
- **Bullets (beside or under the diagram):**
  - **Web and mobile** are one codebase (Expo)
  - **Supabase:** sign-in, database, API, server functions
  - **Rules live in the database:** capacity, privacy, hours, matching. Every app follows the same rules.
  - **Payments:** Stripe Connect, paid into each centre's own account
- **Visual:** `diagrams/architecture-today.png` (large)
- **Notes:** Because the rules are in the database, a new app or a move to another cloud doesn't need the rules rewritten.

---

## Slide 7 · Point 2: Target architecture on AWS
- **Label:** Point 2 · Architecture
- **Headline:** Where we're going: AWS, in Canada
- **Bullets:**
  - **Region:** ca-central-1 (Montréal), so volunteer data stays in Canada
  - **Website:** CloudFront + S3, protected by AWS WAF
  - **Sign-in:** Cognito, with MFA for admins
  - **API:** API Gateway → PostgREST on Fargate + Lambda functions
  - **Database:** Aurora PostgreSQL Serverless v2, Multi-AZ, same database code as today
- **Visual:** `diagrams/architecture-aws.png` (full width)
- **Notes:**
  - Today the data is in the US (Oregon), so moving improves privacy for Canadian and Québec volunteers.
  - Dev, staging and production run in separate AWS accounts.

---

## Slide 8 · Point 3: Built to move
- **Label:** Point 3 · AWS
- **Headline:** Most of SevaSetu moves as-is

| Today | On AWS | Effort |
|---|---|---|
| PostgreSQL + rules | Aurora PostgreSQL | Same code, backup and restore |
| REST API | PostgREST on Fargate | App barely changes |
| Sign-in | Cognito | Biggest change: users imported, same IDs |
| Server functions (Stripe) | Lambda | Small rewrite |
| Scheduled jobs | EventBridge Scheduler | Job by job |
| Website on Hostinger | S3 + CloudFront | Same files |

- **Visual:** the table
- **Notes:**
  - We counted every Supabase-only piece. The biggest is the built-in "current user" check, used 119 times in the database code.
  - A portable replacement that works with both Supabase and Cognito is already in place and tested.

---

## Slide 9 · Point 3: Migration plan
- **Label:** Point 3 · AWS
- **Headline:** Six phases, low risk, with a way back
- **Phases (show as a timeline):**
  1. **Foundation:** AWS accounts, CDK, CI/CD, monitoring, budgets
  2. **Database:** Aurora in staging; run all 212 automated checks; load test
  3. **Sign-in:** Cognito, user import, Google and Apple, admin MFA
  4. **API and functions:** PostgREST, Stripe on Lambda, scheduled jobs, email
  5. **Website:** S3 + CloudFront + WAF
  6. **Cutover:** short maintenance window, final data copy, switch DNS; Supabase kept read-only for 30 days as fallback
- **Rule while developing:** every new feature must run on plain PostgreSQL. Anything Supabase-only needs an adapter and a note in its design doc.
- **Visual:** timeline graphic (draw it)
- **Notes:** Timing depends on the decisions on slide 14 (account owner, budget, date).

---

## Slide 10 · Point 3: Cloud resources, already written
- **Label:** Point 3 · AWS
- **Headline:** The AWS setup is written as code, ready to review
- **Bullets:**
  - **AWS CDK (infrastructure as code):** 7 stacks, 132 AWS resources; dev, staging and production sizes
  - **Stacks:** network, database, sign-in, API, website, security (WAF), operations
  - **Security:** encryption with KMS, secrets in Secrets Manager, database with no internet route, WAF rate limits
  - **Operations:** reminders and dashboard summaries on schedules, alarms on payment failures, monthly budget alerts
  - **Status:** generates cleanly (no errors, no warnings); **not deployed**, no AWS cost yet
- **Visual:** optional small icons for the 7 stacks
- **Notes:** We can deploy to a dev account as soon as one exists. Production waits for the migration phases.

---

## Slide 11 · Point 4: Scalable by design
- **Label:** Point 4 · Scale
- **Headline:** Built to grow from day one
- **Bullets:**
  - **No double-booking:** sign-ups lock the seva, so the last spot can't be given twice, even in a rush
  - **Fast lists:** stored counters and indexes; every search has a limit
  - **One rule set** protects web, mobile and future apps
  - **Multi-organization:** organization, centre and region on every event
  - **Static website on a CDN:** cost and speed scale with traffic
- **Visual:** `diagrams/flow-join-seva.png`
- **Notes:** The join flow diagram shows the lock: two people pressing Join at the same moment are served one after the other.

---

## Slide 12 · Point 4: The path to 50,000 volunteers
- **Label:** Point 4 · Scale
- **Headline:** Targets: 50,000 volunteers, searches under 2 seconds, 99.9% uptime
- **On AWS:**
  - Aurora scales capacity automatically, with a read replica for dashboards
  - RDS Proxy absorbs connection spikes
  - Fargate and Lambda add capacity on demand
  - CloudFront caches the site worldwide
- **Known limits we will fix first:**
  - the directory shows at most 1,000 people (move to pages)
  - dashboard numbers recalculate on every view (store them, refresh every 15 minutes)
- **Proof:** a load-test script (k6) is ready for the staging copy
- **Visual:** `diagrams/data-model.png` small, or a simple growth graphic
- **Notes:** At 50,000 volunteers the biggest table is about 3 million notifications in a year. That is small for PostgreSQL with indexes, and an archive job keeps it small.

---

## Slide 13 · Security & governance
- **Headline:** Privacy and consent are built in
- **Bullets:**
  - **Access rules on every table**, and an audit log of every admin action
  - **Security review done:** all critical and high issues fixed and tested
  - **Consent:**
    - volunteers choose to appear in directories
    - LinkedIn only with permission
    - accessibility needs stay private
  - **Sensitive application data** (health, criminal record) is never imported
  - **On AWS:** admin MFA, WAF rate limits, encryption everywhere, data kept in Canada
- **Visual:** `screenshots/04-volunteer-360-own-profile.png` (small)
- **Notes:**
  - Medium items still open from the review: stronger password rules and a donate-endpoint rate limit.
  - The rate limit is already written into the AWS firewall setup.

---

## Slide 14 · Roadmap and decisions needed
- **Headline:** Next steps
- **Now:**
  - publish the merged version
  - one live test donation
  - finish the security items
- **Next:** Phase 2:
  - badges and certificates
  - announcements
  - feedback
  - event application form (pilot on the December Retreat Seva)
- **Then:** the AWS move, phases 1–6
- **Decisions needed from you:**
  - Who owns the AWS accounts?
  - Monthly budget approval
  - Target date for the move
  - Import the 2023 volunteer data?
  - Answers to the Phase 2 open questions (certificate signer, badge levels, waiver text, how long applications are kept)
- **Visual:** a simple three-column roadmap (Now / Next / Then)
- **Notes:** End by asking for the decisions. Each one unblocks a specific phase.
