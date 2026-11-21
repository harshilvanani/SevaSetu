-- Merge phase 1: Volunteer 360 fields, private accessibility needs, directory consent, match score, teams, insights,
-- centres and weekly repeats.
begin;
select plan(36);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c901', 'owner9@test.dev', '{"full_name":"Owen Owner"}'),
  ('00000000-0000-0000-0000-00000000c902', 'served9@test.dev', '{"full_name":"Sita Served"}'),
  ('00000000-0000-0000-0000-00000000c903', 'optin9@test.dev', '{"full_name":"Omar Optin"}'),
  ('00000000-0000-0000-0000-00000000c904', 'hidden9@test.dev', '{"full_name":"Hana Hidden"}'),
  ('00000000-0000-0000-0000-00000000c905', 'other9@test.dev', '{"full_name":"Odile OtherOrg"}');
update profiles set onboarded_at = now(), interests = '{food}', skills = '{kitchen,driving}',
  skill_levels = '{"kitchen":"expert"}', city = 'Toronto, ON', province = 'ON', latitude = 43.66, longitude = -79.39,
  radius_km = 25, serve_mode = 'either', person_type = 'volunteer_teacher'
  where id = '00000000-0000-0000-0000-00000000c902';
update profiles set onboarded_at = now(), interests = '{food}', skills = '{}', directory_opt_in = true, province = 'QC',
  linkedin_url = 'https://www.linkedin.com/in/omar-test', linkedin_consent = true
  where id = '00000000-0000-0000-0000-00000000c903';
insert into availability_slots (user_id, weekday, period) values
  ('00000000-0000-0000-0000-00000000c902', extract(isodow from (date_trunc('day', now()) + interval '10 days'))::int - 1, 'morning');

insert into organizations (id, name, status, created_by) values
  ('00000000-0000-0000-0000-00000000a9a1', 'Nine Org', 'approved', '00000000-0000-0000-0000-00000000c901'),
  ('00000000-0000-0000-0000-00000000a9a2', 'Other Org', 'approved', '00000000-0000-0000-0000-00000000c905');
insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9a1', '00000000-0000-0000-0000-00000000c901', 'owner'),
  ('00000000-0000-0000-0000-00000000a9a2', '00000000-0000-0000-0000-00000000c905', 'owner');
insert into centres (id, org_id, name, city, province) values
  ('00000000-0000-0000-0000-00000000ce91', '00000000-0000-0000-0000-00000000a9a1', 'Nine Centre', 'Toronto', 'ON'),
  ('00000000-0000-0000-0000-00000000ce92', '00000000-0000-0000-0000-00000000a9a2', 'Other Centre', 'Ottawa', 'ON');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, latitude, longitude, status, visibility, published_at, centre_id) values
  ('00000000-0000-0000-0000-00000000e9e1', '00000000-0000-0000-0000-00000000a9a1', 'Kitchen day',
   date_trunc('day', now()) + interval '10 days 9 hours', date_trunc('day', now()) + interval '10 days 12 hours',
   'onsite', '1 Main St', 43.65, -79.38, 'published', 'public', now(), '00000000-0000-0000-0000-00000000ce91');
insert into seva_tasks (id, event_id, title, type, positions, category, status) values
  ('00000000-0000-0000-0000-00000000f9f1', '00000000-0000-0000-0000-00000000e9e1', 'Cooks', 'role', 4, 'food', 'open');
insert into assignments (task_id, volunteer_id, claimed_qty) values
  ('00000000-0000-0000-0000-00000000f9f1', '00000000-0000-0000-0000-00000000c902', 1);

-- ------------------------------------------------------------ profile fields
select is(region_for('QC', 'CA'), 'quebec', 'Québec is in the Quebec region');
select is(region_for('MA', 'US'), 'usa', 'US states are in the USA region');
select is((select region from profiles where id = '00000000-0000-0000-0000-00000000c902'), 'ontario', 'region follows the province');
select ok((select volunteer_code(person_type, country, volunteer_no) ~ '^TCH-CA-[0-9]{6}$' from profiles where id = '00000000-0000-0000-0000-00000000c902'),
  'teachers get a TCH code');
select throws_ok($$ update profiles set linkedin_url = 'https://evil.example/in/x' where id = '00000000-0000-0000-0000-00000000c903' $$,
  '23514', null, 'only linkedin.com links are accepted');
select throws_ok($$ update profiles set skill_levels = '{"kitchen":"guru"}' where id = '00000000-0000-0000-0000-00000000c903' $$,
  '23514', null, 'skill levels are beginner, intermediate or expert');
select throws_ok($$ insert into events (org_id, title, starts_at, ends_at, centre_id) values
  ('00000000-0000-0000-0000-00000000a9a1', 'Bad centre', now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-00000000ce92') $$,
  'P0001', 'invalid_centre', 'an event cannot use another organization''s centre');

-- ------------------------------------------------------------ private accessibility needs
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c903","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ insert into profile_private (user_id, accessibility_needs) values ('00000000-0000-0000-0000-00000000c903', 'Needs step-free access') $$,
  'a volunteer saves their accessibility needs');
select throws_ok($$ insert into profile_private (user_id, accessibility_needs) values ('00000000-0000-0000-0000-00000000c904', 'x') $$,
  '42501', null, 'nobody writes someone else''s accessibility needs');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c902","role":"authenticated"}', true);
insert into profile_private (user_id, accessibility_needs) values ('00000000-0000-0000-0000-00000000c902', 'Prefers seated seva');
select is((select count(*)::int from profile_private), 1, 'volunteers see only their own private row');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c901","role":"authenticated"}', true);
select is((select accessibility_needs from profile_private where user_id = '00000000-0000-0000-0000-00000000c902'), 'Prefers seated seva',
  'the organizer of a seva they joined can read it');
select is((select count(*)::int from profile_private where user_id = '00000000-0000-0000-0000-00000000c903'), 0,
  'an organizer cannot read it for someone who never joined their seva');

-- ------------------------------------------------------------ directory
select is((select count(*)::int from org_directory('00000000-0000-0000-0000-00000000a9a1')
           where id in ('00000000-0000-0000-0000-00000000c902', '00000000-0000-0000-0000-00000000c903')), 2,
  'the directory has people who served or opted in');
select is((select count(*)::int from org_directory('00000000-0000-0000-0000-00000000a9a1')
           where id = '00000000-0000-0000-0000-00000000c904'), 0, 'people who did neither stay out of the directory');
select is((select email from org_directory('00000000-0000-0000-0000-00000000a9a1') where id = '00000000-0000-0000-0000-00000000c903'), null,
  'opted-in strangers show no email');
select is((select email from org_directory('00000000-0000-0000-0000-00000000a9a1') where id = '00000000-0000-0000-0000-00000000c902'), 'served9@test.dev',
  'people who served with the organization show their email');
select ok((select served_with_org and is_active and hours >= 0 from org_directory('00000000-0000-0000-0000-00000000a9a1') where id = '00000000-0000-0000-0000-00000000c902'),
  'directory rows say who served and who is active');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c903","role":"authenticated"}', true);
select throws_ok($$ select * from org_directory('00000000-0000-0000-0000-00000000a9a1') $$, 'P0001', 'not_authorized', 'volunteers cannot open the directory');
select throws_ok($$ select org_insights('00000000-0000-0000-0000-00000000a9a1') $$, 'P0001', 'not_authorized', 'volunteers cannot open insights');
select throws_ok($$ select org_insights() $$, 'P0001', 'not_authorized', 'only platform admins see platform-wide insights');

-- ------------------------------------------------------------ teams
reset role;
insert into teams (id, org_id, centre_id, name, seva_area) values
  ('00000000-0000-0000-0000-0000000079a1', '00000000-0000-0000-0000-00000000a9a1', '00000000-0000-0000-0000-00000000ce91', 'Kitchen team', 'food');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c901","role":"authenticated"}', true);
select throws_ok($$ select invite_to_team('00000000-0000-0000-0000-0000000079a1', array['00000000-0000-0000-0000-00000000c904'::uuid]) $$,
  'P0001', 'not_in_directory', 'only directory people can be invited');
select is(invite_to_team('00000000-0000-0000-0000-0000000079a1', array['00000000-0000-0000-0000-00000000c903'::uuid]), 1, 'opted-in volunteer invited');
select throws_ok($$ update teams set lead_id = '00000000-0000-0000-0000-00000000c903' where id = '00000000-0000-0000-0000-0000000079a1' $$,
  'P0001', 'lead_not_member', 'an invited person cannot lead yet');
select ok((select count(*) > 0 from team_suggestions('00000000-0000-0000-0000-0000000079a1')), 'team builder suggests people');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c905","role":"authenticated"}', true);
select is((select count(*)::int from teams where id = '00000000-0000-0000-0000-0000000079a1'), 0, 'other organizations cannot see the team');
select throws_ok($$ select * from org_teams('00000000-0000-0000-0000-00000000a9a1') $$, 'P0001', 'not_authorized', 'or list it');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c903","role":"authenticated"}', true);
select is((select status from my_teams() where id = '00000000-0000-0000-0000-0000000079a1'), 'invited', 'the volunteer sees the invitation');
select lives_ok($$ select respond_team_invite('00000000-0000-0000-0000-0000000079a1', true) $$, 'and accepts it');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c901","role":"authenticated"}', true);
select lives_ok($$ update teams set lead_id = '00000000-0000-0000-0000-00000000c903' where id = '00000000-0000-0000-0000-0000000079a1' $$,
  'an active member can lead');
select ok((select email is not null from profiles where id = '00000000-0000-0000-0000-00000000c903'), 'organizers can open their team members'' profiles');

-- ------------------------------------------------------------ match score
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c901","role":"authenticated"}', true);
reset role;
delete from assignments where volunteer_id = '00000000-0000-0000-0000-00000000c902';
set local role authenticated;
select is((select score from find_volunteers('00000000-0000-0000-0000-00000000e9e1', '00000000-0000-0000-0000-00000000f9f1', '{}', false, false, 'UTC')
           where id = '00000000-0000-0000-0000-00000000c902'), 96, 'expert cook, food lover, free, nearby, teacher: 40+25+20+10+1');
select is((select breakdown ->> 'linkedin' from find_volunteers('00000000-0000-0000-0000-00000000e9e1', '00000000-0000-0000-0000-00000000f9f1', '{}', false, false, 'UTC')
           where id = '00000000-0000-0000-0000-00000000c903'), '3', 'LinkedIn counts only with consent');
select ok((select bool_and(score between 0 and 100) from find_volunteers('00000000-0000-0000-0000-00000000e9e1')), 'scores stay between 0 and 100');
select is((select array_to_string(reasons, ',') from find_volunteers('00000000-0000-0000-0000-00000000e9e1', '00000000-0000-0000-0000-00000000f9f1', '{}', false, false, 'UTC')
           where id = '00000000-0000-0000-0000-00000000c902'), 'interest,skills,available,near', 'reasons still explain the match');

-- ------------------------------------------------------------ insights and repeats
select ok((select (org_insights('00000000-0000-0000-0000-00000000a9a1') -> 'kpis' ->> 'upcoming_events')::int = 1), 'insights count upcoming events');
select is(repeat_event_weekly('00000000-0000-0000-0000-00000000e9e1', (date_trunc('day', now()) + interval '31 days')::date, 'UTC'), 3,
  'a weekly repeat makes the next three weeks');
select is((select count(*)::int from seva_tasks t join events e on e.id = t.event_id where e.series_id = '00000000-0000-0000-0000-00000000e9e1'), 4,
  'each copy has its seva');

select * from finish();
rollback;
