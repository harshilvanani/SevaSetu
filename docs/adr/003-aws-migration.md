# ADR-003 · Move to AWS, and stay portable until then

**Status:** Accepted direction (November 2026). Timing to be decided by stakeholders.

## Context
- Stakeholders prefer that everything runs on AWS, and the SEVAKS technical design assumed AWS.
- SevaSetu was built on Supabase for speed. Supabase is PostgreSQL plus managed sign-in, API and functions.

## Decision
Build so the move is a lift, not a rewrite, and move in phases.

### Mapping
| Today (Supabase / Hostinger) | AWS | How it moves |
|---|---|---|
| PostgreSQL + RLS + SQL functions | Aurora PostgreSQL Serverless v2 | Same migrations, `pg_dump` / restore |
| REST + RPC API (PostgREST) | PostgREST on ECS Fargate behind API Gateway | Same API; the app changes only its base URL |
| Auth (email, Google, Apple) | Cognito | Import users; IDs kept; tokens carry the same `sub` |
| `auth.uid()` in SQL | `public.current_user_id()` | Reads `sub` from the JWT on both platforms (see below) |
| Edge Functions (Stripe ×3, push) | Lambda | Same logic; Deno → Node runtime |
| `pg_cron` + `pg_net` | EventBridge Scheduler + Lambda | Job by job |
| Website on Hostinger | S3 + CloudFront + WAF | Same build output |
| Function secrets | Secrets Manager | |
| Supabase logs | CloudWatch + X-Ray | |

### Supabase-only pieces in the code today (inventory, 23 November 2026)
- **`auth.uid()`:** 119 uses across 11 migration files.
  - `public.current_user_id()` now exists, defined so it works on both platforms.
  - New code uses `current_user_id()`.
  - The existing uses are switched in one migration during phase 3 below, and re-tested with the full pgTAP suite.
- **`supabase-js` in the app:**
  - `from()` and `rpc()` talk to PostgREST, which stays.
  - `supabase.auth` is used in `src/features/auth/` only. It is replaced by a Cognito adapter with the same functions (sign in, sign up, Google, Apple, reset, sign out).
- **`supabase.functions.invoke`:** used in `src/features/donations/api.ts` only. It becomes a `fetch` to the API Gateway route.
- **`pg_net`:** used for push only (`20261107000006_reminders_push.sql`).
- **Storage, realtime:** not used.

### Phases
1. **Foundation:**
   - AWS accounts (dev / staging / prod) and IAM Identity Center
   - CDK stacks (`infra/`), CI/CD, CloudWatch alarms, AWS Budgets
2. **Database:**
   - Aurora in staging
   - run all migrations and all pgTAP tests
   - load-test with k6
3. **Identity:**
   - Cognito pool with Google and Apple
   - migrate users
   - switch SQL to `current_user_id()`
   - Cognito adapter in the app
4. **API and functions:** PostgREST on Fargate, the Stripe Lambdas, EventBridge jobs, SES.
5. **Website:** S3 + CloudFront + WAF; DNS through Route 53.
6. **Cutover:**
   - announce a short maintenance window
   - final `pg_dump` / restore
   - switch the Stripe webhook URL and DNS
   - keep Supabase read-only for 30 days as fallback

## Rule while developing
- Every new feature must run on plain PostgreSQL.
- Anything Supabase-only needs an adapter and an "AWS impact" note in its design doc.

## Consequences
- **Sign-in is the biggest change.** Users keep their accounts, but Google and Apple sign-in must be set up again in Cognito.
- **Running cost changes:**
  - from fixed Supabase and Hostinger plans
  - to AWS pay-per-use, with Aurora as the main cost
  - an estimate goes in the phase 1 design doc
