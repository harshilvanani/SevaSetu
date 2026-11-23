# Design docs

Every feature starts with a design doc in this folder. Code is written only after the doc has been reviewed.

## How we work

1. **Requirements.** The SEVAKS product requirements, plus requests from coordinators.
2. **Design doc.** Copy `000-template.md` to the next number and fill in every section. Write "None" when a section does not apply, so the reviewer can tell it was considered.
3. **Review.** The product owner (Harshil) and one other person read it. Decisions that are hard to undo also get a decision record in `../adr/`.
4. **Build.** Each database change is a numbered SQL migration in `supabase/migrations/`. Each new rule gets a database test in `supabase/tests/`.
5. **Test.** All of these must pass before release:
   - `npm run db:test`
   - `npx tsc --noEmit`
   - `npx expo lint`
   - `npx jest`
   - a click-through of the changed screens
6. **Release notes.** The doc's "Status" line is updated, with anything that changed during the build.

## Index

| # | Doc | Status |
|---|---|---|
| 000 | [Template](000-template.md) | — |
| 001 | [Core seva: discover, join, progress, hours](001-core-seva.md) | Released (written after the build) |
| 002 | [Admin console and demo mode](002-admin-demo.md) | Released (written after the build) |
| 003 | [Organizer tools: templates, private events, find volunteers](003-organizer-tools.md) | Released (written after the build) |
| 004 | [Donations with Stripe Connect](004-donations-stripe.md) | Released (written after the build) |
| 005 | [Security review, November 2026](005-security-review.md) | Critical and high fixed; medium partly open |
| 006 | [Merge phase 1: SevaConnect + SEVAKS](006-merge-phase1.md) | Released |
| 100 | [Phase 2: recognition, announcements, feedback, application form](100-phase2.md) | **Draft for review** |

Related:
- architecture diagrams: [`../architecture/`](../architecture/)
- decision records: [`../adr/`](../adr/)

## Rules that apply to every doc

- **Portable to AWS.** Use standard PostgreSQL. Do not add Supabase-only features without an adapter and a note in "AWS impact". See [ADR-003](../adr/003-aws-migration.md).
- **Rules live in the database.** Capacity, privacy and hours are enforced by row-level security and SQL functions, never only in the app. See [ADR-002](../adr/002-rules-in-database.md).
- **Privacy first.** Collect the least data possible, ask for consent for anything shared with organizers, and never import health or criminal-record answers.
- **Scale target.** 50,000 volunteers, searches in under 2 seconds. Every list has a limit or pages.
