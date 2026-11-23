# 005 · Security review, November 2026

**Status:** Critical and high fixed and tested. Medium items partly open (listed below).

The full review is in the Claude Doc "SevaSetu security review". This page is the summary kept in the repository.

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | Critical | `public_profiles` view was writable by signed-in users and listed every user to visitors | Fixed: read-only, limited rows (migration 13) |
| 2 | High | An organizer could read anyone's email and location by inviting them | Fixed: profiles open only to people who came to the organizer; invite lists return names only |
| 3 | High | An organizer could undo an admin's cancellation or skip the hours step | Fixed: event status guard trigger |
| 4 | High | "Remove access" on a private event did not remove it | Fixed: removal also cancels open spots |
| 5 | Medium | Stripe webhook trusted the donation id alone | Fixed: id + session + account + amount + currency checked. Needs one live test payment |
| 6 | Medium | Any organizer (not only the owner) could open Stripe onboarding | Fixed: owner only |
| 7 | Medium | About 30 database functions were callable by visitors | Fixed: execute revoked from anonymous users |
| 8 | Medium | Missing browser protections (CSP, frame, HSTS, permissions) | Fixed in the website build; live after upload |
| 9 | Medium | Approved organizations could rename themselves without review | Fixed |
| 10 | Medium | Weak sign-in settings: no leaked-password check, 8-character minimum, no re-login before a password change, no captcha | **Open** |
| 11 | Medium | Public donate endpoint can be flooded with pending records | **Open**: rate limit planned (AWS WAF rate rules after the move) |
| extra | — | Invite search broken ("id is ambiguous") | Fixed (migration 14) |

**Tests:** `supabase/tests/008_security_hardening.sql` (26 checks). Browser checks were run with the production security headers in place.

**After the move to AWS:**
- AWS WAF adds rate limits and bot rules in front of the API and the donate endpoint.
- Cognito adds MFA for admins and a leaked-password check.
