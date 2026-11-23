# ADR-004 · Keep volunteer data in Canada

**Status:** Proposed (November 2026)

## Context
- Most volunteers and organizations are in Canada, with some in the US northeast.
- The database is in the US (Oregon) on Supabase today, as the privacy policy says.
- Canadian privacy law (PIPEDA, and Québec's Law 25 for Québec residents) does not forbid storing data abroad. It does require openness about it, and assessments for transfers out of Québec.

## Decision
On AWS, run everything in **ca-central-1 (Montréal)**:
- database
- backups (copied to a second Canadian region, ca-west-1 Calgary, for disaster recovery)
- files and logs

Global services (CloudFront, Route 53, WAF) only cache public website files or route traffic.

## Consequences
- The privacy policy changes from "held in the United States" to "held in Canada".
- This simplifies Law 25 transfer assessments for Québec volunteers.
- Some AWS services arrive later in ca-central-1 than in US regions. Every service in the target design is available there today.
