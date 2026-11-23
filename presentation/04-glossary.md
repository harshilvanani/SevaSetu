# Glossary (plain language)

## Art of Living terms
| Term | Meaning |
|---|---|
| Seva | Selfless service: volunteering. |
| Satsang | A gathering with music and meditation. |
| Part 1 / Part 2 | Art of Living courses: the Happiness Program (SKY Breath Meditation) and the Art of Silence retreat. |
| VTP | Volunteer Training Program. |
| Volunteer Teacher / Full-time Teacher | Certified Art of Living teachers who also volunteer, part-time or full-time. |
| Retreat Centre | The Art of Living Retreat Centre in Saint-Sauveur, Québec. |

## SevaSetu terms
| Term | Meaning |
|---|---|
| Seva area | The kind of seva someone likes (e.g. Kitchen & food, Digital & technology); 16 in total. |
| Volunteer 360 | A volunteer's full profile: role, skills with levels, languages, hours, preferences. |
| Match score | 0–100%: how well a volunteer fits a seva, with the reasons shown. |
| Directory | The organizer's list of volunteers who served with them or agreed to be found. |
| Demo mode | A walled-off copy of the app with sample people, used for live demos. |
| SevaConnect | An earlier presentation prototype (mock data); its screens were rebuilt in SevaSetu. |
| SEVAKS | The product requirements and technical design document by Jatin Maru and Harshil Vanani. |

## Technical terms
| Term | Meaning |
|---|---|
| Design doc | A short written plan for a feature, reviewed before any code is written. |
| ADR (architecture decision record) | A one-page record of an important technical decision and why it was made. |
| Supabase | The hosted platform SevaSetu runs on today: database, sign-in, API. |
| PostgreSQL | The database. Supabase and AWS Aurora both use it, which is why the move is straightforward. |
| Row-level security | Database rules that decide which rows each person can see or change. |
| AWS | Amazon Web Services, the target cloud. |
| Aurora (Serverless v2) | AWS's managed PostgreSQL that grows and shrinks capacity automatically. |
| Cognito | AWS's sign-in service (passwords, Google, Apple, two-step verification). |
| Lambda | Small server functions that run only when called (pay per use). |
| Fargate | Runs the API in containers without managing servers. |
| CloudFront / S3 | AWS's global content delivery network and file storage; together they serve the website. |
| WAF | Web application firewall: blocks attacks and limits floods of requests. |
| CDK (infrastructure as code) | The AWS setup written as code, so it can be reviewed, versioned and recreated exactly. |
| ca-central-1 | AWS's Canada (Montréal) region. |
| Multi-AZ | Copies in two separate data centres, so one failing doesn't stop the service. |
| k6 | A load-testing tool that simulates many users at once. |
| MFA | Multi-factor authentication: a second step (like a code) when signing in. |
