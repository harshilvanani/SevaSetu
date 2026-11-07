-- Demo content mirroring the design. Safe to re-run (fixed ids, upserts).
-- Dates are relative to now() so the app always has upcoming seva.

insert into organizations (id, name, city, description, status) values
  ('a0000000-0000-4000-8000-000000000001', 'Art of Living Toronto', 'Toronto, ON',
   'Service, meditation and community programs in the Greater Toronto Area.', 'approved')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into events (id, org_id, title, description, starts_at, ends_at, mode, venue_name, address, city,
                    latitude, longitude, visibility, status, published_at) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Diwali Community Seva Week',
   'A week of service around Diwali: welcoming guests, outreach calls, translation and a community dinner.',
   date_trunc('day', now()) + interval '2 days 9 hours', date_trunc('day', now()) + interval '7 days 21 hours',
   'hybrid', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON', 43.6629, -79.3957, 'public', 'published', now()),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Winter Care Kit Drive',
   'Pack and deliver winter care kits for families arriving at local shelters. Volunteers can help on-site at the hall or join virtually to coordinate deliveries.',
   date_trunc('day', now()) + interval '9 days 10 hours', date_trunc('day', now()) + interval '11 days 13 hours',
   'hybrid', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON', 43.6629, -79.3957, 'public', 'published', now()),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Seniors Tech Café',
   'Friendly one-on-one help for seniors learning phones, video calls and email.',
   date_trunc('day', now()) + interval '5 days 18 hours 30 minutes', date_trunc('day', now()) + interval '5 days 20 hours',
   'virtual', null, null, 'Toronto, ON', null, null, 'public', 'published', now())
on conflict (id) do nothing;

insert into event_private_details (event_id, online_details, contact_info) values
  ('e0000000-0000-4000-8000-000000000001', 'Volunteer huddle: meet.example.com/diwali-seva', 'Anjali Mehta · organizer'),
  ('e0000000-0000-4000-8000-000000000003', 'Session link: meet.example.com/tech-cafe', 'Organizer team')
on conflict (event_id) do nothing;

-- Tasks are inserted as 'open' since their events are already published.
insert into seva_tasks (id, event_id, title, description, instructions, steps, category, type,
  target_qty, unit, max_per_volunteer, max_volunteers, minutes_per_unit, positions,
  starts_at, ends_at, signup_deadline, mode, visibility, status) values
  -- Diwali week
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Make outreach calls',
   'Call families on the community list to invite them to the Diwali dinner and confirm attendance.',
   'A call script and your list are shared after you join. Log only calls where you reached someone.',
   array['Join and receive your call list', 'Use the call script to invite each family', 'Report calls completed in My Seva'],
   'Outreach', 'quantity', 10, 'calls', 4, 4, 10, null,
   null, null, date_trunc('day', now()) + interval '6 days 18 hours', 'virtual', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Welcome-desk coordinator',
   'Greet guests, hand out programs and help people find their way.', 'Arrive by 8:45 AM for a short briefing.',
   array['Check in with the event lead', 'Greet guests and hand out programs', 'Help with directions and questions'],
   'Event setup', 'role', null, null, null, null, null, 2,
   date_trunc('day', now()) + interval '6 days 9 hours', date_trunc('day', now()) + interval '6 days 12 hours',
   date_trunc('day', now()) + interval '5 days 18 hours', 'onsite', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Serve at the community dinner',
   'Serve food, refill stations and help keep the dining area tidy.', '', '{}',
   'Food service', 'role', null, null, null, null, null, 12,
   date_trunc('day', now()) + interval '6 days 13 hours', date_trunc('day', now()) + interval '6 days 16 hours',
   null, 'onsite', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'Translate event flyers',
   'Translate the Diwali flyer into Hindi, Gujarati, Punjabi and Tamil.', 'Source files are shared after you join.', '{}',
   'Translation', 'quantity', 20, 'flyers', 8, null, 20, null,
   null, null, date_trunc('day', now()) + interval '12 days', 'virtual', 'public', 'open'),
  -- Winter care kits
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'Pack winter care kits',
   'Help assemble winter care kits for families arriving at local shelters this season. Each kit holds a toque, gloves, socks, hygiene items and a handwritten welcome note. Supplies are pre-sorted at stations — you''ll pack, label and box the kits.',
   'Check in at the welcome desk by 9:50 AM.',
   array['Check in at the welcome desk and pick up your station number', 'Pack each kit using the checklist at your station', 'Report how many kits you packed in My Seva before you leave'],
   'Food & supplies', 'quantity', 120, 'kits', 12, null, 10, null,
   date_trunc('day', now()) + interval '9 days 10 hours', date_trunc('day', now()) + interval '9 days 13 hours',
   date_trunc('day', now()) + interval '8 days 18 hours', 'onsite', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000002', 'Sort donated clothing',
   'Sort and size donated winter clothing ahead of packing day.', '', '{}',
   'Food & supplies', 'role', null, null, null, null, null, 8,
   date_trunc('day', now()) + interval '8 days 18 hours', date_trunc('day', now()) + interval '8 days 20 hours 30 minutes',
   null, 'onsite', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000002', 'Call shelters to confirm counts',
   'Call each partner shelter to confirm how many kits they need and the best drop-off time.',
   'Use the shelter contact sheet you''ll receive after joining. Log only calls where you reached someone.', '{}',
   'Outreach', 'quantity', 10, 'calls', 4, 4, 15, null,
   null, null, date_trunc('day', now()) + interval '8 days', 'virtual', 'public', 'open'),
  -- Seniors tech café
  ('b0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000003', 'Teach computer basics to seniors',
   'Guide seniors one-on-one through phones, video calls and email.', 'A short orientation guide is shared after you join.', '{}',
   'Teaching', 'role', null, null, null, null, null, 4,
   date_trunc('day', now()) + interval '5 days 18 hours 30 minutes', date_trunc('day', now()) + interval '5 days 20 hours',
   null, 'virtual', 'public', 'open'),
  ('b0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000003', 'Session leads',
   'Lead the café session and pair volunteers with seniors.', '', '{}',
   'Teaching', 'role', null, null, null, null, null, 2,
   date_trunc('day', now()) + interval '5 days 18 hours', date_trunc('day', now()) + interval '5 days 20 hours',
   null, 'virtual', 'private', 'open')
on conflict (id) do nothing;
