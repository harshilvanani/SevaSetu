-- Regression tests for the November 2026 security review.
begin;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c801', 'admin8@test.dev', '{"full_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000c802', 'owner8@test.dev', '{"full_name":"Olu Owner"}'),
  ('00000000-0000-0000-0000-00000000c803', 'vol8@test.dev', '{"full_name":"Vik Volunteer"}'),
  ('00000000-0000-0000-0000-00000000c804', 'stranger8@test.dev', '{"full_name":"Sam Stranger"}');
update profiles set is_platform_admin = (id = '00000000-0000-0000-0000-00000000c801');
update profiles set onboarded_at = now() where id in ('00000000-0000-0000-0000-00000000c803', '00000000-0000-0000-0000-00000000c804');
insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a8a1', 'Eight Org', 'approved', '00000000-0000-0000-0000-00000000c802');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a8a1', '00000000-0000-0000-0000-00000000c802', 'owner');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility, published_at) values
  ('00000000-0000-0000-0000-00000000e8e1', '00000000-0000-0000-0000-00000000a8a1', 'Private eight',
   now() + interval '5 days', now() + interval '5 days 3 hours', 'onsite', '1 Main St', 'published', 'private', now()),
  ('00000000-0000-0000-0000-00000000e8e2', '00000000-0000-0000-0000-00000000a8a1', 'Public eight',
   now() + interval '6 days', now() + interval '6 days 3 hours', 'onsite', '1 Main St', 'published', 'public', now());
insert into seva_tasks (id, event_id, title, type, positions, status) values
  ('00000000-0000-0000-0000-00000000f8f1', '00000000-0000-0000-0000-00000000e8e1', 'Private seva', 'role', 3, 'open');

-- ------------------------------------------------------------ 1. public_profiles
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c803","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ update public_profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000c802' $$, '42501', null, 'the public view cannot be updated');
select throws_ok($$ delete from public_profiles where id = '00000000-0000-0000-0000-00000000c804' $$, '42501', null, 'the public view cannot be deleted from');
select is((select count(*)::int from public_profiles where id = '00000000-0000-0000-0000-00000000c804'), 0, 'ordinary users are not listed to other users');
select is((select full_name from public_profiles where id = '00000000-0000-0000-0000-00000000c802'), 'Olu Owner', 'organizers of approved organizations are still named');
select throws_ok($$ truncate public.notifications $$, '42501', null, 'tables cannot be truncated');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public_profiles where id in ('00000000-0000-0000-0000-00000000c803', '00000000-0000-0000-0000-00000000c804', '00000000-0000-0000-0000-00000000c801')), 0, 'visitors cannot list ordinary users or admins');
select throws_ok($$ select is_blocked('00000000-0000-0000-0000-00000000c803') $$, '42501', null, 'visitors cannot ask whether a user is blocked');
select throws_ok($$ select join_task('00000000-0000-0000-0000-00000000f8f1') $$, '42501', null, 'visitors cannot call member functions');
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e8e2'), 1, 'visitors still see public events');
reset role;

-- ------------------------------------------------------------ 2. profiles are not opened by inviting someone
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c802","role":"authenticated"}', true);
set local role authenticated;
select is(invite_to_event('00000000-0000-0000-0000-00000000e8e1', array['00000000-0000-0000-0000-00000000c804']::uuid[], 7), 1, 'organizer invites a stranger');
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-00000000c804'), 0, 'inviting does not reveal the stranger''s profile (email, location)');
select is((select full_name from event_access_people('00000000-0000-0000-0000-00000000e8e1') where user_id = '00000000-0000-0000-0000-00000000c804'), 'Sam Stranger', 'the organizer still sees the invited person''s name');
select is((select count(*)::int from search_volunteers('00000000-0000-0000-0000-00000000a8a1', 'Sam Stranger')), 1, 'organizer search by name works');
select ok((select email not like 'stranger8@%' from search_volunteers('00000000-0000-0000-0000-00000000a8a1', 'Sam Stranger')), 'search masks the email unless typed exactly');
select throws_ok($$ select invite_to_task('00000000-0000-0000-0000-00000000f8f1', array['00000000-0000-0000-0000-00000000c804']::uuid[]) $$, '42501', null, 'the old per-seva invitation function is closed');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c803","role":"authenticated"}', true);
select throws_ok($$ select * from event_access_people('00000000-0000-0000-0000-00000000e8e1') $$, 'P0001', 'not_authorized', 'only organizers can list invited people');

-- ------------------------------------------------------------ 4. removing access really removes it
select is(request_event_access('00000000-0000-0000-0000-00000000e8e1'), 'requested', 'volunteer asks to join');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c802","role":"authenticated"}', true);
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-00000000c803'), 1, 'someone who asked to join is visible to the organizer');
select lives_ok($$ select respond_event_request('00000000-0000-0000-0000-00000000e8e1', '00000000-0000-0000-0000-00000000c803', true) $$, 'approved');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c803","role":"authenticated"}', true);
select is((join_task('00000000-0000-0000-0000-00000000f8f1')) ->> 'status', 'joined', 'volunteer joins the private seva');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c802","role":"authenticated"}', true);
select lives_ok($$ select revoke_event_access('00000000-0000-0000-0000-00000000e8e1', '00000000-0000-0000-0000-00000000c803') $$, 'organizer removes access');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c803","role":"authenticated"}', true);
select is((select count(*)::int from events where id = '00000000-0000-0000-0000-00000000e8e1'), 0, 'the removed volunteer no longer sees the private event');
select is((select status::text from assignments where volunteer_id = '00000000-0000-0000-0000-00000000c803'), 'cancelled', 'and their open spot is released');

-- ------------------------------------------------------------ 3. event status
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c801","role":"authenticated"}', true);
select lives_ok($$ select admin_cancel_event('00000000-0000-0000-0000-00000000e8e2', 'Test') $$, 'admin cancels an event');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c802","role":"authenticated"}', true);
select throws_ok($$ update events set status = 'published' where id = '00000000-0000-0000-0000-00000000e8e2' $$, 'P0001', 'invalid_status_change', 'the organizer cannot undo the admin''s cancellation');
select throws_ok($$ update events set status = 'completed' where id = '00000000-0000-0000-0000-00000000e8e1' $$, 'P0001', 'invalid_status_change', 'completing must go through the hours step');

select * from finish();
rollback;
