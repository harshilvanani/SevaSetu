# NNN · Feature name

**Status:** Draft · In review · Approved · Released
**Owner:**
**Reviewers:**
**Date:**

## Problem
What is hard or impossible today, for whom, and how we know (requests, numbers, the SEVAKS section).

## Users
Who uses it (volunteer, organizer, admin, donor, visitor) and what each one can do.

## Scope
- In scope:
- Out of scope (and why):

## User flows
Step by step, screen by screen. Note empty states, errors and the phone layout.

## Data model changes
New or changed tables and columns, with constraints. Link the migration file once it exists.

## API / RPC changes
New SQL functions or Edge/Lambda functions: inputs, outputs, error codes, who may call them.

## Security & privacy
- Row-level security: who can read and write each new row
- Personal data collected, why, who sees it, how long it is kept
- Consent needed
- Privacy policy text to update

## Scalability
- Expected rows after 1 year at 50,000 volunteers
- Indexes needed
- Limits and pagination
- Anything recalculated on every request that should be stored instead

## AWS impact
- Does it use anything Supabase-only? If so, which adapter covers it?
- Which AWS service runs it after the move (Aurora, Lambda, EventBridge, S3, SES…)?

## Test plan
- Database tests (pgTAP) for each rule
- Screens to click through (desktop and phone; volunteer, organizer, admin)
- Demo data to add

## Rollout
- Migration order
- Feature visible to whom first (demo, one organization, everyone)
- How to undo

## Open questions
| Question | Owner | Answer |
|---|---|---|
