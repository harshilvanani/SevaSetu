# 002 · Admin console and demo mode

**Status:** Released (doc written after the build, November 2026)

## Problem
- Anyone can create an organization, so new organizations need review before they can publish.
- Live demos need realistic data without touching real volunteers.

## Users
- **Platform admin:**
  - reviews organizations (approve, reject with reason, suspend)
  - blocks users and grants admin
  - cancels events
  - reads the audit log
  - runs the demo
- **Demo personas:** Priya and Arjun (volunteers) and Meera (organizer).

## Scope
- **Admin console:** overview numbers, organizations, users, events, audit log, event templates, demo mode.
- **Demo mode:**
  - a separate demo world: demo users only see demo organizations, and the reverse
  - "View as volunteer / organizer" switch and "Reset demo"
- **Out of scope:** multiple admin levels. Coordinator and Executive roles come later.

## Data model
- **Organizations and profiles:**
  - `organizations.status`: pending / approved / rejected / suspended
  - `profiles.blocked_at`, `is_platform_admin`, `is_demo`; `organizations.is_demo`
- **Admin and demo tables:**
  - `admin_actions`: audit log of every admin action, with a reason
  - `demo_accounts`: demo logins, readable only by admins
  - `demo_volunteer_seed`: facts used to build the demo network (see 006)

Migrations:
- `20261112000008_admin_console.sql`
- `20261114000009_demo_mode.sql`
- `20261121000016_demo_network.sql`

## API / RPC
- **Admin actions:**
  - `admin_review_organization`, `admin_set_user_blocked`, `admin_set_platform_admin`, `admin_cancel_event`
  - each one checks `assert_platform_admin()` and writes to `admin_actions`
- **Demo:** `admin_demo_accounts`, `admin_reset_demo`
  - `reset_demo_data` = `reset_demo_core` + `seed_demo_network`

## Security & privacy
- **Demo wall:** triggers stop demo users from joining, inviting or creating anything in the real world. Real users never see demo data.
- **Blocked users** cannot join, report or create anything (`assert_not_blocked`).

## Scalability
Admin lists are filtered on the server, and the overview uses counts.

## AWS impact
None beyond the database move. Admin MFA comes from Cognito after the move.

## Test plan
- `004_admin_console.sql`: 28 checks
- `005_demo_mode.sql`: 15 checks
