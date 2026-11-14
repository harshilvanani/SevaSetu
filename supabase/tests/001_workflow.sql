-- Core workflow tests: capacity protection, private visibility, progress review, permissions.
-- Run with `supabase test db` (CI) or `node scripts/db.mjs test` (hosted project, rolled back).
begin;
select plan(31);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'organizer@test.dev', '{"full_name":"Anjali Test"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'priya@test.dev', '{"full_name":"Priya Test"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'rahul@test.dev', '{"full_name":"Rahul Test"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'kavya@test.dev', '{"full_name":"Kavya Test"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'pending-org@test.dev', '{"full_name":"Pending Owner"}');

insert into organizations (id, name, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Test Org', 'approved'),
  ('00000000-0000-0000-0000-00000000000b', 'Pending Org', 'pending');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', 'owner');

insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'Published event',
   now() + interval '3 days', now() + interval '3 days 3 hours', 'onsite', '50 Maple Ave', 'draft', 'public'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a', 'Draft event',
   now() + interval '5 days', now() + interval '5 days 2 hours', 'virtual', null, 'draft', 'public'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000a', 'Invite-only event',
   now() + interval '4 days', now() + interval '4 days 2 hours', 'virtual', null, 'draft', 'private');

insert into seva_tasks (id, event_id, title, type, target_qty, unit, max_per_volunteer, minutes_per_unit, visibility) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'Make calls', 'quantity', 10, 'calls', 6, 30, 'public'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e3', 'Private coordination', 'quantity', 5, 'items', 5, 0, 'private');
insert into seva_tasks (id, event_id, title, type, positions, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', 'Welcome desk', 'role', 1,
   now() + interval '3 days', now() + interval '3 days 2 hours');
insert into seva_tasks (id, event_id, title, type, positions) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000e2', 'Draft task', 'role', 3);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select publish_event('00000000-0000-0000-0000-0000000000e1') $$, 'organizer publishes event');
select lives_ok($$ select publish_event('00000000-0000-0000-0000-0000000000e3') $$, 'organizer publishes the invite-only event');
select is((select status::text from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), 'open', 'tasks open on publish');

-- ---------------------------------------------------------------- anon visibility
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from seva_tasks where event_id = '00000000-0000-0000-0000-0000000000e1'), 2,
  'anon sees public tasks of published event (not private)');
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-0000000000e2'), 0, 'anon cannot see draft event');

-- ---------------------------------------------------------------- capacity
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((join_task('00000000-0000-0000-0000-0000000000f1', 6)) ->> 'status', 'joined', 'priya joins 6 calls');
select throws_ok($$ select join_task('00000000-0000-0000-0000-0000000000f1', 1) $$, 'P0001', 'already_joined', 'cannot join twice');
select is((select claimed_total from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), 6, 'claimed counter updated');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select join_task('00000000-0000-0000-0000-0000000000f1', 7) $$, 'P0001', 'quantity_exceeds_max', 'per-volunteer max enforced');
select is(join_task('00000000-0000-0000-0000-0000000000f1', 6),
  '{"status":"capacity_changed","available":4}'::jsonb, 'over-request returns available quantity');
select is((join_task('00000000-0000-0000-0000-0000000000f1', 4)) ->> 'status', 'joined', 'rahul joins remaining 4');
select is((select status::text from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), 'full', 'task flips to full');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
select is(join_task('00000000-0000-0000-0000-0000000000f1', 1), '{"status":"full"}'::jsonb, 'full task cannot be joined');
select is((join_task('00000000-0000-0000-0000-0000000000f2', 1)) ->> 'status', 'joined', 'kavya takes the only role position');

-- ---------------------------------------------------------------- private tasks
select is((select count(*)::int from seva_tasks where id = '00000000-0000-0000-0000-0000000000f3'), 0, 'private task hidden from non-invitee');
select throws_ok($$ select join_task('00000000-0000-0000-0000-0000000000f3', 1) $$, 'P0001', 'task_not_found', 'non-invitee cannot join private task');
select is((select count(*)::int from assignments), 1, 'volunteer only sees own assignments');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(invite_to_event('00000000-0000-0000-0000-0000000000e3', array['00000000-0000-0000-0000-0000000000b3'::uuid]), 1, 'organizer invites kavya');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from seva_tasks where id = '00000000-0000-0000-0000-0000000000f3'), 1, 'invitee sees private task');
select is((join_task('00000000-0000-0000-0000-0000000000f3', 2)) ->> 'status', 'joined', 'invitee joins private task');

-- ---------------------------------------------------------------- progress
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select throws_like($$ select submit_progress((select id from assignments where volunteer_id = auth.uid()), 7) $$,
  'quantity_exceeds_remaining%', 'cannot report more than claimed');
select lives_ok($$ select submit_progress((select id from assignments where volunteer_id = auth.uid()), 3, 'three calls') $$, 'priya reports 3');
select is((select pending_total from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), 3, 'pending counter');
select throws_ok($$ select review_progress((select id from progress_reports limit 1), 'approve') $$,
  'P0001', 'not_authorized', 'volunteer cannot review');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select review_progress((select id from progress_reports limit 1), 'adjust', 2) $$,
  'P0001', 'reason_required', 'adjust requires a reason');
select lives_ok($$ select review_progress((select id from progress_reports limit 1), 'adjust', 2, 'one duplicate') $$, 'organizer adjusts 3 -> 2');
select is((select verified_total || '/' || pending_total from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), '2/0',
  'verified counts only reviewed work');

-- ---------------------------------------------------------------- leave + hours
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((leave_task((select id from assignments where volunteer_id = auth.uid()))) ->> 'kept', '2', 'leaving keeps verified work');
select is((select status::text || ':' || claimed_total from seva_tasks where id = '00000000-0000-0000-0000-0000000000f1'), 'open:6',
  'released units reopen the task');
select is((select verified_hours from volunteer_stats()), 1.0, '2 verified calls x 30 min = 1 hour');

-- ---------------------------------------------------------------- permissions
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into events (org_id, title, starts_at, ends_at)
  values ('00000000-0000-0000-0000-00000000000b', 'Nope', now(), now() + interval '1 hour') $$,
  '42501', null, 'unapproved org cannot create events');

select finish();
rollback;
