-- Demo network for the merged product: centres across Canada and the US, 8 months of past seva with logged hours,
-- upcoming events (including the December 25-29 Retreat Seva), teams, and the mock volunteer applications
-- loaded by scripts/import-mock-volunteers.py. Everything here lives in the walled-off demo world.

-- Extra facts from the mock application form that only the demo seed uses (no client access).
create table if not exists public.demo_volunteer_seed (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  experienced boolean not null default false,       -- volunteered at the Retreat Centre in the last 2 years
  last_seva text,
  available_retreat boolean not null default true,  -- available for the full December 25-29 period
  arrival date,
  large_groups boolean not null default false
);
alter table public.demo_volunteer_seed enable row level security;
revoke all on public.demo_volunteer_seed from anon, authenticated;

-- Adds one demo event with role seva and fills it with demo volunteers who fit.
-- p_kind: 'completed' (hours logged), 'ended' (ended, hours not logged yet), 'upcoming'.
create or replace function public.demo_add_event(
  p_org uuid, p_centre uuid, p_title text, p_desc text, p_start timestamptz, p_hours numeric,
  p_mode public.participation_mode, p_kind text, p_tasks jsonb, p_fill numeric, p_reached integer default null,
  p_series uuid default null, p_visibility public.visibility default 'public'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c centres; v_event uuid; v_task uuid; x jsonb; v_n int; v_a uuid; r record; v_orgr uuid;
  v_end timestamptz := p_start + make_interval(secs => (p_hours * 3600)::int);
begin
  select * into c from centres where id = p_centre;
  select user_id into v_orgr from demo_accounts where persona = 'organizer';
  insert into events (org_id, title, description, starts_at, ends_at, mode, venue_name, address, city, latitude, longitude,
                      visibility, status, published_at, created_by, centre_id, people_reached, completed_at, series_id)
  values (p_org, p_title, p_desc, p_start, v_end, p_mode,
          case when p_mode = 'virtual' then null else c.name end,
          case when p_mode = 'virtual' then null else coalesce(c.city, '') end,
          coalesce(c.city, '') || case when c.province is not null then ', ' || c.province else '' end,
          c.latitude, c.longitude, p_visibility,
          case when p_kind = 'completed' then 'completed'::event_status else 'published'::event_status end,
          p_start - interval '21 days', v_orgr, p_centre,
          case when p_kind = 'completed' then p_reached end,
          case when p_kind = 'completed' then v_end end, p_series)
  returning id into v_event;
  insert into event_private_details (event_id, online_details, contact_info)
  values (v_event, case when p_mode <> 'onsite' then 'Video link is shared the day before.' end, 'Demo coordinator · 555-0100');

  for x in select * from jsonb_array_elements(p_tasks) loop
    insert into seva_tasks (event_id, title, description, category, type, positions, mode, status, created_by)
    values (v_event, x ->> 'title', coalesce(x ->> 'description', ''), x ->> 'category', 'role', (x ->> 'positions')::int,
            p_mode, case when p_kind = 'completed' then 'completed'::task_status else 'open'::task_status end, v_orgr)
    returning id into v_task;
    v_n := floor((x ->> 'positions')::int * coalesce((x ->> 'fill')::numeric, p_fill))::int;
    for r in
      select p.id, s.experienced from profiles p join demo_volunteer_seed s on s.user_id = p.id
      where p.is_demo and p.blocked_at is null
        and (p_kind <> 'upcoming' or p_start < '2026-12-24' or p_start > '2026-12-30' or s.available_retreat)
        and not exists (select 1 from assignments a join seva_tasks t on t.id = a.task_id where t.event_id = v_event and a.volunteer_id = p.id)
      order by ((x ->> 'category') = any (p.interests))::int * 3
             + (exists (select 1 from unnest(p.skills) k where k = any (area_skills(x ->> 'category'))))::int * 3
             + (p.region is not distinct from c.region)::int * 2
             + s.experienced::int,
             md5(p.id::text || v_task::text) desc
      limit v_n
    loop
      insert into assignments (task_id, volunteer_id, claimed_qty, status, joined_at, completed_at)
      values (v_task, r.id, 1, case when p_kind = 'completed' then 'completed'::assignment_status else 'active'::assignment_status end,
              least(now(), p_start - interval '10 days'), case when p_kind = 'completed' then v_end end)
      returning id into v_a;
      if p_kind = 'completed' then
        insert into event_hours (assignment_id, hours, logged_by, logged_at)
        values (v_a, round(p_hours * (0.75 + (abs(hashtext(v_a::text)) % 35) / 100.0), 1), v_orgr, v_end + interval '1 day');
      end if;
    end loop;
  end loop;
  perform refresh_task_counters(t.id) from seva_tasks t where t.event_id = v_event;
  return v_event;
end $$;
revoke execute on function public.demo_add_event(uuid, uuid, text, text, timestamptz, numeric, public.participation_mode, text, jsonb, numeric, integer, uuid, public.visibility)
  from public, anon, authenticated;

create or replace function public.seed_demo_network() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  c_tor constant uuid := 'd0000000-0000-4000-8000-00000000c001';
  c_mtl constant uuid := 'd0000000-0000-4000-8000-00000000c002';
  c_qc  constant uuid := 'd0000000-0000-4000-8000-00000000c003';
  c_ott constant uuid := 'd0000000-0000-4000-8000-00000000c004';
  c_van constant uuid := 'd0000000-0000-4000-8000-00000000c005';
  c_cal constant uuid := 'd0000000-0000-4000-8000-00000000c006';
  c_hal constant uuid := 'd0000000-0000-4000-8000-00000000c007';
  c_bos constant uuid := 'd0000000-0000-4000-8000-00000000c008';
  c_ret constant uuid := 'd0000000-0000-4000-8000-00000000c009';
  v_vol uuid; v_vol2 uuid; v_orgr uuid; v_series uuid := 'd0000000-0000-4000-8000-0000000005e1';
  d timestamptz := date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto';
  m int; v_e uuid; v_team uuid; v_centres uuid[]; v_c uuid;
  titles text[] := array['Satsang & Seva Evening', 'Happiness Program Seva', 'Community Meal Drive', 'Park Cleanup Day',
                         'Seniors Meditation Outreach', 'Youth Yoga Day', 'Guru Purnima Celebration', 'Navratri Celebration',
                         'Retreat Centre Weekend Seva', 'Winter Clothing Drive', 'Sri Sri Yoga Open House', 'Diwali Community Evening',
                         'Meditation in the Park', 'Fundraising Gala Seva', 'Volunteer Training Day', 'Earth Day Tree Planting'];
  cats text[][] := array[
    array['event_setup', 'food', 'design_media'], array['outreach', 'event_setup', 'food'], array['food', 'logistics', 'administration'],
    array['environment', 'logistics', 'design_media'], array['elder_care', 'meditation', 'logistics'], array['kids_youth', 'teaching', 'event_setup'],
    array['event_setup', 'food', 'technology'], array['event_setup', 'food', 'kids_youth'], array['food', 'logistics', 'environment'],
    array['logistics', 'outreach', 'administration'], array['meditation', 'outreach', 'event_setup'], array['event_setup', 'food', 'design_media'],
    array['meditation', 'outreach', 'logistics'], array['fundraising', 'event_setup', 'design_media'], array['teaching', 'administration', 'technology'],
    array['environment', 'logistics', 'outreach']];
  task_names jsonb := '{"event_setup":"Hall setup & hospitality","food":"Kitchen & prasad","design_media":"Photography & social media",
    "outreach":"Outreach & invitations","logistics":"Logistics & transport","administration":"Registration desk",
    "environment":"Grounds crew","elder_care":"Seniors home support","meditation":"Meditation session support",
    "kids_youth":"Kids activities","teaching":"Teacher assistance","technology":"Sound & livestream","fundraising":"Donor welcome"}';
  k int; v_tasks jsonb;
begin
  select user_id into v_vol from demo_accounts where persona = 'volunteer';
  select user_id into v_vol2 from demo_accounts where persona = 'volunteer2';
  select user_id into v_orgr from demo_accounts where persona = 'organizer';
  if v_orgr is null then return; end if;

  update organizations set name = 'Art of Living Canada (demo)',
    description = 'A sample network for trying out SevaSetu: centres across Canada and the US, a retreat centre, teams and 60 sample volunteers. Nothing here is real.'
  where id = v_org;

  -- Personas: Volunteer 360 fields
  update profiles set province = 'ON', country = 'CA', person_type = 'volunteer', languages = '{english,hindi}',
    skills = '{teaching,translation,customer_service}', skill_levels = '{"teaching":"intermediate","translation":"expert","customer_service":"intermediate"}',
    profession = 'High School Teacher', directory_opt_in = true
  where id = v_vol;
  update profiles set province = 'ON', country = 'CA', person_type = 'volunteer', languages = '{english,gujarati}',
    skills = '{driving,cooking}', skill_levels = '{"driving":"expert","cooking":"intermediate"}', profession = 'Logistics Coordinator',
    directory_opt_in = true
  where id = v_vol2;
  update profiles set province = 'ON', country = 'CA', person_type = 'full_time_teacher', languages = '{english,hindi,malayalam}',
    profession = 'Art of Living Teacher'
  where id = v_orgr;
  insert into demo_volunteer_seed (user_id, experienced) values (v_vol, true), (v_vol2, true)
  on conflict (user_id) do nothing;

  delete from teams where org_id = v_org;
  delete from centres where org_id = v_org;
  insert into centres (id, org_id, name, city, province, country, latitude, longitude) values
    (c_tor, v_org, 'Toronto Centre', 'Toronto', 'ON', 'CA', 43.6629, -79.3957),
    (c_mtl, v_org, 'Montréal Centre', 'Montréal', 'QC', 'CA', 45.5019, -73.5674),
    (c_qc,  v_org, 'Québec City Centre', 'Québec City', 'QC', 'CA', 46.8139, -71.2080),
    (c_ott, v_org, 'Ottawa Centre', 'Ottawa', 'ON', 'CA', 45.4215, -75.6972),
    (c_van, v_org, 'Vancouver Centre', 'Vancouver', 'BC', 'CA', 49.2827, -123.1207),
    (c_cal, v_org, 'Calgary Centre', 'Calgary', 'AB', 'CA', 51.0447, -114.0719),
    (c_hal, v_org, 'Halifax Centre', 'Halifax', 'NS', 'CA', 44.6488, -63.5752),
    (c_bos, v_org, 'Boston Centre', 'Boston', 'MA', 'US', 42.3601, -71.0589),
    (c_ret, v_org, 'Art of Living Retreat Centre', 'Saint-Sauveur', 'QC', 'CA', 45.8964, -74.1700);
  update events set centre_id = c_tor where org_id = v_org and centre_id is null;

  -- Partly staff the original Toronto events with sample volunteers (45-89% of each role)
  for v_team, v_c in
    select t.id, t.id from seva_tasks t join events e on e.id = t.event_id
    where e.org_id = v_org and t.type = 'role' and e.id::text like 'd0000000-0000-4000-8000-0000000000e%'
  loop
    insert into assignments (task_id, volunteer_id, claimed_qty, joined_at)
    select v_team, p.id, 1, now() - interval '2 days'
    from profiles p join demo_volunteer_seed s on s.user_id = p.id, seva_tasks t
    where t.id = v_team and p.is_demo and p.id not in (v_vol, v_vol2)
      and not exists (select 1 from assignments a join seva_tasks t2 on t2.id = a.task_id
                      where t2.event_id = t.event_id and a.volunteer_id = p.id)
    order by (t.category = any (p.interests))::int * 3 + (p.region = 'ontario')::int * 2, md5(p.id::text || v_team::text)
    limit (select floor(positions * (0.45 + (abs(hashtext(id::text)) % 45) / 100.0))::int from seva_tasks where id = v_team);
  end loop;
  v_centres := array[c_tor, c_mtl, c_ret, c_ott, c_qc, c_tor, c_mtl, c_bos, c_ret, c_hal, c_van, c_tor, c_cal, c_mtl, c_ott, c_tor];

  -- 8 months of completed seva, two events a month, growing over time
  for m in 0..15 loop
    k := m + 1;
    v_c := v_centres[k];
    v_tasks := jsonb_build_array(
      jsonb_build_object('title', task_names ->> cats[k][1], 'category', cats[k][1], 'positions', 3 + m / 2),
      jsonb_build_object('title', task_names ->> cats[k][2], 'category', cats[k][2], 'positions', 2 + m / 3),
      jsonb_build_object('title', task_names ->> cats[k][3], 'category', cats[k][3], 'positions', 1 + m / 4));
    perform demo_add_event(v_org, v_c, titles[k], 'Completed sample event.',
      d - make_interval(days => 236 - m * 15) + interval '10 hours', 3 + (m % 3) * 2,
      'onsite', 'completed', v_tasks, 0.9, 40 + m * 12 + (m % 4) * 25);
  end loop;

  -- The demo volunteers served at two past events
  update seva_tasks set positions = positions + 2 where id in (
    select t.id from (select e.* from events e where e.org_id = v_org and e.status = 'completed' order by e.starts_at desc limit 2) e
    join lateral (select * from seva_tasks t where t.event_id = e.id order by t.title limit 1) t on true);
  insert into assignments (task_id, volunteer_id, claimed_qty, status, joined_at, completed_at)
  select t.id, v.u, 1, 'completed', e.starts_at - interval '7 days', e.ends_at
  from (select e.* from events e where e.org_id = v_org and e.status = 'completed' order by e.starts_at desc limit 2) e
  join lateral (select * from seva_tasks t where t.event_id = e.id order by t.title limit 1) t on true
  cross join (values (v_vol), (v_vol2)) v(u)
  on conflict do nothing;
  insert into event_hours (assignment_id, hours, logged_by)
  select a.id, extract(epoch from (e.ends_at - e.starts_at)) / 3600, v_orgr
  from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
  where a.volunteer_id in (v_vol, v_vol2) and e.status = 'completed'
  on conflict (assignment_id) do nothing;

  -- Ended last week, hours still to log (shows the "log hours" alert)
  perform demo_add_event(v_org, c_ott, 'Ottawa Community Satsang', 'An evening of music and meditation.',
    d - interval '4 days' + interval '19 hours', 2, 'onsite', 'ended',
    '[{"title":"Hall setup & hospitality","category":"event_setup","positions":4},{"title":"Kitchen & prasad","category":"food","positions":3}]', 1);

  -- Upcoming across the network
  perform demo_add_event(v_org, c_ret, 'December 25–29 Retreat Seva',
    'Five days of full-time seva at the Art of Living Retreat Centre during the December visit. Arrive by 1:00 PM on December 25, stay until 3:00 PM on December 29.',
    '2026-12-25 13:00 America/Toronto'::timestamptz, 98, 'onsite', 'upcoming',
    '[{"title":"Kitchen","category":"food","positions":14,"description":"Cooking for 400+, vegetable prep, clean-up."},
      {"title":"Housekeeping","category":"logistics","positions":8,"description":"Rooms, laundry and common areas."},
      {"title":"Audio-video & livestream","category":"technology","positions":5,"description":"Sound, cameras and the webcast."},
      {"title":"Reception & guest care","category":"event_setup","positions":6},
      {"title":"Childcare","category":"kids_youth","positions":4,"description":"Vulnerable sector check may be required."},
      {"title":"Grounds & snow clearing","category":"environment","positions":4},
      {"title":"Shuttle drivers","category":"logistics","positions":3},
      {"title":"Office & registration","category":"administration","positions":3}]', 0.6);
  perform demo_add_event(v_org, c_van, 'Vancouver Meditation Workshop', 'A two-hour guided meditation for newcomers.',
    d + interval '8 days 14 hours', 2, 'onsite', 'upcoming',
    '[{"title":"Hall setup & hospitality","category":"event_setup","positions":6},{"title":"Registration desk","category":"administration","positions":3}]', 0.3);
  perform demo_add_event(v_org, c_mtl, 'Montréal Satsang', 'Satsang en français et en anglais.',
    d + interval '6 days 19 hours', 2, 'onsite', 'upcoming',
    '[{"title":"Hall setup & hospitality","category":"event_setup","positions":5},{"title":"Kitchen & prasad","category":"food","positions":4}]', 0.85);
  perform demo_add_event(v_org, c_cal, 'Calgary Community Welcome', 'Welcome evening for new volunteers and families.',
    d + interval '12 days 11 hours', 2, 'onsite', 'upcoming',
    '[{"title":"Hall setup & hospitality","category":"event_setup","positions":4},{"title":"Kids activities","category":"kids_youth","positions":3}]', 0.5);
  perform demo_add_event(v_org, c_bos, 'Volunteer Teacher Circle', 'Monthly circle for volunteer teachers. Join in person or online.',
    d + interval '10 days 10 hours 30 minutes', 1.5, 'hybrid', 'upcoming',
    '[{"title":"Sound & livestream","category":"technology","positions":2},{"title":"Teacher assistance","category":"teaching","positions":3}]', 0.67);
  perform demo_add_event(v_org, c_hal, 'Digital Seva Sprint', 'Help update the website, newsletters and data, from home.',
    d + interval '11 days 18 hours 30 minutes', 2, 'virtual', 'upcoming',
    '[{"title":"Sound & livestream","category":"technology","positions":4},{"title":"Data clean-up","category":"data","positions":3},{"title":"Photography & social media","category":"design_media","positions":2}]', 0.5);
  perform demo_add_event(v_org, c_ott, 'New Year Wellness Workshop', 'Start the year with breath, yoga and meditation.',
    '2027-01-09 10:00 America/Toronto'::timestamptz, 2, 'hybrid', 'upcoming',
    '[{"title":"Hall setup & hospitality","category":"event_setup","positions":5},{"title":"Outreach & invitations","category":"outreach","positions":4}]', 0.4);
  -- Weekly online follow-up, four weeks in a row
  for k in 0..3 loop
    perform demo_add_event(v_org, c_tor, 'Weekly Meditation Follow-up', 'Online follow-up for everyone who finished the Happiness Program.',
      d + make_interval(days => 5 + 7 * k) + interval '19 hours', 1, 'virtual', 'upcoming',
      '[{"title":"Host & tech support","category":"technology","positions":2},{"title":"Welcome & attendance","category":"administration","positions":2}]',
      case when k = 0 then 1 else 0.5 end, null, v_series);
  end loop;

  -- Teams
  insert into teams (id, org_id, centre_id, name, description, seva_area, target_size) values
    ('d0000000-0000-4000-8000-0000000007a1', v_org, c_ret, 'Kitchen Seva Team', 'Cooks and helpers for retreats and big events.', 'food', 12),
    ('d0000000-0000-4000-8000-0000000007a2', v_org, c_ret, 'Audio-Video & Tech', 'Sound, cameras, livestream and slides.', 'technology', 6),
    ('d0000000-0000-4000-8000-0000000007a3', v_org, c_mtl, 'Hospitality & Reception', 'Welcome guests, registration and guest care.', 'event_setup', 8),
    ('d0000000-0000-4000-8000-0000000007a4', v_org, c_tor, 'Childcare & Youth', 'Kids programs during courses and celebrations.', 'kids_youth', 6),
    ('d0000000-0000-4000-8000-0000000007a5', v_org, c_ret, 'Grounds & Maintenance', 'Trails, gardens, repairs and snow.', 'environment', 6),
    ('d0000000-0000-4000-8000-0000000007a6', v_org, c_tor, 'Outreach Team', 'Calls, flyers and social media for courses.', 'outreach', 8);
  for v_team in select id from teams where org_id = v_org loop
    insert into team_members (team_id, user_id, status, invited_by)
    select v_team, p.id, case when row_number() over (order by md5(p.id::text || v_team::text)) % 5 = 0 then 'invited' else 'active' end, v_orgr
    from profiles p join demo_volunteer_seed s on s.user_id = p.id, teams t
    where t.id = v_team and p.is_demo and p.id not in (v_vol, v_vol2)
      and (t.seva_area = any (p.interests) or exists (select 1 from unnest(p.skills) k2 where k2 = any (area_skills(t.seva_area))))
    order by md5(p.id::text || v_team::text)
    limit (select greatest(1, target_size - 2 - (abs(hashtext(v_team::text)) % 3)) from teams where id = v_team);
    update teams t set lead_id = (
      select m.user_id from team_members m join profiles p on p.id = m.user_id
      where m.team_id = t.id and m.status = 'active'
      order by (p.person_type <> 'volunteer')::int desc, (p.skill_levels ->> coalesce((area_skills(t.seva_area))[1], '')) = 'expert' desc, p.full_name
      limit 1)
    where t.id = v_team;
  end loop;
  -- The demo volunteers: Arjun is on the kitchen team, Priya has an invitation to the outreach team
  insert into team_members (team_id, user_id, status, invited_by) values
    ('d0000000-0000-4000-8000-0000000007a1', v_vol2, 'active', v_orgr),
    ('d0000000-0000-4000-8000-0000000007a6', v_vol, 'invited', v_orgr)
  on conflict do nothing;
  insert into notifications (user_id, type, title, body, data)
  values (v_vol, 'team_invite', 'Invitation to join Outreach Team', 'An organizer invited you to their team.',
          jsonb_build_object('team_id', 'd0000000-0000-4000-8000-0000000007a6'));
end $$;
revoke execute on function public.seed_demo_network() from public, anon, authenticated;

-- reset_demo_data = the original reset + the network seed
alter function public.reset_demo_data() rename to reset_demo_core;
revoke execute on function public.reset_demo_core() from public, anon, authenticated;
create function public.reset_demo_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform reset_demo_core();
  perform seed_demo_network();
end $$;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;

create or replace function public.admin_reset_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  perform reset_demo_data();
  perform log_admin_action('demo_reset', 'organization', 'd0000000-0000-4000-8000-0000000000a1', 'Art of Living Canada (demo)', null);
end $$;
