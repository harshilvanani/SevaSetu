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

## Website

```bash
npm run build:web
```

This builds the website into `dist/`: the web app, an `.htaccess` (HTTPS, deep links such as `/seva/<id>`, caching), link-preview tags, and the files that make it installable on a phone or computer (`manifest.webmanifest`, `sw.js`, icons). Upload the contents of `dist/` to the site's `public_html`. Set `EXPO_PUBLIC_SITE_URL` in `.env` to the live address first.

## Demo mode

Super admins can try the app as a volunteer or an organizer without touching real data: **Admin console → Demo mode → View as…**. A banner at the top shows who you are viewing as, with **Switch to…** and **Back to admin**.

- Demo people and the demo organization (“Demo Seva Centre”) are walled off in the database: real users never see demo seva, demo accounts can't join real seva, and demo numbers are left out of the admin overview.
- **Reset demo data** (same page) puts the demo events, joins and reports back to the starting point.
- One-time setup per project, after `npm run db:migrate`: `node scripts/demo-setup.mjs` (needs the same `SUPABASE_PROJECT_REF` / `SUPABASE_ACCESS_TOKEN` as the database workflow). It creates the three demo logins with random passwords that only admins can read.

## Database workflow

```bash
export SUPABASE_PROJECT_REF=xxxx SUPABASE_ACCESS_TOKEN=sbp_xxx
npm run db:migrate   # apply new files in supabase/migrations
npm run db:seed      # load demo content
npm run db:test      # run pgTAP tests in rolled-back transactions on the hosted DB
npm run db:types     # regenerate src/lib/database.types.ts
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint and unit tests, plus the pgTAP suite against a local Supabase (`supabase db start && supabase test db`).

## Email links

Account-confirmation and password-reset emails always link to the **website** (`EXPO_PUBLIC_SITE_URL`), whichever app the person signed up from, so the links work on any device. Set it to the live web address, and add `<that address>/**` to Supabase's redirect URLs.

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

## Notifications

- **In-app inbox.** Database triggers write rows to `notifications`: joins, invitations, reports submitted and reviewed, served positions, organization approvals, and reminders. The bell and the Notifications screen read them.
- **Reminders.** `pg_cron` runs `send_seva_reminders()` hourly, which notifies volunteers once, about 24h before their seva. `expire_invitations()` runs daily.
- **Push.** Each new notification is POSTed to the `send-push` Edge Function, which sends it through Expo's push service. One-time setup:
  1. `npx eas-cli@latest init`, which adds the EAS project ID the app needs to request push tokens.
  2. `supabase functions deploy send-push --no-verify-jwt`
  3. `supabase secrets set PUSH_WEBHOOK_SECRET=<random string>`
  4. In the SQL editor:
     ```sql
     select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
     select vault.create_secret('<same random string>', 'push_webhook_secret');
     ```
  Until these exist, the trigger does nothing and the in-app inbox still works.

## Building for the stores

`eas.json` defines three profiles: `development` (dev client), `preview` (internal APK / ad-hoc) and `production`.

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform ios
```

Store builds need an Apple Developer account ($99/yr; also required for Sign in with Apple) and a Google Play Console account. Until then, test with Expo Go (`npm start`, then scan the QR code) or on the web (`npm run web`).

Bundle ID / package name: `org.sevasetu.app`. Change it in `app.json` before the first store build if you'd like a different one.
