-- Super-admin console: org review / suspend / resubmit, user blocking, admin roles, event cancellation, audit log.
begin;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@test.dev', '{"full_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000ad02', 'owner@test.dev', '{"full_name":"Olu Owner"}'),
  ('00000000-0000-0000-0000-00000000ad03', 'vol@test.dev', '{"full_name":"Vik Volunteer"}');
update profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000ad01';
-- The hosted project already has real admins; make this one the only admin inside the test transaction.
update profiles set is_platform_admin = false where id <> '00000000-0000-0000-0000-00000000ad01';

insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a0a1', 'Review Org', 'pending', '00000000-0000-0000-0000-00000000ad02'),
  ('00000000-0000-0000-0000-00000000a0a2', 'Live Org', 'approved', '00000000-0000-0000-0000-00000000ad02');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-00000000ad02', 'owner'),
  ('00000000-0000-0000-0000-00000000a0a2', '00000000-0000-0000-0000-00000000ad02', 'owner');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility, published_at) values
  ('00000000-0000-0000-0000-00000000e0e1', '00000000-0000-0000-0000-00000000a0a2', 'Live event',
   now() + interval '3 days', now() + interval '3 days 3 hours', 'onsite', '1 Main St', 'published', 'public', now());
insert into seva_tasks (id, event_id, title, type, positions, status) values
  ('00000000-0000-0000-0000-00000000f0f1', '00000000-0000-0000-0000-00000000e0e1', 'Greeter', 'role', 5, 'open'),
  ('00000000-0000-0000-0000-00000000f0f2', '00000000-0000-0000-0000-00000000e0e1', 'Usher', 'role', 5, 'open');

-- ------------------------------------------------------------ non-admins are refused
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad03","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select admin_overview() $$, 'P0001', 'not_authorized', 'non-admin: overview refused');
select throws_ok($$ select * from admin_list_users() $$, 'P0001', 'not_authorized', 'non-admin: user list refused');
select throws_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a1', 'approve') $$, 'P0001', 'not_authorized', 'non-admin: org review refused');
select throws_ok($$ select admin_set_user_blocked('00000000-0000-0000-0000-00000000ad02', true, 'x') $$, 'P0001', 'not_authorized', 'non-admin: block refused');
select throws_ok($$ select admin_set_platform_admin('00000000-0000-0000-0000-00000000ad03', true) $$, 'P0001', 'not_authorized', 'non-admin: cannot make self admin');
select throws_ok($$ select admin_cancel_event('00000000-0000-0000-0000-00000000e0e1', 'x') $$, 'P0001', 'not_authorized', 'non-admin: event cancel refused');
select is((select count(*)::int from admin_actions), 0, 'non-admin cannot read the audit log');
-- the volunteer joins both tasks (one stays, one gets a report)
select is((join_task('00000000-0000-0000-0000-00000000f0f1')) ->> 'status', 'joined', 'volunteer joins greeter');

-- ------------------------------------------------------------ organization review
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a1', 'reject') $$, 'P0001', 'reason_required', 'reject needs a reason');
select lives_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a1', 'reject', 'Please add a description') $$, 'admin rejects with reason');
select throws_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a1', 'suspend', 'x') $$, 'P0001', 'invalid_transition', 'cannot suspend a rejected org');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad02","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select resubmit_organization('00000000-0000-0000-0000-00000000a0a1', 'Review Org', 'Toronto', 'We run weekly seva.') $$, 'owner resubmits');
select is((select status::text from organizations where id = '00000000-0000-0000-0000-00000000a0a1'), 'pending', 'resubmitted org is pending again');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a1', 'approve') $$, 'admin approves');
select lives_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a2', 'suspend', 'Reported misuse') $$, 'admin suspends live org');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from seva_tasks where event_id = '00000000-0000-0000-0000-00000000e0e1'), 0, 'suspended org disappears from Discover');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad02","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into events (org_id, title, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000a0a2', 'x', now(), now() + interval '1 hour') $$,
  '42501', null, 'suspended org cannot create events');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select admin_review_organization('00000000-0000-0000-0000-00000000a0a2', 'reinstate') $$, 'admin reinstates');
select is((select count(*)::int from assignments where volunteer_id = '00000000-0000-0000-0000-00000000ad03'), 1, 'admin can read anyone''s assignments');

-- ------------------------------------------------------------ blocking
select throws_ok($$ select admin_set_user_blocked('00000000-0000-0000-0000-00000000ad01', true, 'x') $$, 'P0001', 'cannot_block_self', 'cannot block yourself');
select is((admin_set_user_blocked('00000000-0000-0000-0000-00000000ad03', true, 'Spam sign-ups')) ->> 'cancelled', '1', 'blocking releases the upcoming spot');

reset role;
select ok((select banned_until > now() from auth.users where id = '00000000-0000-0000-0000-00000000ad03'), 'blocked user is banned from signing in');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad03","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select join_task('00000000-0000-0000-0000-00000000f0f2') $$, 'P0001', 'account_blocked', 'blocked user cannot join');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select admin_set_user_blocked('00000000-0000-0000-0000-00000000ad03', false, 'Verified identity') $$, 'admin unblocks');

-- ------------------------------------------------------------ admin roles
select throws_ok($$ select admin_set_platform_admin('00000000-0000-0000-0000-00000000ad01', false) $$, 'P0001', 'cannot_remove_self', 'cannot remove your own admin role');
select lives_ok($$ select admin_set_platform_admin('00000000-0000-0000-0000-00000000ad02', true) $$, 'admin grants admin');

-- ------------------------------------------------------------ event cancellation + audit
select lives_ok($$ select admin_cancel_event('00000000-0000-0000-0000-00000000e0e1', 'Venue closed') $$, 'admin cancels an event');
-- (now() is constant inside the test transaction, so compare the set of actions)
select is((select array_agg(action order by action)::text from admin_actions where admin_id = '00000000-0000-0000-0000-00000000ad01'),
  '{admin_grant,event_cancel,org_approve,org_reinstate,org_reject,org_suspend,user_block,user_unblock}',
  'every admin action is in the audit log');

select finish();
rollback;
