# SevaSetu executive pack: flows, architecture and scenarios

For a presentation to **national leadership**. Every image is a 16:9 slide (2880 × 1620 PNG), in the SevaSetu brand (Lora + Poppins, plum, purple and orange).

## What's inside

| Folder / file | Contents |
|---|---|
| `flows/` | **18 swimlane flow diagrams** (PNG + editable SVG), 5–7 steps each, one per feature |
| `architecture/architecture-today.png` | Today's app in plain words: who uses it, apps, the SevaSetu service, outside services |
| `architecture/architecture-future.png` | The future app on AWS in plain words, with **New** and **Upgraded** tags, plus the iPhone and Android apps |
| `architecture/*-named.png` | The same two diagrams with product names (Supabase, Cognito, Aurora…), for the appendix or technical reviewers |
| `architecture/scope-today-vs-future.png` | One-slide table of what changes |
| `scenarios.md` | 3 real-world scenarios: story for the slide, business case for the notes, flows used |
| `diagram-text-for-claude-design.md` | Every diagram as text, so Claude Design can redraw them as native shapes |
| `source/` | The editable source: `flows.js` and `architecture.js` (wording), `render.js` (redraws everything) |

## The 18 flows
- **Volunteer** (5):
  - V1 Sign up and build a profile
  - V2 Find and join a seva
  - V3 Report progress and earn verified hours
  - V4 Ask to join a private course
  - V5 Join a standing team
- **Organizer** (6):
  - O1 Create and publish an event
  - O2 Find and invite volunteers
  - O3 Review progress
  - O4 Complete an event and log hours
  - O5 Build a team with Team Builder
  - O6 See the network and act on alerts
- **Admin** (3):
  - A1 Approve a new centre
  - A2 Keep the platform safe
  - A3 Run a live demo safely
- **Planned, Phase 2** (4):
  - F1 Apply for a big event
  - F2 Recognise milestones
  - F3 Send an announcement
  - F4 Collect feedback

**How to read them:**
- Solid boxes work today.
- Dashed orange boxes tagged **Planned** are Phase 2.
- Donations are deliberately left out of this pack.

## Suggested slide order
1. Architecture today
2. Architecture future (scope)
3. Scope table
4. Scenario 1 (Retreat Seva) with its flows
5. Scenario 2 (weekly satsang and course) with its flows
6. Scenario 3 (new centre) with its flows
7. Appendix: remaining flows, then the named architecture diagrams

## Changing a diagram
1. Edit the wording in `source/flows.js` or `source/architecture.js`.
2. From the repository root, run:

   ```bash
   node executive-pack/source/render.js
   ```

This needs the app's `node_modules` (for the fonts) and Playwright's Chromium.
