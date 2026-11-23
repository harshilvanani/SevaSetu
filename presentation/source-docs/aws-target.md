# Target architecture on AWS

Image for slides: [`img/aws-target.png`](img/aws-target.png) (also `img/aws-target.svg`). Regenerate it whenever the diagram below changes.

Region **ca-central-1 (Montréal)**, so volunteer data stays in Canada. Separate AWS accounts for dev, staging and production. Everything is defined in AWS CDK ([`infra/`](../../infra/)).

```mermaid
flowchart LR
  subgraph Users
    U[Volunteers · Organizers · Admins · Donors]
  end
  MOB["iOS / Android app<br/>Expo"]

  subgraph Edge["Edge (global)"]
    R53[Route 53]
    WAF["AWS WAF<br/>rate limits, bot rules"]
    CF[CloudFront]
  end

  subgraph CA["AWS ca-central-1"]
    S3W[("S3<br/>website files")]
    COG["Cognito user pool<br/>email, Google, Apple<br/>MFA for admins"]
    APIGW["API Gateway (HTTP API)<br/>JWT authorizer = Cognito"]
    subgraph VPC["VPC, private subnets, 2 AZs"]
      PGR["PostgREST on ECS Fargate<br/>same REST + RPC API as today<br/>auto-scaling 2 → N tasks"]
      L["Lambda functions<br/>stripe-connect · donate-checkout<br/>stripe-webhook · push · email<br/>certificates · exports"]
      PROXY[RDS Proxy]
      AUR[("Aurora PostgreSQL<br/>Serverless v2, Multi-AZ<br/>row-level security<br/>same SQL migrations")]
    end
    EB["EventBridge Scheduler<br/>reminders · invitation expiry<br/>dashboard summaries · purges"]
    S3F[("S3<br/>photos, certificates, exports")]
    SES[SES email]
    SM[Secrets Manager]
    KMS[KMS keys]
    CW["CloudWatch logs, alarms<br/>X-Ray tracing"]
  end

  STRIPE[Stripe Connect]
  EXPO[Expo push]

  U --> R53 --> WAF --> CF
  CF --> S3W
  CF -->|/api| APIGW
  MOB --> COG
  CF -.->|sign-in pages| COG
  MOB -->|HTTPS + Cognito JWT| APIGW
  APIGW --> PGR
  APIGW --> L
  PGR --> PROXY --> AUR
  L --> PROXY
  EB --> L
  L --> SES
  L --> S3F
  L <--> STRIPE
  L --> EXPO
  SM -.-> L
  SM -.-> PGR
  KMS -.-> AUR
  KMS -.-> S3F
  L -.-> CW
  PGR -.-> CW
  AUR -.-> CW
```

## What each part does

| Component | Replaces | Why this choice |
|---|---|---|
| S3 + CloudFront | Hostinger | Same static build. Global CDN; cost scales with traffic. |
| AWS WAF | — | Rate limits (open security item 11), common attack rules. |
| Cognito | Supabase Auth | Managed sign-in, Google/Apple, MFA for admins, leaked-password protection. |
| API Gateway | Supabase gateway | One entry point, JWT check, throttling. |
| PostgREST on Fargate | Supabase REST | The app's data calls keep working with almost no code change. |
| Lambda | Edge Functions | Stripe, push, email, PDFs: short jobs, pay per use. |
| Aurora PostgreSQL Serverless v2 | Supabase Postgres | Same PostgreSQL. Capacity scales with load, Multi-AZ failover, read replicas for dashboards. |
| RDS Proxy | — | Pools connections when Lambda and Fargate scale out. |
| EventBridge Scheduler | pg_cron + pg_net | Reminders, expiries, dashboard summaries, data purges. |
| SES | Supabase email | Sign-up, password and announcement emails. |
| Secrets Manager + KMS | Function secrets | Stripe keys, database credentials; encryption at rest. |
| CloudWatch + X-Ray | Supabase logs | Dashboards and alarms: API errors, slow queries, webhook failures, cost. |

## Environments
| | dev | staging | production |
|---|---|---|---|
| Aurora | Serverless v2, min 0.5 ACU | min 0.5 ACU | min 1 ACU, Multi-AZ, 1 reader |
| Fargate (PostgREST) | 1 task | 1 task | 2–10 tasks |
| Backups | 1 day | 7 days | 35 days + point-in-time restore |
| Data | demo only | copy of demo + anonymised sample | real |
