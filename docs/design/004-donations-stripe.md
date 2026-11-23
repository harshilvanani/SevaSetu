# 004 · Donations with Stripe Connect

**Status:** Released (doc written after the build, November 2026). Pending: one full test payment on the live site.

## Problem
Centres collect donations through separate links (for example Zeffy). We want donation campaigns next to the events they support, with each centre receiving its own money.

## Users
- **Donor:** may be signed in or a visitor. Gives once or monthly, and can choose to cover the fees.
- **Organization owner:**
  - connects the organization's own Stripe account
  - creates campaigns: draft → active → closed
- **Organizers:** see donations and totals.

## Scope
- **Stripe Connect** with Accounts v2. Each organization is its own connected account.
- **Direct charges:** money goes straight to that organization, and Stripe emails the receipt.
- **Campaigns:** goal, preset amounts, optional event link, monthly option.
- **Out of scope:**
  - SevaSetu-issued tax receipts (Stripe or the organization issues them)
  - platform fees

## Data model
- `org_payments`: connected account id, charges enabled
- `donation_campaigns`
- `donations`: status pending → paid / not completed / refunded. Totals are kept by a trigger.

Migration: `20261115000012_round5.sql`

## Functions (Supabase Edge Functions today, Lambda after the move)
| Function | What |
|---|---|
| `stripe-connect` | Owner-only. Creates or links the connected account and returns the onboarding link. |
| `donate-checkout` | Creates a pending donation and a Stripe Checkout session on the organization's account. |
| `stripe-webhook` | Verifies the Stripe signature, matches donation id + session id + account + amount + currency, then marks it paid or refunded and notifies organizers. |

## Security & privacy
- Card details never reach SevaSetu.
- Webhook checks were added after the security review (see 005).
- Stripe keys are kept in server secrets, never in the app.

## Scalability
Stripe handles the payment load. One webhook call per payment event.

## AWS impact
- The three functions become Lambda behind API Gateway.
- Stripe keys move to Secrets Manager.
- The webhook URL is changed in Stripe at cutover.

## Test plan
- `007_round5.sql`
- REST checks recorded in the security review
- **Still open:** one card test payment (4242 4242 4242 4242) end to end on the live site.
