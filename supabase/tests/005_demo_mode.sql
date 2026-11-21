-- Demo mode: demo data is invisible to real users, demo users can't touch real data, admin-only controls.
begin;
select plan(15);

-- the hosted project already has demo accounts: remove them inside this rolled-back test
delete from auth.users where id in (select user_id from demo_accounts);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d001', 'admin@test.dev', '{"full_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000d002', 'real@test.dev', '{"full_name":"Real Person"}'),
  ('00000000-0000-0000-0000-00000000d003', 'demo.vol@test.dev', '{}'),
  ('00000000-0000-0000-0000-00000000d004', 'demo.vol2@test.dev', '{}'),
  ('00000000-0000-0000-0000-00000000d005', 'demo.org@test.dev', '{}');
update profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000d001';
update profiles set is_platform_admin = false where id <> '00000000-0000-0000-0000-00000000d001';
insert into demo_accounts (persona, user_id, email, password) values
  ('volunteer', '00000000-0000-0000-0000-00000000d003', 'demo.vol@test.dev', 'pw1'),
  ('volunteer2', '00000000-0000-0000-0000-00000000d004', 'demo.vol2@test.dev', 'pw2'),
  ('organizer', '00000000-0000-0000-0000-00000000d005', 'demo.org@test.dev', 'pw3');

-- a real organization with a public event
insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a0d1', 'Real Org', 'approved', '00000000-0000-0000-0000-00000000d002');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-00000000d002', 'owner');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility, published_at) values
  ('00000000-0000-0000-0000-00000000e0d1', '00000000-0000-0000-0000-00000000a0d1', 'Real event',
   now() + interval '3 days', now() + interval '3 days 3 hours', 'onsite', '1 Main St', 'published', 'public', now());
insert into seva_tasks (id, event_id, title, type, positions, status) values
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-00000000e0d1', 'Real greeter', 'role', 5, 'open');

select reset_demo_data();
select reset_demo_data();  -- idempotent

select is((select count(*)::int from events where org_id = 'd0000000-0000-4000-8000-0000000000a1' and id::text like 'd0000000-0000-4000-8000-0000000000e_'), 8, 'reset builds the 8 base demo events (twice, no duplicates)');
select is((select count(*)::int from events where org_id = 'd0000000-0000-4000-8000-0000000000a1' and title = 'December 25–29 Retreat Seva'), 1, 'the network seed runs once per reset');
select is((select count(*)::int from profiles p join demo_accounts d on d.user_id = p.id where p.is_demo), 3, 'three demo personas');
select is((select claimed_total from seva_tasks where id = 'd0000000-0000-4000-8000-000000000502'), 12, 'demo joins feed the capacity counters');

-- ------------------------------------------------------------ real user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from events where title = 'Community Meal Drive'), 0, 'real user cannot see demo events');
select is((select count(*)::int from organizations where is_demo), 0, 'real user cannot see the demo organization');
select throws_ok($$ select join_task('d0000000-0000-4000-8000-000000000503') $$, 'P0001', 'task_not_found', 'real user cannot join demo seva');
select throws_ok($$ select admin_demo_accounts() $$, 'P0001', 'not_authorized', 'non-admin: demo accounts refused');
select throws_ok($$ select admin_reset_demo() $$, 'P0001', 'not_authorized', 'non-admin: demo reset refused');

-- ------------------------------------------------------------ demo volunteer
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d003","role":"authenticated"}', true);
select is((select count(*)::int from events where id = 'd0000000-0000-4000-8000-0000000000e5'), 1, 'demo user sees demo events');
select is((select count(*)::int from events where title = 'Real event'), 0, 'demo user does not see real events');
select is((join_task('d0000000-0000-4000-8000-000000000503')) ->> 'status', 'joined', 'demo user joins demo seva');
select throws_ok($$ select join_task('00000000-0000-0000-0000-00000000f0d1') $$, 'P0001', 'task_not_found', 'demo user cannot join real seva');

-- ------------------------------------------------------------ admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d001","role":"authenticated"}', true);
select is((select count(*)::int from admin_demo_accounts()), 3, 'admin lists the demo accounts');
select lives_ok($$ select admin_reset_demo() $$, 'admin resets the demo');

select * from finish();
rollback;
