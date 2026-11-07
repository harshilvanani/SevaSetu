# SevaSetu

**Connecting hearts through seva.** SevaSetu connects people who want to serve with organizations that need volunteers — from discovering a seva and joining (with capacity protection) to reporting progress and organizer-verified impact.

iOS, Android and web from one codebase: **Expo (SDK 58) + Expo Router + TypeScript**, backed by **Supabase** (Postgres, Auth, Row Level Security, RPC functions).

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm start              # press i / a / w, or scan the QR code with Expo Go
```

## Project layout

```
src/app/            Expo Router routes (each file is a screen)
  (auth)/           sign in / create account / forgot password
  (onboarding)/     location → interests & skills → weekly availability → review
  (app)/            tab shell: bottom tabs on phones, sidebar on desktop (≥1024px)
src/components/     design-system primitives (Button, Chip, Badge, ImpactBar, …)
src/features/       data hooks + feature logic per domain
src/domain/         pure business rules (capacity, progress, hours) + unit tests
src/locales/        en (source), hi, fr — hi/fr are type-checked against en
src/theme/tokens.ts colors, type scale, radius, spacing from the design foundations
supabase/
  migrations/       schema, business-logic RPCs, RLS policies
  tests/            pgTAP tests (capacity, privacy, review rules, permissions)
  seed.sql          demo data matching the design
scripts/            db.mjs (migrate/seed/test via Management API), gen-types.sh, gen-icons.js
```

## How the important rules are enforced

All of these live in the database, so no client can bypass them:

- **No overbooking.** `join_task()` locks the task row (`SELECT … FOR UPDATE`), re-checks remaining units/positions and per-volunteer limits, and returns `capacity_changed` with the amount still available if someone else got there first.
- **Private seva.** RLS hides private tasks/events from everyone except the organization's members and invited users. Invitations target existing users only.
- **Verified impact.** Counters on `seva_tasks` (`claimed_total`, `verified_total`, `pending_total`) are trigger-maintained. Pending reports are never counted as verified. Adjusting or rejecting a report requires a reason, kept in the audit history.
- **Organizations** need platform-admin approval before they can create events.
- **Verified hours.** Role tasks count the task's scheduled duration once the organizer marks the position as served. Quantity tasks count verified units × minutes-per-unit.

## Database workflow

```bash
export SUPABASE_PROJECT_REF=xxxx SUPABASE_ACCESS_TOKEN=sbp_xxx
npm run db:migrate   # apply new files in supabase/migrations
npm run db:seed      # load demo content
npm run db:test      # run pgTAP tests in rolled-back transactions on the hosted DB
npm run db:types     # regenerate src/lib/database.types.ts
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint and unit tests, plus the pgTAP suite against a local Supabase (`supabase db start && supabase test db`).

## One-time Supabase dashboard setup

In **Authentication → URL Configuration**:
- **Site URL:** your web URL (for local dev, `http://localhost:8081`)
- **Redirect URLs:** `sevasetu://**`, `exp://**`, `http://localhost:8081/**` (plus your production web URL)

In **Authentication → Providers**:
- **Google:** create OAuth credentials in Google Cloud Console (Web client). Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI, then paste the client ID/secret into Supabase.
- **Apple:** needs an Apple Developer account. Enable *Sign in with Apple* for bundle ID `org.sevasetu.app`, then add the bundle ID under *Client IDs* in the Supabase Apple provider. Native iOS sign-in uses ID tokens, so no secret is needed for the app itself.

In **Authentication → SMTP Settings**, configure a custom SMTP sender before launch. The built-in sender is limited to a few emails per hour.

**Platform admin:** after you sign up, mark your account as admin so you can approve organizations:

```sql
update profiles set is_platform_admin = true where email = 'you@example.com';
```

## Building for the stores

Uses EAS (`npx eas-cli@latest build`). This requires an Apple Developer account and a Google Play Console account. Until then, test with Expo Go or a development build.
