# SevaSetu on AWS (CDK)

The target AWS setup from [`docs/architecture/aws-target.md`](../docs/architecture/aws-target.md) and [ADR-003](../docs/adr/003-aws-migration.md), written as AWS CDK (TypeScript).

**Status: template only.** Nothing has been deployed and no AWS account is connected. `cdk synth` turns this code into CloudFormation templates. It costs nothing and needs no credentials.

```bash
cd infra
npm install
npx cdk synth -c env=dev -c account=111111111111      # any 12-digit placeholder works for synth
```

## Stacks (region ca-central-1, WAF in us-east-1)

| Stack | What it creates |
|---|---|
| `SevaSetu-<env>-Network` | VPC across 2 zones: public, app (private, outbound only) and data (isolated) subnets; flow logs |
| `SevaSetu-<env>-Data` | Aurora PostgreSQL 16 Serverless v2 (reader in prod), RDS Proxy, KMS key, private S3 bucket for files |
| `SevaSetu-<env>-Auth` | Cognito user pool (10-character passwords, optional MFA, `platform-admins` group), app client |
| `SevaSetu-<env>-Api` | HTTP API (`/rest/*` → PostgREST on Fargate, `/functions/*` → Lambda), Cognito JWT authorizer, Stripe and JWKS secrets |
| `SevaSetu-<env>-EdgeSecurity` | WAF: AWS managed rules, donate rate limit (30 per 5 min per IP), API rate limit |
| `SevaSetu-<env>-Web` | S3 + CloudFront with the same security headers and deep-link behaviour as the Hostinger `.htaccess` |
| `SevaSetu-<env>-Ops` | EventBridge schedules (reminders, invitation expiry, dashboard summaries, purges), webhook alarm, monthly budget |

Sizes per environment: [`lib/config.ts`](lib/config.ts). Add `-c alertEmail=…` for budget emails.

## Before the first deploy (ADR-003 phase 1)
- **Accounts:** create the dev / staging / prod AWS accounts and run `npx cdk bootstrap` in each (and in us-east-1 for the WAF).
- **Secrets:** fill `sevasetu/<env>/stripe` and `sevasetu/<env>/cognito-jwks` in Secrets Manager.
- **App code:** replace the placeholder Lambda code (which returns 501) with the ported `supabase/functions/*`.
- **Cognito tokens:** add the pre-token-generation trigger that adds `"role": "authenticated"`, which PostgREST reads.
- **Custom domain:** add the ACM certificate and Route 53 records.
