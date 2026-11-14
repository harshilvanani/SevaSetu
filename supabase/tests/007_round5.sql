-- Round 5: courses required by seva, volunteer search including unfinished profiles, donation campaigns and donations.
begin;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c501', 'owner7@test.dev', '{"full_name":"Olu Owner"}'),
  ('00000000-0000-0000-0000-00000000c502', 'vol7@test.dev', '{"full_name":"Vik Volunteer"}'),
  ('00000000-0000-0000-0000-00000000c503', 'new7@test.dev', '{"full_name":"Nina Newcomer"}'),
  ('00000000-0000-0000-0000-00000000c504', 'other7@test.dev', '{"full_name":"Oscar Other"}');
update profiles set onboarded_at = now(), courses = '{}' where id in ('00000000-0000-0000-0000-00000000c502', '00000000-0000-0000-0000-00000000c504');
update profiles set courses = '{part1}' where id = '00000000-0000-0000-0000-00000000c504';
insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a7a1', 'Seven Org', 'approved', '00000000-0000-0000-0000-00000000c501');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a7a1', '00000000-0000-0000-0000-00000000c501', 'owner');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility, published_at) values
  ('00000000-0000-0000-0000-00000000e7e1', '00000000-0000-0000-0000-00000000a7a1', 'Course hosting',
   now() + interval '5 days', now() + interval '5 days 3 hours', 'onsite', '1 Main St', 'published', 'public', now());
insert into seva_tasks (id, event_id, title, type, positions, status, required_courses) values
  ('00000000-0000-0000-0000-00000000f7f1', '00000000-0000-0000-0000-00000000e7e1', 'Teacher hospitality', 'role', 2, 'open', '{part1}');

-- ------------------------------------------------------------ courses
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c502","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select join_task('00000000-0000-0000-0000-00000000f7f1') $$, 'P0001', 'course_required', 'a seva needing Part 1 refuses volunteers without it');
select throws_ok($$ update profiles set courses = '{nonsense}' where id = auth.uid() $$, '23514', null, 'only known courses can be saved');
select lives_ok($$ update profiles set courses = '{part1,sky_teens}' where id = auth.uid() $$, 'volunteer ticks the courses they have done');
select is((join_task('00000000-0000-0000-0000-00000000f7f1')) ->> 'status', 'joined', 'and can then join');

-- ------------------------------------------------------------ find volunteers
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c501","role":"authenticated"}', true);
select is((select count(*)::int from find_volunteers('00000000-0000-0000-0000-00000000e7e1') f where f.full_name in ('Nina Newcomer', 'Oscar Other')), 2,
          'people who have not finished their profile are included');
select is((select full_name from find_volunteers('00000000-0000-0000-0000-00000000e7e1') f where f.full_name in ('Nina Newcomer', 'Oscar Other') limit 1), 'Oscar Other',
          'finished profiles come before unfinished ones');
select is((select onboarded from find_volunteers('00000000-0000-0000-0000-00000000e7e1') f where f.full_name = 'Nina Newcomer'), false, 'unfinished profiles are flagged');
select is((select array_to_string(array_agg(f.full_name order by f.full_name), ',') from find_volunteers('00000000-0000-0000-0000-00000000e7e1', null, '{}', false, false, 'UTC', '{part1}') f
           where f.full_name in ('Nina Newcomer', 'Oscar Other')), 'Oscar Other', 'course filter keeps only people with that course');
select ok((select bool_or(f.reasons @> '{course}') from find_volunteers('00000000-0000-0000-0000-00000000e7e1') f where f.full_name = 'Oscar Other'), 'matching course is shown as a reason');
select ok((select not bool_or(to_jsonb(f)::text like '%@%') from find_volunteers('00000000-0000-0000-0000-00000000e7e1') f), 'still no contact details');

-- ------------------------------------------------------------ donation campaigns
select lives_ok($$ insert into donation_campaigns (org_id, title, goal_cents, status)
  values ('00000000-0000-0000-0000-00000000a7a1', 'Hall fund', 100000, 'active'),
         ('00000000-0000-0000-0000-00000000a7a1', 'Draft fund', null, 'draft') $$, 'organizer creates campaigns');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c504","role":"authenticated"}', true);
select throws_ok($$ insert into donation_campaigns (org_id, title) values ('00000000-0000-0000-0000-00000000a7a1', 'Not mine') $$, '42501', null, 'others cannot add campaigns');
select throws_ok($$ insert into donations (campaign_id, org_id, amount_cents) values ((select id from donation_campaigns where title = 'Hall fund'), '00000000-0000-0000-0000-00000000a7a1', 500) $$,
                 '42501', null, 'donations cannot be written by apps');
reset role;
set local role anon;
select is((select count(*)::int from donation_campaigns where org_id = '00000000-0000-0000-0000-00000000a7a1'), 1, 'visitors see active campaigns only');
select is(org_accepts_donations('00000000-0000-0000-0000-00000000a7a1'), false, 'no Stripe account yet: donations closed');
select throws_ok($$ select count(*) from donations $$, '42501', null, 'visitors cannot read donations');
reset role;

-- the Stripe webhook (service role) records a paid donation
insert into donations (campaign_id, org_id, donor_name, donor_email, amount_cents, status, paid_at)
values ((select id from donation_campaigns where title = 'Hall fund'), '00000000-0000-0000-0000-00000000a7a1', 'Dee Donor', 'dee@test.dev', 5000, 'paid', now());
select is((select raised_cents::int from donation_campaigns where title = 'Hall fund'), 5000, 'campaign total follows paid donations');
select is((select count(*)::int from notifications where user_id = '00000000-0000-0000-0000-00000000c501' and type = 'donation_received'), 1, 'organizers are told about donations');

select * from finish();
rollback;
