# Key facts (source of truth for every number)

As of 23 November 2026.

## Product
| Fact | Value |
|---|---|
| Product name | SevaSetu ("bridge of seva") by The Art of Living |
| Tagline | Connecting hearts through seva |
| Live website | Hostinger (static web app, installable) |
| Mobile | iOS and Android, same code (Expo), in testing |
| Languages | English, Hindi, French |
| Roles | Volunteer, organizer (owner / organizer), platform admin |
| Person types | Volunteer, Volunteer Teacher, Full-time Teacher |
| Volunteer ID format | VOL-CA-000018 (volunteers), TCH-CA-000007 (teachers) |
| Seva areas | 16 (merged list) |
| Courses tracked | Part 1, Part 2, VTP, Teachers, Sri Sri Yoga, Sky Teens, Sanyam |

## Merge (SevaSetu + SevaConnect + SEVAKS)
| Fact | Value |
|---|---|
| Sample volunteers loaded (demo) | 60, from the "December 25–29 Volunteer Application Responses" mock spreadsheet |
| Sample volunteers' locations | 46 in Canada, 14 in the US |
| Demo centres | 9 (Toronto, Montréal, Québec City, Ottawa, Vancouver, Calgary, Halifax, Boston, Art of Living Retreat Centre) |
| Demo regions | 6 (Ontario, Quebec, British Columbia, Prairies, Atlantic Canada, United States) |
| Demo teams | 6 (Kitchen, Audio-Video & Tech, Hospitality & Reception, Childcare & Youth, Grounds & Maintenance, Outreach) |
| Not imported | Health answers, medication, pregnancy, injuries, criminal record, emergency contacts, addresses, licence plates, ID photos, age, gender |

## Match score (from SEVAKS)
| Part | Points |
|---|---|
| Skills | 40 |
| Seva area | 25 |
| Availability | 20 |
| Location | 10 |
| Experience | 5 |
| LinkedIn shared with consent | +3 bonus (total capped at 100) |

## Quality
| Fact | Value |
|---|---|
| Automated database checks | **212**, all passing (10 test files) |
| App unit tests | 23, passing |
| Typecheck and lint | Passing |
| Security review | All critical and high issues fixed; medium partly open |

## Documentation
| Fact | Value |
|---|---|
| Design docs | Template + 6 for built features + Phase 2 draft |
| Architecture decision records | 4 (PostgreSQL; rules in the database; AWS migration; data in Canada) |
| Diagrams | Architecture today, AWS target, data model, 3 request flows |

## Today's platform
| Fact | Value |
|---|---|
| Backend | Supabase: PostgreSQL + sign-in + API + server functions |
| Data location today | United States (Oregon) |
| Payments | Stripe Connect, paid into each organization's own account |

## AWS plan
| Fact | Value |
|---|---|
| Region | ca-central-1 (Montréal); backups copied to ca-west-1 (Calgary) |
| Infrastructure as code | AWS CDK, **7 stacks, 132 resources**, generates with 0 errors and 0 warnings |
| Status | **Written, not deployed**, no AWS cost yet |
| Environments | dev, staging, production (separate AWS accounts) |
| Migration | 6 phases; Supabase kept read-only for 30 days after cutover |
| Supabase-only uses counted | 119 uses of the built-in "current user" check; portable replacement in place and tested |
| WAF limits | 30 donation checkouts per 5 minutes per IP; 2,000 API requests per 5 minutes per IP |
| Production database | Aurora Serverless v2, 1–16 capacity units, Multi-AZ, 1 reader, 35-day backups |
| Budget alerts (USD/month) | dev 100 · staging 200 · prod 600 (alerts, not estimates) |

## Scale targets (from SEVAKS)
| Target | Value |
|---|---|
| Volunteers | 100 to 50,000 |
| Search time | Under 2 seconds |
| Availability | 99.9% |
| Biggest table at 50,000 volunteers, 1 year | about 3 million notifications (archive job planned) |
| Known limits | Directory shows at most 1,000 people; dashboard recalculated on every view |
