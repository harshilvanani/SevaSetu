# Data model (main tables)

All tables live in the `public` schema with row-level security on.
- Every table: [`supabase/migrations/`](../../supabase/migrations/)
- Generated TypeScript types: `src/lib/database.types.ts`

```mermaid
erDiagram
  profiles ||--o{ availability_slots : "free at"
  profiles ||--o| profile_private : "accessibility (private)"
  profiles ||--o{ org_members : "organizes in"
  organizations ||--o{ org_members : has
  organizations ||--o{ centres : runs
  organizations ||--o{ events : publishes
  centres ||--o{ events : hosts
  events ||--o{ seva_tasks : contains
  events ||--o| event_private_details : "contact, online link"
  events ||--o{ event_access : "private-event requests"
  seva_tasks ||--o{ assignments : "joined by"
  profiles ||--o{ assignments : joins
  assignments ||--o{ progress_reports : reports
  assignments ||--o| event_hours : "hours logged"
  organizations ||--o{ teams : has
  teams ||--o{ team_members : includes
  profiles ||--o{ team_members : "member of"
  organizations ||--o| org_payments : "Stripe account"
  organizations ||--o{ donation_campaigns : runs
  donation_campaigns ||--o{ donations : receives
  profiles ||--o{ notifications : receives
  profiles ||--o{ admin_actions : "audited (admin)"
  event_templates ||--o{ event_template_tasks : suggests

  profiles {
    uuid id PK
    text full_name
    text person_type "volunteer | volunteer_teacher | full_time_teacher"
    bigint volunteer_no "VOL-CA-000018"
    text province
    text region "generated"
    text[] interests "16 seva areas"
    text[] skills
    jsonb skill_levels
    text[] languages
    text[] courses
    bool directory_opt_in
    bool linkedin_consent
    bool is_demo
  }
  events {
    uuid id PK
    uuid org_id FK
    uuid centre_id FK
    timestamptz starts_at
    text status "draft | published | completed | cancelled"
    text visibility "public | private"
    int people_reached
    uuid series_id "weekly repeats"
  }
  seva_tasks {
    uuid id PK
    text type "role | quantity"
    int positions
    int target_qty
    text category "seva area"
    int volunteers_count "kept by trigger"
    int claimed_total "kept by trigger"
  }
  assignments {
    uuid id PK
    uuid task_id FK
    uuid volunteer_id FK
    int claimed_qty
    text status "active | completed | cancelled"
  }
```

## Row counts to plan for (50,000 volunteers, one year)
| Table | Estimate | Notes |
|---|---|---|
| profiles | 50,000 | |
| availability_slots | ~300,000 | 6 slots per person on average |
| events | ~10,000 | ~200 centres × 1 a week |
| seva_tasks | ~40,000 | |
| assignments | ~400,000 | 8 seva per active volunteer |
| progress_reports | ~200,000 | |
| notifications | ~3,000,000 | Archive after 180 days (planned job) |

All of these are small for PostgreSQL when indexed. The planned archive job keeps `notifications` small.
