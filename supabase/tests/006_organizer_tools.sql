-- Organizer tools: templates, seva visibility, private-event access, hours on completion, volunteer search.
begin;
select plan(43);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c101', 'admin6@test.dev', '{"full_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000c102', 'owner6@test.dev', '{"full_name":"Olu Owner"}'),
  ('00000000-0000-0000-0000-00000000c103', 'vol6@test.dev', '{"full_name":"Vik Volunteer"}'),
  ('00000000-0000-0000-0000-00000000c104', 'vol6b@test.dev', '{"full_name":"Bea Online"}');
update profiles set is_platform_admin = (id = '00000000-0000-0000-0000-00000000c101');
update profiles set onboarded_at = now(), interests = '{food}', skills = '{driving}', city = 'Toronto',
  latitude = 43.66, longitude = -79.39, radius_km = 25, serve_mode = 'either'
  where id = '00000000-0000-0000-0000-00000000c103';
update profiles set onboarded_at = now(), interests = '{}', skills = '{}', serve_mode = 'virtual'
  where id = '00000000-0000-0000-0000-00000000c104';
-- Vik is free on the seva's weekday morning
insert into availability_slots (user_id, weekday, period) values
  ('00000000-0000-0000-0000-00000000c103', extract(isodow from (date_trunc('day', now()) + interval '10 days'))::int - 1, 'morning');

insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a6a1', 'Six Org', 'approved', '00000000-0000-0000-0000-00000000c102');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a6a1', '00000000-0000-0000-0000-00000000c102', 'owner');
-- a private event (name visible, details hidden) and a public one
insert into events (id, org_id, title, starts_at, ends_at, mode, address, latitude, longitude, status, visibility, published_at) values
  ('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000a6a1', 'Private course',
   date_trunc('day', now()) + interval '10 days 9 hours', date_trunc('day', now()) + interval '10 days 12 hours',
   'onsite', '1 Main St', 43.65, -79.38, 'published', 'private', now()),
  ('00000000-0000-0000-0000-00000000e6e2', '00000000-0000-0000-0000-00000000a6a1', 'Public drive',
   date_trunc('day', now()) + interval '12 days 9 hours', date_trunc('day', now()) + interval '12 days 12 hours',
   'virtual', null, null, null, 'published', 'public', now());
insert into seva_tasks (id, event_id, title, type, positions, category, mode, starts_at, ends_at, status, visibility) values
  ('00000000-0000-0000-0000-00000000f6f1', '00000000-0000-0000-0000-00000000e6e1', 'Setup', 'role', 3, 'event_setup', 'onsite',
   date_trunc('day', now()) + interval '10 days 9 hours', date_trunc('day', now()) + interval '10 days 12 hours', 'open', 'public'),
  ('00000000-0000-0000-0000-00000000f6f2', '00000000-0000-0000-0000-00000000e6e1', 'Kitchen', 'role', 2, 'food', 'onsite',
   date_trunc('day', now()) + interval '10 days 9 hours', date_trunc('day', now()) + interval '10 days 12 hours', 'open', 'public');
insert into seva_tasks (id, event_id, title, type, target_qty, unit, minutes_per_unit, category, mode, status, visibility) values
  ('00000000-0000-0000-0000-00000000f6f3', '00000000-0000-0000-0000-00000000e6e2', 'Calls', 'quantity', 10, 'calls', 30, 'outreach', 'virtual', 'open', 'public');

-- ------------------------------------------------------------ templates
select is((select count(*)::int from event_templates where org_id is null), 5, 'five built-in templates');
select is((select count(*)::int from event_template_tasks), 19, 'with all their seva names');
select is((select name_i18n ->> 'fr' from event_templates where name = 'Satsang'), 'Satsang', 'French names are stored');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from event_templates) >= 5, 'a volunteer can read built-in templates');
select throws_ok($$ insert into event_templates (name) values ('Sneaky') $$, '42501', null, 'a volunteer cannot add a built-in template');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select lives_ok($$ insert into event_templates (org_id, name) values ('00000000-0000-0000-0000-00000000a6a1', 'My template') $$, 'an organizer saves an organization template');
select throws_ok($$ insert into event_templates (name) values ('Global by organizer') $$, '42501', null, 'an organizer cannot add a built-in template');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c101","role":"authenticated"}', true);
select lives_ok($$ insert into event_templates (name) values ('Admin made') $$, 'a super admin adds a built-in template');
reset role;

-- ------------------------------------------------------------ seva visibility follows the event
select is((select visibility::text from seva_tasks where id = '00000000-0000-0000-0000-00000000f6f1'), 'private', 'seva in a private event is private');
update events set visibility = 'public' where id = '00000000-0000-0000-0000-00000000e6e1';
select is((select visibility::text from seva_tasks where id = '00000000-0000-0000-0000-00000000f6f2'), 'public', 'changing the event changes its seva');
update events set visibility = 'private' where id = '00000000-0000-0000-0000-00000000e6e1';
select is((select visibility::text from seva_tasks where id = '00000000-0000-0000-0000-00000000f6f3'), 'public', 'public event keeps public seva');

-- ------------------------------------------------------------ private events: request, approve, join
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e6e1'), 0, 'private event details are hidden');
select is((select count(*)::int from list_private_events() where title = 'Private course' and access is null), 1, 'the name is listed to a signed-in volunteer');
select throws_ok($$ select join_task('00000000-0000-0000-0000-00000000f6f1') $$, 'P0001', 'task_not_found', 'cannot join before access');
select throws_ok($$ select request_event_access('00000000-0000-0000-0000-00000000e6e2') $$, 'P0001', 'event_not_found', 'cannot request a public event');
select is(request_event_access('00000000-0000-0000-0000-00000000e6e1', 'Happy to help'), 'requested', 'volunteer requests to join');
select throws_ok($$ select respond_event_request('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000c103', true) $$, 'P0001', 'not_authorized', 'a volunteer cannot approve themselves');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select is((select count(*)::int from notifications where user_id = '00000000-0000-0000-0000-00000000c102' and type = 'event_request'), 1, 'the organizer is notified of the request');
select lives_ok($$ select respond_event_request('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000c103', true) $$, 'organizer approves');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e6e1'), 1, 'approved volunteer sees the event');
select is((join_task('00000000-0000-0000-0000-00000000f6f1')) ->> 'status', 'joined', 'and can join its seva');

-- invitations: Bea is invited, then declines; access is revoked afterwards
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select is(invite_to_event('00000000-0000-0000-0000-00000000e6e1', array['00000000-0000-0000-0000-00000000c104']::uuid[], 7), 1, 'organizer invites a volunteer');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c104","role":"authenticated"}', true);
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e6e1'), 1, 'an invited volunteer sees the event');
select lives_ok($$ select decline_event_invitation('00000000-0000-0000-0000-00000000e6e1') $$, 'invitation declined');
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e6e1'), 0, 'declined volunteer loses access');

-- ------------------------------------------------------------ find volunteers
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select is((select count(*)::int from find_volunteers('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000f6f1') where full_name = 'Vik Volunteer'),
          0, 'volunteers who already joined that seva are not suggested again');
reset role;
-- Vik leaves the event so he can be matched for Kitchen
update assignments set status = 'cancelled', cancelled_at = now() where volunteer_id = '00000000-0000-0000-0000-00000000c103';
update event_access set status = 'revoked' where user_id = '00000000-0000-0000-0000-00000000c103';
set local role authenticated;
select is((select array_to_string(reasons, ',') from find_volunteers('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000f6f2', '{driving}', false, false, 'UTC')
           where full_name = 'Vik Volunteer'), 'interest,skills,available,near', 'best match shows why');
select is((select count(*)::int from find_volunteers('00000000-0000-0000-0000-00000000e6e1', '00000000-0000-0000-0000-00000000f6f2', '{}', true, false, 'UTC')
            where id in ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000c104')), 1, 'availability filter keeps only available volunteers');
select ok((select not bool_or(to_jsonb(f)::text like '%@%') from find_volunteers('00000000-0000-0000-0000-00000000e6e1', null) f), 'no contact details in results');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select throws_ok($$ select * from find_volunteers('00000000-0000-0000-0000-00000000e6e1') $$, 'P0001', 'not_authorized', 'only organizers can search');

-- ------------------------------------------------------------ hours on completion
-- Vik does two calls' worth of work (4 calls x 30 min = 2 h) and Bea joins without reporting
select is((join_task('00000000-0000-0000-0000-00000000f6f3', 4)) ->> 'status', 'joined', 'volunteer joins the calls');
select lives_ok($$ select submit_progress((select id from assignments where volunteer_id = '00000000-0000-0000-0000-00000000c103' and task_id = '00000000-0000-0000-0000-00000000f6f3'), 4) $$, 'and reports progress');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c104","role":"authenticated"}', true);
select lives_ok($$ select join_task('00000000-0000-0000-0000-00000000f6f3', 1) $$, 'another volunteer joins without reporting');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select lives_ok($$ select review_progress((select id from progress_reports limit 1), 'approve', null, null) $$, 'organizer approves the report');
select is((select count(*)::int from event_hours_candidates('00000000-0000-0000-0000-00000000e6e2')), 1, 'only volunteers with approved work are listed');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select is((select verified_hours from volunteer_stats()), 2.0, 'estimate counts before completion');
select throws_ok($$ select complete_event('00000000-0000-0000-0000-00000000e6e2', '[]') $$, 'P0001', 'not_authorized', 'a volunteer cannot complete an event');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select lives_ok($$ select complete_event('00000000-0000-0000-0000-00000000e6e2',
  jsonb_build_array(jsonb_build_object('assignment_id', (select assignment_id from event_hours_candidates('00000000-0000-0000-0000-00000000e6e2')), 'hours', 4.5))) $$, 'organizer completes with logged hours');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select is((select verified_hours from volunteer_stats()), 4.5, 'logged hours replace the estimate');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select lives_ok($$ select reopen_event('00000000-0000-0000-0000-00000000e6e2') $$, 'organizer undoes the completion');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select is((select verified_hours from volunteer_stats()), 2.0, 'while reopened the estimate counts again');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c102","role":"authenticated"}', true);
select lives_ok($$ select complete_event('00000000-0000-0000-0000-00000000e6e2', '[]') $$, 'completing again');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
select is((select verified_hours from volunteer_stats()), 4.5, 'the earlier logged hours come back');

select * from finish();
rollback;
