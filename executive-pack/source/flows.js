// Executive flow diagrams: one swimlane flow per feature, 5–7 steps each.
// Edit the words here, then run `node executive-pack/source/render.js` to redraw every PNG and SVG.
//   lanes: rows, top to bottom; the first lane is the person who starts the journey
//   steps: in order; each step takes the next column (set `col` to share a column)
//   planned: true → dashed box with a "Planned" tag (Phase 2, not built yet)
//   note: one short line under the diagram (edge cases, privacy)

const V = 'Volunteer';
const S = 'SevaSetu';
const O = 'Organizer';

module.exports = [
  // ----------------------------------------------------------------- Volunteer journeys
  {
    id: 'V1', file: 'v1-sign-up-and-profile', group: 'Volunteer journey',
    title: 'Sign up and build a profile',
    lanes: [V, S],
    steps: [
      { lane: V, text: 'Signs up with email, Google or Apple' },
      { lane: S, text: 'Confirms email and starts setup' },
      { lane: V, text: 'Picks seva areas and skills' },
      { lane: V, text: 'Sets weekly availability and city' },
      { lane: S, text: 'Creates Volunteer 360 profile and ID' },
      { lane: S, text: 'Shows best-matching seva' },
    ],
    note: 'Courses, languages, LinkedIn (only with consent) and private accessibility needs can be added any time.',
  },
  {
    id: 'V2', file: 'v2-find-and-join-seva', group: 'Volunteer journey',
    title: 'Find and join a seva',
    lanes: [V, S, O],
    steps: [
      { lane: V, text: 'Opens Discover: seva nearby or online' },
      { lane: S, text: 'Shows a match % for each seva' },
      { lane: V, text: 'Taps Join' },
      { lane: S, text: 'Reserves a spot (never overbooks)' },
      { lane: S, text: 'Confirms and sends reminders' },
      { lane: O, text: 'Sees the volunteer on the roster' },
    ],
    note: 'If the last spot is taken at the same moment, the volunteer is told right away; no seva is ever double-booked.',
  },
  {
    id: 'V3', file: 'v3-report-progress-and-hours', group: 'Volunteer journey',
    title: 'Report progress and earn verified hours',
    lanes: [V, S, O],
    steps: [
      { lane: V, text: 'Does the seva' },
      { lane: V, text: 'Reports progress (e.g. 8 of 12 meals)' },
      { lane: S, text: 'Sends it for review' },
      { lane: O, text: 'Approves or adjusts' },
      { lane: S, text: 'Records verified hours' },
      { lane: V, text: 'Sees hours on profile' },
    ],
    note: 'For role seva such as hall setup, hours are recorded when the organizer completes the event.',
  },
  {
    id: 'V4', file: 'v4-join-private-course', group: 'Volunteer journey',
    title: 'Ask to join a private course',
    lanes: [V, S, O],
    steps: [
      { lane: V, text: 'Sees private course: name and date only' },
      { lane: V, text: 'Asks to join' },
      { lane: S, text: 'Tells the organizer' },
      { lane: O, text: 'Approves (or invites people directly)' },
      { lane: S, text: 'Unlocks course details and seva' },
      { lane: V, text: 'Joins a seva' },
    ],
    note: 'Organizers can remove access at any time; that person’s open spots are released.',
  },
  {
    id: 'V5', file: 'v5-join-a-team', group: 'Volunteer journey',
    title: 'Join a standing team',
    lanes: [V, S, O],
    steps: [
      { lane: O, text: 'Invites volunteer to a team' },
      { lane: S, text: 'Sends the invitation' },
      { lane: V, text: 'Sees invitation on profile' },
      { lane: V, text: 'Accepts or declines' },
      { lane: S, text: 'Adds to team, tells organizer' },
      { lane: O, text: 'Team staffing updates' },
    ],
    note: 'Nobody is added to a team without saying yes.',
  },

  // ----------------------------------------------------------------- Organizer journeys
  {
    id: 'O1', file: 'o1-create-and-publish-event', group: 'Organizer journey',
    title: 'Create and publish an event',
    lanes: [O, S, 'Volunteers'],
    steps: [
      { lane: O, text: 'Picks a template (e.g. Satsang, Part 1)' },
      { lane: O, text: 'Sets date, centre and seva roles' },
      { lane: S, text: 'Checks it is ready to publish' },
      { lane: O, text: 'Publishes, optionally weekly' },
      { lane: S, text: 'Lists it on Discover (or private)' },
      { lane: 'Volunteers', text: 'Volunteers can join' },
    ],
    note: 'Templates in English, Hindi and French. “Repeat weekly” creates 4, 8 or 12 copies in one step.',
  },
  {
    id: 'O2', file: 'o2-find-and-invite-volunteers', group: 'Organizer journey',
    title: 'Find and invite the right volunteers',
    lanes: [O, S, V],
    steps: [
      { lane: O, text: 'Opens Find volunteers for a seva' },
      { lane: S, text: 'Ranks people by match %' },
      { lane: O, text: 'Sees why: skills, area, time, distance' },
      { lane: O, text: 'Invites the best fits' },
      { lane: V, text: 'Gets invitation and joins' },
      { lane: S, text: 'Roster and staffing update' },
    ],
    note: 'Results show name, area and skills only: no email or exact address until the person joins.',
  },
  {
    id: 'O3', file: 'o3-review-progress', group: 'Organizer journey',
    title: 'Review volunteers’ progress',
    lanes: [O, S, V],
    steps: [
      { lane: V, text: 'Submits a progress report' },
      { lane: S, text: 'Adds it to the review queue' },
      { lane: O, text: 'Opens Reviews' },
      { lane: O, text: 'Approves, adjusts with a reason, or rejects' },
      { lane: S, text: 'Updates totals and hours' },
      { lane: V, text: 'Is told the result' },
    ],
    note: 'Pending and verified work are always shown separately, so totals are never overstated.',
  },
  {
    id: 'O4', file: 'o4-complete-event-and-log-hours', group: 'Organizer journey',
    title: 'Complete an event and log hours',
    lanes: [O, S, 'Volunteers'],
    steps: [
      { lane: O, text: 'Event ends: taps Complete event' },
      { lane: S, text: 'Pre-fills hours for each volunteer' },
      { lane: O, text: 'Adjusts hours, adds people reached' },
      { lane: S, text: 'Saves hours, marks event complete' },
      { lane: 'Volunteers', text: 'See their hours' },
      { lane: S, text: 'Dashboard and impact update' },
    ],
    note: 'If a mistake is found, the organizer can reopen the event; logged hours are kept.',
  },
  {
    id: 'O5', file: 'o5-build-a-team', group: 'Organizer journey',
    title: 'Build a team with Team Builder',
    lanes: [O, S, V],
    steps: [
      { lane: O, text: 'Creates a team: area, centre, size' },
      { lane: S, text: 'Shows skills the team is missing' },
      { lane: S, text: 'Suggests people who fit' },
      { lane: O, text: 'Invites suggested people' },
      { lane: V, text: 'Accepts the invitation' },
      { lane: O, text: 'Chooses a team lead' },
    ],
    note: 'Suggestions come only from the centre’s directory: people who served there or chose to be found.',
  },
  {
    id: 'O6', file: 'o6-dashboard-and-alerts', group: 'Organizer journey',
    title: 'See the network and act on alerts',
    lanes: ['Leader / Organizer', S],
    steps: [
      { lane: S, text: 'Gathers hours, events and regions' },
      { lane: 'Leader / Organizer', text: 'Opens the Dashboard' },
      { lane: S, text: 'Flags what needs action' },
      { lane: 'Leader / Organizer', text: 'Taps an alert' },
      { lane: S, text: 'Opens the fix (e.g. Find volunteers)' },
      { lane: 'Leader / Organizer', text: 'Uses Impact for reports' },
    ],
    note: 'Alerts: event short of volunteers, almost full, hours not logged, profiles missing availability, reports to review.',
  },

  // ----------------------------------------------------------------- Admin journeys
  {
    id: 'A1', file: 'a1-approve-new-centre', group: 'Admin journey',
    title: 'Approve a new centre',
    lanes: ['New centre', S, 'Admin'],
    steps: [
      { lane: 'New centre', text: 'Applies to organize: name, city' },
      { lane: S, text: 'Adds it to the review queue' },
      { lane: 'Admin', text: 'Reviews the details' },
      { lane: 'Admin', text: 'Approves, or rejects with a reason' },
      { lane: S, text: 'Tells the centre' },
      { lane: 'New centre', text: 'Can publish events' },
    ],
    note: 'A rejected centre can fix its details and apply again. Every admin decision is recorded.',
  },
  {
    id: 'A2', file: 'a2-keep-platform-safe', group: 'Admin journey',
    title: 'Keep the platform safe',
    lanes: ['Admin', S, 'People affected'],
    steps: [
      { lane: 'Admin', text: 'Spots a problem' },
      { lane: 'Admin', text: 'Blocks a user or cancels an event, with a reason' },
      { lane: S, text: 'Releases spots, stops new activity' },
      { lane: 'People affected', text: 'Volunteers and organizers are told' },
      { lane: S, text: 'Records it in the audit log' },
      { lane: 'Admin', text: 'Can undo any time' },
    ],
    note: 'Blocked accounts cannot join, report or create anything until an admin unblocks them.',
  },
  {
    id: 'A3', file: 'a3-demo-mode', group: 'Admin journey',
    title: 'Run a live demo safely',
    lanes: ['Admin', S],
    steps: [
      { lane: 'Admin', text: 'Opens Demo mode' },
      { lane: 'Admin', text: 'Chooses View as volunteer or organizer' },
      { lane: S, text: 'Switches to the sample world' },
      { lane: 'Admin', text: 'Presents live' },
      { lane: 'Admin', text: 'Switches back to admin' },
      { lane: S, text: 'Reset restores the sample data' },
    ],
    note: 'Sample people and centres are walled off: real users never see them and real records are never shown.',
  },

  // ----------------------------------------------------------------- Future (Phase 2)
  {
    id: 'F1', file: 'f1-event-application-form', group: 'Planned · Phase 2',
    title: 'Apply for a big event (e.g. retreat seva)',
    lanes: [V, S, O],
    steps: [
      { lane: O, text: 'Turns on Application needed', planned: true },
      { lane: V, text: 'Applies: dates, housing, experience, waiver', planned: true },
      { lane: S, text: 'Keeps health answers private', planned: true },
      { lane: O, text: 'Reviews with match % and filters', planned: true },
      { lane: O, text: 'Accepts, waitlists or declines', planned: true },
      { lane: S, text: 'Places accepted people in seva', planned: true },
      { lane: S, text: 'Deletes health answers after the event', planned: true },
    ],
    note: 'Replaces the long Google Form. People not selected are told automatically after the deadline.',
  },
  {
    id: 'F2', file: 'f2-badges-and-certificates', group: 'Planned · Phase 2',
    title: 'Recognise milestones',
    lanes: [O, S, V],
    steps: [
      { lane: O, text: 'Completes an event' },
      { lane: S, text: 'Adds hours to each total' },
      { lane: S, text: 'Awards badges at 25, 50, 100 hours', planned: true },
      { lane: V, text: 'Sees the badge on profile', planned: true },
      { lane: V, text: 'Downloads 100-hour certificate', planned: true },
      { lane: O, text: 'Sees badges in the directory', planned: true },
    ],
    note: 'Badge levels and the certificate signer are open questions for the national team.',
  },
  {
    id: 'F3', file: 'f3-announcements', group: 'Planned · Phase 2',
    title: 'Send an announcement to the right people',
    lanes: [O, S, V],
    steps: [
      { lane: O, text: 'Writes a message', planned: true },
      { lane: O, text: 'Chooses who: area, region, team or event', planned: true },
      { lane: S, text: 'Checks consent and daily limit', planned: true },
      { lane: S, text: 'Sends in-app, push and email', planned: true },
      { lane: V, text: 'Reads it; can opt out of email', planned: true },
    ],
    note: 'Replaces broad WhatsApp blasts with targeted messages to people who agreed to hear from the centre.',
  },
  {
    id: 'F4', file: 'f4-feedback-after-seva', group: 'Planned · Phase 2',
    title: 'Collect feedback after seva',
    lanes: [O, S, V],
    steps: [
      { lane: O, text: 'Completes an event' },
      { lane: S, text: 'Asks volunteers for a 1–5 rating', planned: true },
      { lane: V, text: 'Rates and comments', planned: true },
      { lane: O, text: 'Adds a private note (optional)', planned: true },
      { lane: S, text: 'Shows averages on Impact', planned: true },
      { lane: O, text: 'Improves the next event', planned: true },
    ],
    note: 'Comments are seen by organizers only; private notes stay inside one centre.',
  },
];
