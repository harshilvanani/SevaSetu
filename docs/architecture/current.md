# Architecture today (as built, November 2026)

Image for slides: [`img/current.png`](img/current.png) (also `img/current.svg`). Regenerate it whenever the diagram below changes.

```mermaid
flowchart LR
  subgraph Users
    VOL[Volunteers]
    ORG[Organizers]
    ADM[Platform admins]
    DON[Donors / visitors]
  end

  subgraph Clients
    WEB["Web app + installable PWA<br/>Expo Router, React Native Web<br/>static files on Hostinger"]
    MOB["iOS / Android app<br/>Expo, same code"]
  end

  subgraph Supabase["Supabase (US, Oregon)"]
    AUTH["Auth<br/>email + password, Google, Apple<br/>issues JWT"]
    REST["REST + RPC API<br/>PostgREST"]
    DB[("PostgreSQL<br/>row-level security on every table<br/>business rules as SQL functions<br/>triggers keep counters")]
    EDGE["Edge Functions<br/>stripe-connect · donate-checkout<br/>stripe-webhook · send-push"]
    CRON["pg_cron + pg_net<br/>reminders hourly<br/>invitation expiry daily"]
  end

  STRIPE["Stripe Connect<br/>each organization's own account"]
  PUSH["Expo push service"]
  GOOGLE["Google / Apple sign-in"]

  VOL & ORG & ADM & DON --> WEB
  VOL & ORG --> MOB
  WEB & MOB -->|sign in| AUTH
  AUTH --- GOOGLE
  WEB & MOB -->|"HTTPS + JWT<br/>supabase-js"| REST
  REST --> DB
  WEB & MOB -->|donate, connect| EDGE
  EDGE --> DB
  EDGE <-->|Checkout, Accounts v2, webhooks| STRIPE
  CRON --> DB
  CRON -->|send-push| EDGE
  EDGE --> PUSH
```

## Notes
- **One database holds all the rules.** Capacity, privacy, hours, matching and demo separation are enforced in PostgreSQL, so web, mobile and any future client get the same behaviour.
- **The website is static files.** The build (`npm run build:web`) is uploaded to Hostinger. `.htaccess` adds HTTPS, deep links and security headers (CSP, frame, HSTS, permissions).
- **Secrets are server-side only.** The app holds only the public Supabase URL and anon key. Stripe keys live in Supabase function secrets.
- **Deployments:**
  - database: `node scripts/db.mjs migrate`
  - functions: `node scripts/deploy-functions.mjs`
  - website: zip upload
