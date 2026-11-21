-- Merge phase 1 (SevaConnect + SEVAKS ideas on SevaSetu's data):
-- Volunteer 360 profile fields, skill levels, private accessibility needs, centres and regions,
-- teams, an explainable weighted match score, a consent-based volunteer directory,
-- organization insights (dashboard, impact, data health, alerts), weekly repeating events
-- and "people reached" on completed events.

-- ===========================================================================
-- 1. Regions
-- ===========================================================================
-- Province / state code -> region key. Regions group the map for coverage views.
create function public.region_for(p_province text, p_country text) returns text
language sql immutable as $$
  select case
    when upper(coalesce(p_country, 'CA')) = 'US' then 'usa'
    when upper(coalesce(p_country, 'CA')) <> 'CA' then 'international'
    else case upper(coalesce(p_province, ''))
      when 'ON' then 'ontario'
      when 'QC' then 'quebec'
      when 'BC' then 'bc'
      when 'AB' then 'prairies' when 'SK' then 'prairies' when 'MB' then 'prairies'
      when 'NS' then 'atlantic' when 'NB' then 'atlantic' when 'PE' then 'atlantic' when 'NL' then 'atlantic'
      when 'YT' then 'north' when 'NT' then 'north' when 'NU' then 'north'
      else null end
  end
$$;

-- ===========================================================================
-- 2. Volunteer 360 profile fields
-- ===========================================================================
create function public.valid_skill_levels(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_each_text(p) x where x.value not in ('beginner', 'intermediate', 'expert'))
$$;

create sequence if not exists public.volunteer_no_seq start 1;

alter table public.profiles
  add column if not exists person_type text not null default 'volunteer'
    check (person_type in ('volunteer', 'volunteer_teacher', 'full_time_teacher')),
  add column if not exists volunteer_no bigint not null default nextval('public.volunteer_no_seq'),
  add column if not exists country text not null default 'CA' check (country ~ '^[A-Z]{2}$'),
  add column if not exists province text check (province is null or char_length(province) <= 40),
  add column if not exists languages text[] not null default '{}' check (cardinality(languages) <= 12),
  add column if not exists skill_levels jsonb not null default '{}' check (public.valid_skill_levels(skill_levels)),
  add column if not exists profession text check (profession is null or char_length(profession) <= 80),
  add column if not exists linkedin_url text
    check (linkedin_url is null or linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/[^\s]{1,200}$'),
  add column if not exists linkedin_consent boolean not null default false,
  add column if not exists directory_opt_in boolean not null default false;
alter table public.profiles add column if not exists region text
  generated always as (public.region_for(province, country)) stored;
create unique index if not exists profiles_volunteer_no_idx on public.profiles (volunteer_no);

-- Fill the province of existing profiles from their "City, ON" text.
update public.profiles
   set province = upper(substring(city from ',\s*([A-Za-z]{2})\s*$'))
 where province is null and city ~ ',\s*[A-Za-z]{2}\s*$';

grant update (person_type, country, province, languages, skill_levels, profession, linkedin_url, linkedin_consent,
  directory_opt_in) on public.profiles to authenticated;

-- VOL-CA-000018 / TCH-CA-000007
create function public.volunteer_code(p_type text, p_country text, p_no bigint) returns text
language sql immutable as $$
  select case when p_type = 'volunteer' then 'VOL' else 'TCH' end || '-' || coalesce(p_country, 'CA') || '-' || lpad(p_no::text, 6, '0')
$$;

-- Accessibility needs: only the person, platform admins, and organizers of a seva the person joined.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  accessibility_needs text check (accessibility_needs is null or char_length(accessibility_needs) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
create policy profile_private_select on public.profile_private for select to authenticated
  using (
    user_id = auth.uid() or is_platform_admin() or exists (
      select 1 from assignments a where a.volunteer_id = user_id and a.status <> 'cancelled'
        and can_manage_org(task_org(a.task_id)))
  );
create policy profile_private_own on public.profile_private for insert to authenticated with check (user_id = auth.uid());
create policy profile_private_update on public.profile_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_private_delete on public.profile_private for delete to authenticated using (user_id = auth.uid());
revoke all on public.profile_private from anon;
revoke insert, update, delete on public.profile_private from authenticated;
grant insert (user_id, accessibility_needs), update (accessibility_needs), delete on public.profile_private to authenticated;
create trigger profile_private_touch before update on public.profile_private
  for each row execute function public.touch_updated_at();

-- Active = joined or served a seva in the last 90 days.
create function public.last_active_at(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(greatest(a.joined_at, coalesce(a.completed_at, a.joined_at)))
  from assignments a where a.volunteer_id = p_user and a.status <> 'cancelled'
$$;
revoke execute on function public.last_active_at(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 3. Centres, people reached, repeating events
-- ===========================================================================
create table public.centres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  city text,
  province text check (province is null or char_length(province) <= 40),
  country text not null default 'CA' check (country ~ '^[A-Z]{2}$'),
  region text generated always as (public.region_for(province, country)) stored,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index centres_org_idx on public.centres (org_id);
alter table public.centres enable row level security;
create policy centres_select on public.centres for select to anon, authenticated
  using (exists (select 1 from organizations o where o.id = org_id and (
    (o.status = 'approved' and (not o.is_demo or is_demo_user())) or is_org_member(o.id) or is_platform_admin())));
create policy centres_write on public.centres for all to authenticated
  using (can_manage_org(org_id)) with check (can_manage_org(org_id));
revoke all on public.centres from anon;
revoke insert, update, delete on public.centres from authenticated;
grant insert (org_id, name, city, province, country, latitude, longitude),
  update (name, city, province, country, latitude, longitude), delete on public.centres to authenticated;

alter table public.events
  add column if not exists centre_id uuid references public.centres (id) on delete set null,
  add column if not exists people_reached integer check (people_reached is null or people_reached between 0 and 1000000),
  add column if not exists series_id uuid;
create index if not exists events_centre_idx on public.events (centre_id);
grant insert (centre_id) on public.events to authenticated;
grant update (centre_id, people_reached) on public.events to authenticated;

-- A centre must belong to the event's organization.
create function public.trg_event_centre_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.centre_id is not null and not exists (select 1 from centres c where c.id = new.centre_id and c.org_id = new.org_id) then
    raise exception 'invalid_centre';
  end if;
  return new;
end $$;
create trigger events_centre_check before insert or update of centre_id on public.events
  for each row execute function public.trg_event_centre_check();

-- Copy an event (with its seva and private details) every week until p_until. Returns how many were made.
create function public.repeat_event_weekly(p_event uuid, p_until date, p_tz text default 'UTC') returns integer
language plpgsql security definer set search_path = public as $$
declare
  e events; v_series uuid; v_new uuid; k int := 1; n int := 0; v_shift interval;
begin
  perform assert_not_blocked();
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  if e.status not in ('draft', 'published') then raise exception 'invalid_status_change'; end if;
  if p_until is null or p_until > (e.starts_at at time zone p_tz)::date + 182 then raise exception 'repeat_too_long'; end if;
  v_series := coalesce(e.series_id, e.id);
  update events set series_id = v_series where id = e.id;
  loop
    v_shift := make_interval(days => 7 * k);
    exit when ((e.starts_at + v_shift) at time zone p_tz)::date > p_until;
    insert into events (org_id, title, description, starts_at, ends_at, mode, venue_name, address, city, latitude, longitude,
                        visibility, status, created_by, published_at, template_id, centre_id, series_id)
    values (e.org_id, e.title, e.description, e.starts_at + v_shift, e.ends_at + v_shift, e.mode, e.venue_name, e.address, e.city,
            e.latitude, e.longitude, e.visibility, e.status, auth.uid(), case when e.status = 'published' then now() end,
            e.template_id, e.centre_id, v_series)
    returning id into v_new;
    insert into event_private_details (event_id, online_details, contact_info)
      select v_new, online_details, contact_info from event_private_details where event_id = e.id;
    insert into seva_tasks (event_id, title, description, instructions, steps, category, type, target_qty, unit,
                            max_per_volunteer, max_volunteers, minutes_per_unit, positions, starts_at, ends_at, signup_deadline,
                            mode, visibility, status, created_by, required_courses)
      select v_new, title, description, instructions, steps, category, type, target_qty, unit,
             max_per_volunteer, max_volunteers, minutes_per_unit, positions, starts_at + v_shift, ends_at + v_shift,
             signup_deadline + v_shift, mode, visibility,
             case when e.status = 'published' then 'open'::task_status else 'draft'::task_status end, auth.uid(), required_courses
      from seva_tasks where event_id = e.id and status <> 'closed';
    n := n + 1;
    k := k + 1;
    exit when k > 27;
  end loop;
  return n;
end $$;
revoke execute on function public.repeat_event_weekly(uuid, date, text) from public, anon;
grant execute on function public.repeat_event_weekly(uuid, date, text) to authenticated;

-- ===========================================================================
-- 4. Teams
-- ===========================================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  centre_id uuid references public.centres (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  seva_area text,
  target_size integer not null default 8 check (target_size between 1 and 200),
  lead_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index teams_org_idx on public.teams (org_id);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create function public.team_org(p_team uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from teams where id = p_team
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
create policy teams_select on public.teams for select to authenticated
  using (can_manage_org(org_id) or is_platform_admin()
         or exists (select 1 from team_members m where m.team_id = teams.id and m.user_id = auth.uid()));
create policy teams_insert on public.teams for insert to authenticated with check (can_manage_org(org_id));
create policy teams_update on public.teams for update to authenticated using (can_manage_org(org_id)) with check (can_manage_org(org_id));
create policy teams_delete on public.teams for delete to authenticated using (can_manage_org(org_id));
create policy team_members_select on public.team_members for select to authenticated
  using (user_id = auth.uid() or can_manage_org(team_org(team_id)) or is_platform_admin());
revoke all on public.teams, public.team_members from anon;
revoke insert, update, delete on public.teams, public.team_members from authenticated;
grant insert (org_id, centre_id, name, description, seva_area, target_size),
  update (centre_id, name, description, seva_area, target_size, lead_id), delete on public.teams to authenticated;

-- The lead must be an active member; the centre must belong to the organization.
create function public.trg_team_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from team_members m where m.team_id = new.id and m.user_id = new.lead_id and m.status = 'active') then
    raise exception 'lead_not_member';
  end if;
  if new.centre_id is not null and not exists (select 1 from centres c where c.id = new.centre_id and c.org_id = new.org_id) then
    raise exception 'invalid_centre';
  end if;
  return new;
end $$;
create trigger teams_check before insert or update on public.teams
  for each row execute function public.trg_team_check();

-- ===========================================================================
-- 5. Volunteer directory (consent based)
-- ===========================================================================
-- A person is in an organization's directory when they served with it, are on one of its teams,
-- were approved for one of its private events, or switched on "Coordinators can find me".
create function public.in_org_directory(p_org uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join organizations o on o.id = p_org
    where p.id = p_user and p.blocked_at is null and p.is_demo = o.is_demo and (
      p.directory_opt_in
      or exists (select 1 from assignments a where a.volunteer_id = p.id and a.status <> 'cancelled' and task_org(a.task_id) = p_org)
      or exists (select 1 from team_members m join teams t on t.id = m.team_id where m.user_id = p.id and t.org_id = p_org)
      or exists (select 1 from event_access x join events e on e.id = x.event_id
                 where x.user_id = p.id and x.status = 'approved' and e.org_id = p_org)
      or exists (select 1 from org_members m where m.user_id = p.id and m.org_id = p_org)
    )
  )
$$;
revoke execute on function public.in_org_directory(uuid, uuid) from public, anon, authenticated;

create or replace function public.org_directory(p_org uuid, p_user uuid default null)
returns table (id uuid, full_name text, email text, code text, person_type text, city text, province text, country text,
               region text, interests text[], skills text[], skill_levels jsonb, languages text[], courses text[],
               profession text, linkedin_url text, serve_mode public.serve_mode, served_with_org boolean, opted_in boolean,
               is_active boolean, last_active timestamptz, hours numeric, events_count integer, onboarded boolean,
               availability jsonb, history jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (can_manage_org(p_org) or is_platform_admin()) then raise exception 'not_authorized'; end if;
  return query
  with ppl as (
    select p.* from profiles p
    where (p_user is null or p.id = p_user) and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and in_org_directory(p_org, p.id)
      and not exists (select 1 from org_members m where m.user_id = p.id and m.org_id = p_org)
  ), act as (
    select a.volunteer_id, a.id as aid, t.event_id, task_org(a.task_id) as org
    from assignments a join seva_tasks t on t.id = a.task_id
    where a.status <> 'cancelled' and a.volunteer_id in (select ppl.id from ppl)
  )
  select p.id, p.full_name,
    case when can_see_profile(p.id) then p.email end,
    volunteer_code(p.person_type, p.country, p.volunteer_no),
    p.person_type, p.city, p.province, p.country, p.region, p.interests, p.skills, p.skill_levels, p.languages, p.courses,
    p.profession, case when p.linkedin_consent then p.linkedin_url end, p.serve_mode,
    exists (select 1 from act where act.volunteer_id = p.id and act.org = p_org),
    p.directory_opt_in,
    coalesce(last_active_at(p.id) > now() - interval '90 days', false),
    last_active_at(p.id),
    round(coalesce((select sum(effective_hours(act.aid)) from act where act.volunteer_id = p.id), 0)::numeric, 1),
    (select count(distinct act.event_id)::int from act where act.volunteer_id = p.id),
    p.onboarded_at is not null,
    coalesce((select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'period', s.period) order by s.weekday, s.period)
              from availability_slots s where s.user_id = p.id), '[]'::jsonb),
    case when p_user is not null then coalesce((
      select jsonb_agg(h order by h ->> 'starts_at' desc) from (
        select jsonb_build_object('task', t.title, 'event', e.title, 'event_id', e.id, 'starts_at', coalesce(t.starts_at, e.starts_at),
                                  'status', a.status, 'hours', round(effective_hours(a.id), 1)) h
        from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
        where a.volunteer_id = p.id and a.status <> 'cancelled' and e.org_id = p_org
        order by coalesce(t.starts_at, e.starts_at) desc limit 20) x), '[]'::jsonb)
    end
  from ppl p
  order by p.onboarded_at is null, p.full_name
  limit 1000;
end $$;
revoke execute on function public.org_directory(uuid, uuid) from public, anon;
grant execute on function public.org_directory(uuid, uuid) to authenticated;

-- Organizers can open the full profile of their active team members too.
create or replace function public.can_see_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or is_platform_admin() or exists (
    select 1 from assignments a where a.volunteer_id = p_user and can_manage_org(task_org(a.task_id))
  ) or exists (
    select 1 from task_invitations i where i.invitee_id = p_user and i.status = 'accepted' and can_manage_org(task_org(i.task_id))
  ) or exists (
    select 1 from event_access x where x.user_id = p_user and x.status in ('requested', 'approved') and can_manage_org(event_org(x.event_id))
  ) or exists (
    select 1 from org_members m1 join org_members m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = p_user
  ) or exists (
    select 1 from team_members m join teams t on t.id = m.team_id
    where m.user_id = p_user and m.status = 'active' and can_manage_org(t.org_id)
  )
$$;

-- ===========================================================================
-- 6. Explainable match score (SEVAKS weights)
--    skills 40 · seva area 25 · availability 20 · location 10 · experience 5 (+3 with LinkedIn and consent), max 100
-- ===========================================================================
create function public.area_skills(p_area text) returns text[]
language sql immutable as $$
  select case p_area
    when 'food' then array['kitchen', 'cooking', 'food_safety']
    when 'technology' then array['av_tech', 'it_support', 'web', 'livestream']
    when 'design_media' then array['photography', 'graphic_design', 'marketing', 'social_media', 'video']
    when 'administration' then array['office', 'data_entry', 'project_management', 'event_coordination', 'accounting']
    when 'event_setup' then array['hospitality', 'reception', 'event_coordination', 'customer_service', 'housekeeping']
    when 'logistics' then array['driving', 'construction', 'procurement', 'housekeeping']
    when 'environment' then array['grounds', 'gardening', 'construction']
    when 'kids_youth' then array['childcare', 'teaching']
    when 'elder_care' then array['first_aid', 'nurse', 'driving', 'doctor']
    when 'meditation' then array['wellness', 'teaching', 'facilitation']
    when 'teaching' then array['teaching', 'facilitation', 'childcare']
    when 'translation' then array['translation']
    when 'fundraising' then array['fundraising', 'retail', 'sales', 'marketing']
    when 'outreach' then array['customer_service', 'marketing', 'sales', 'social_media']
    when 'data' then array['data_analytics', 'data_entry', 'it_support']
    when 'professional' then array['accounting', 'legal', 'project_management', 'hr']
    else '{}'::text[] end
$$;

create function public.match_breakdown(
  p_user uuid, p_event uuid, p_task uuid default null, p_skills text[] default '{}', p_tz text default 'UTC'
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles; e events; t seva_tasks; v_region text;
  v_start timestamptz; v_end timestamptz; v_flexible boolean; v_mode public.participation_mode;
  v_cats text[]; v_target text[]; v_courses text[]; v_mine text[];
  v_dow int; v_from_h numeric; v_to_h numeric; v_periods text[] := '{}';
  s_skills numeric := 0; s_area int := 0; s_avail int := 0; s_loc int := 0; s_exp int := 0; s_li int := 0;
  m_skills boolean := false; m_interest boolean := false; m_course boolean := false; m_avail boolean := false; m_near boolean := false;
  v_dist double precision; v_w numeric; v_done int;
begin
  select * into p from profiles where id = p_user;
  select * into e from events where id = p_event;
  if p.id is null or e.id is null then return null; end if;
  if p_task is not null then select * into t from seva_tasks where id = p_task and event_id = p_event; end if;
  select region into v_region from centres where id = e.centre_id;

  v_mode := coalesce(t.mode, e.mode);
  v_flexible := t.id is not null and t.type = 'quantity' and t.starts_at is null;
  v_start := coalesce(t.starts_at, e.starts_at);
  v_end := coalesce(t.ends_at, e.ends_at);
  v_cats := case when t.id is not null then array_remove(array[t.category], null)
                 else array(select distinct category from seva_tasks where event_id = p_event and category is not null) end;
  v_courses := case when t.id is not null then t.required_courses
                    else array(select distinct unnest(required_courses) from seva_tasks where event_id = p_event) end;
  v_target := array(select distinct lower(trim(s)) from unnest(coalesce(p_skills, '{}')) s where trim(s) <> '')
              || array(select distinct unnest(area_skills(c)) from unnest(v_cats) c);
  v_mine := array(select lower(trim(s)) from unnest(p.skills) s);

  -- skills (40): best level among matching skills; neutral when the seva names no skills
  if cardinality(v_target) = 0 then
    s_skills := 20;
  else
    select max(case p.skill_levels ->> s when 'expert' then 1.0 when 'intermediate' then 0.8 when 'beginner' then 0.55 else 0.7 end),
           count(*)
      into v_w, v_done
      from unnest(v_mine) s where s = any (v_target);
    if v_w is not null then
      m_skills := true;
      s_skills := 40 * least(1.0, v_w + case when v_done >= 2 then 0.1 else 0 end);
    end if;
  end if;

  -- seva area (25)
  if cardinality(v_cats) = 0 then s_area := 12;
  elsif p.interests && v_cats then s_area := 25; m_interest := true;
  end if;

  -- availability (20)
  v_dow := extract(isodow from (v_start at time zone p_tz))::int - 1;
  v_from_h := extract(hour from (v_start at time zone p_tz)) + extract(minute from (v_start at time zone p_tz)) / 60.0;
  v_to_h := least(24, v_from_h + extract(epoch from (v_end - v_start)) / 3600.0);
  if v_from_h < 12 and v_to_h > 0 then v_periods := array_append(v_periods, 'morning'); end if;
  if v_from_h < 17 and v_to_h > 12 then v_periods := array_append(v_periods, 'afternoon'); end if;
  if v_to_h > 17 then v_periods := array_append(v_periods, 'evening'); end if;
  if cardinality(v_periods) = 0 then v_periods := array[case when v_from_h < 12 then 'morning' when v_from_h < 17 then 'afternoon' else 'evening' end]; end if;
  -- events longer than a day (retreats) count every day of the week they cover
  if v_end - v_start > interval '20 hours' then
    m_avail := exists (select 1 from availability_slots s where s.user_id = p.id);
  elsif v_flexible then
    m_avail := exists (select 1 from availability_slots s where s.user_id = p.id);
  else
    m_avail := exists (select 1 from availability_slots s where s.user_id = p.id and s.weekday = v_dow and s.period::text = any (v_periods));
  end if;
  if m_avail then s_avail := 20; end if;

  -- location (10)
  if e.latitude is not null and p.latitude is not null and p.longitude is not null then
    v_dist := 6371 * acos(least(1, greatest(-1,
      cos(radians(e.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude - e.longitude))
      + sin(radians(e.latitude)) * sin(radians(p.latitude)))));
  end if;
  m_near := case v_mode
    when 'virtual' then p.serve_mode <> 'onsite'
    when 'onsite' then p.serve_mode <> 'virtual' and v_dist is not null and v_dist <= p.radius_km
    else (p.serve_mode <> 'onsite') or (p.serve_mode <> 'virtual' and v_dist is not null and v_dist <= p.radius_km)
  end;
  if m_near then s_loc := 10;
  elsif v_region is not null and p.region = v_region and p.serve_mode <> 'virtual' then s_loc := 5;
  end if;

  -- experience (5): completed seva, plus a required course
  select count(*)::int into v_done from assignments a where a.volunteer_id = p.id and a.status = 'completed';
  m_course := cardinality(v_courses) > 0 and p.courses && v_courses;
  s_exp := least(5, v_done + case when m_course then 2 else 0 end + case when p.person_type <> 'volunteer' then 1 else 0 end);

  if p.linkedin_consent and p.linkedin_url is not null then s_li := 3; end if;

  return jsonb_build_object(
    'score', least(100, round(s_skills)::int + s_area + s_avail + s_loc + s_exp + s_li),
    'skills', round(s_skills)::int, 'area', s_area, 'availability', s_avail, 'location', s_loc,
    'experience', s_exp, 'linkedin', s_li,
    'distance_km', round(v_dist::numeric, 1),
    'reasons', to_jsonb(array_remove(array[
      case when m_interest then 'interest' end,
      case when m_skills then 'skills' end,
      case when m_course then 'course' end,
      case when m_avail then 'available' end,
      case when m_near then case when v_mode = 'virtual' or (v_mode = 'hybrid' and p.serve_mode <> 'onsite'
                                     and (v_dist is null or v_dist > p.radius_km)) then 'online' else 'near' end end
    ], null)));
end $$;
revoke execute on function public.match_breakdown(uuid, uuid, uuid, text[], text) from public, anon, authenticated;

drop function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text, text[]);
create function public.find_volunteers(
  p_event uuid, p_task uuid default null, p_skills text[] default '{}',
  p_only_available boolean default false, p_only_near boolean default false, p_tz text default 'UTC',
  p_courses text[] default '{}'
)
returns table (id uuid, full_name text, city text, interests text[], skills text[], serve_mode public.serve_mode,
               availability jsonb, distance_km numeric, score integer, reasons text[], courses text[], onboarded boolean,
               person_type text, region text, languages text[], breakdown jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare e events; o organizations;
begin
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  select * into o from organizations where id = e.org_id;
  if p_task is not null and not exists (select 1 from seva_tasks where id = p_task and event_id = p_event) then
    raise exception 'task_not_found';
  end if;

  return query
  with cand as (
    select p.*, match_breakdown(p.id, p_event, p_task, p_skills, p_tz) as b
    from profiles p
    where p.id <> auth.uid() and p.blocked_at is null and p.is_demo = o.is_demo
      and not exists (select 1 from event_access x where x.event_id = p_event and x.user_id = p.id
                      and (x.status in ('requested', 'approved') or (x.status = 'invited' and x.expires_at > now())))
      and not exists (select 1 from assignments a join seva_tasks st on st.id = a.task_id
                      where a.volunteer_id = p.id and a.status <> 'cancelled'
                        and st.event_id = p_event and (p_task is null or st.id = p_task))
  )
  select c.id, c.full_name, c.city, c.interests, c.skills, c.serve_mode,
         coalesce((select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'period', s.period) order by s.weekday, s.period)
                   from availability_slots s where s.user_id = c.id), '[]'::jsonb),
         (c.b ->> 'distance_km')::numeric,
         (c.b ->> 'score')::int,
         array(select jsonb_array_elements_text(c.b -> 'reasons')),
         c.courses, c.onboarded_at is not null, c.person_type, c.region, c.languages, c.b - 'reasons' - 'distance_km'
  from cand c
  where (not p_only_available or (c.b -> 'reasons') ? 'available')
    and (not p_only_near or (c.b -> 'reasons') ?| array['near', 'online'])
    and (cardinality(coalesce(p_courses, '{}')) = 0 or c.courses && p_courses)
  order by c.onboarded_at is not null desc, (c.b ->> 'score')::int desc, (c.b ->> 'distance_km')::numeric asc nulls last, c.full_name
  limit 50;
end $$;
revoke execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text, text[]) from public, anon;
grant execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text, text[]) to authenticated;

-- The signed-in volunteer's own match with seva they can see (Discover badges, profile insight).
create function public.my_match_scores(p_tasks uuid[], p_tz text default 'UTC')
returns table (task_id uuid, score integer, breakdown jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query
    select t.id, (b ->> 'score')::int, b
    from seva_tasks t, lateral (select match_breakdown(auth.uid(), t.event_id, t.id, '{}', p_tz) as b) x
    where t.id = any (p_tasks[1:200]) and can_view_task(t.id);
end $$;
revoke execute on function public.my_match_scores(uuid[], text) from public, anon;
grant execute on function public.my_match_scores(uuid[], text) to authenticated;

-- How many open seva match the signed-in volunteer well (score >= 70).
create function public.my_open_matches(p_tz text default 'UTC') returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from seva_tasks t join events e on e.id = t.event_id
  where auth.uid() is not null and t.status = 'open' and e.status = 'published' and e.ends_at > now()
    and can_view_task(t.id)
    and not exists (select 1 from assignments a where a.task_id = t.id and a.volunteer_id = auth.uid() and a.status <> 'cancelled')
    and (match_breakdown(auth.uid(), e.id, t.id, '{}', p_tz) ->> 'score')::int >= 70
$$;
revoke execute on function public.my_open_matches(text) from public, anon;
grant execute on function public.my_open_matches(text) to authenticated;

-- Volunteer 360 numbers for yourself: hours, events, code, active status.
create function public.my_summary()
returns table (code text, hours numeric, events_count integer, is_active boolean, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select volunteer_code(p.person_type, p.country, p.volunteer_no),
         round(coalesce((select sum(effective_hours(a.id)) from assignments a where a.volunteer_id = p.id), 0)::numeric, 1),
         (select count(distinct t.event_id)::int from assignments a join seva_tasks t on t.id = a.task_id
          where a.volunteer_id = p.id and a.status <> 'cancelled'),
         coalesce(last_active_at(p.id) > now() - interval '90 days', false),
         p.created_at
  from profiles p where p.id = auth.uid()
$$;
revoke execute on function public.my_summary() from public, anon;
grant execute on function public.my_summary() to authenticated;

-- ===========================================================================
-- 7. Teams: invitations, suggestions, listing
-- ===========================================================================
create function public.invite_to_team(p_team uuid, p_users uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare tm teams; u uuid; n int := 0;
begin
  perform assert_not_blocked();
  select * into tm from teams where id = p_team;
  if tm.id is null or not can_manage_org(tm.org_id) then raise exception 'not_authorized'; end if;
  foreach u in array coalesce(p_users, '{}') loop
    if not in_org_directory(tm.org_id, u) then raise exception 'not_in_directory'; end if;
    insert into team_members (team_id, user_id, status, invited_by) values (p_team, u, 'invited', auth.uid())
    on conflict (team_id, user_id) do nothing;
    if found then
      n := n + 1;
      perform notify(u, 'team_invite', 'Invitation to join ' || tm.name, 'An organizer invited you to their team.',
        jsonb_build_object('team_id', p_team));
    end if;
  end loop;
  return n;
end $$;

create function public.respond_team_invite(p_team uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare tm teams;
begin
  perform assert_not_blocked();
  select * into tm from teams where id = p_team;
  if not exists (select 1 from team_members where team_id = p_team and user_id = auth.uid() and status = 'invited') then
    raise exception 'invitation_not_found';
  end if;
  if p_accept then
    update team_members set status = 'active' where team_id = p_team and user_id = auth.uid();
    insert into notifications (user_id, type, title, body, data)
      select m.user_id, 'team_joined', (select full_name from profiles where id = auth.uid()) || ' joined ' || tm.name, '',
             jsonb_build_object('team_id', p_team)
      from org_members m where m.org_id = tm.org_id;
  else
    delete from team_members where team_id = p_team and user_id = auth.uid();
  end if;
end $$;

-- Organizers remove anyone; members can leave.
create function public.remove_team_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_user = auth.uid() or can_manage_org(team_org(p_team))) then raise exception 'not_authorized'; end if;
  update teams set lead_id = null where id = p_team and lead_id = p_user;
  delete from team_members where team_id = p_team and user_id = p_user;
end $$;

create function public.org_teams(p_org uuid)
returns table (id uuid, name text, description text, seva_area text, target_size integer, centre_id uuid, centre_name text,
               region text, lead_id uuid, lead_name text, members jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (can_manage_org(p_org) or is_platform_admin()) then raise exception 'not_authorized'; end if;
  return query
    select t.id, t.name, t.description, t.seva_area, t.target_size, t.centre_id, c.name, c.region, t.lead_id, lp.full_name,
      coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'full_name', p.full_name, 'status', m.status, 'person_type', p.person_type,
          'interests', p.interests, 'skills', p.skills, 'skill_levels', p.skill_levels, 'region', p.region, 'languages', p.languages)
          order by m.status, p.full_name)
        from team_members m join profiles p on p.id = m.user_id where m.team_id = t.id), '[]'::jsonb)
    from teams t left join centres c on c.id = t.centre_id left join profiles lp on lp.id = t.lead_id
    where t.org_id = p_org
    order by t.name;
end $$;

-- Who would fit the team: directory people not on it, by seva area, skills, region and availability.
create function public.team_suggestions(p_team uuid)
returns table (id uuid, full_name text, person_type text, region text, city text, score integer, reasons text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare tm teams; v_region text; v_skills text[];
begin
  select * into tm from teams where id = p_team;
  if tm.id is null or not can_manage_org(tm.org_id) then raise exception 'not_authorized'; end if;
  select region into v_region from centres where id = tm.centre_id;
  v_skills := area_skills(tm.seva_area);
  return query
    with c as (
      select p.*,
        (tm.seva_area is not null and tm.seva_area = any (p.interests)) as m_area,
        exists (select 1 from unnest(p.skills) s where lower(s) = any (v_skills)) as m_skill,
        (v_region is not null and p.region = v_region) as m_region,
        exists (select 1 from availability_slots s where s.user_id = p.id) as m_avail,
        p.person_type <> 'volunteer' as m_teacher
      from profiles p
      where in_org_directory(tm.org_id, p.id)
        and not exists (select 1 from team_members m where m.team_id = p_team and m.user_id = p.id)
    )
    select c.id, c.full_name, c.person_type, c.region, c.city,
      (case when c.m_area then 40 else 0 end + case when c.m_skill then 30 else 0 end
       + case when c.m_region then 15 else 0 end + case when c.m_avail then 10 else 0 end + case when c.m_teacher then 5 else 0 end),
      array_remove(array[case when c.m_area then 'interest' end, case when c.m_skill then 'skills' end,
                         case when c.m_region then 'near' end, case when c.m_avail then 'available' end,
                         case when c.m_teacher then 'teacher' end], null)
    from c
    where c.m_area or c.m_skill
    order by 6 desc, c.full_name
    limit 12;
end $$;

-- Teams the signed-in volunteer belongs to or was invited to.
create function public.my_teams()
returns table (id uuid, name text, org_name text, seva_area text, status text, lead_name text, members_count integer)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, o.name, t.seva_area, m.status, lp.full_name,
         (select count(*)::int from team_members x where x.team_id = t.id and x.status = 'active')
  from team_members m join teams t on t.id = m.team_id join organizations o on o.id = t.org_id
  left join profiles lp on lp.id = t.lead_id
  where m.user_id = auth.uid()
  order by m.status desc, t.name
$$;

revoke execute on function public.invite_to_team(uuid, uuid[]) from public, anon;
revoke execute on function public.respond_team_invite(uuid, boolean) from public, anon;
revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
revoke execute on function public.org_teams(uuid) from public, anon;
revoke execute on function public.team_suggestions(uuid) from public, anon;
revoke execute on function public.my_teams() from public, anon;
grant execute on function public.invite_to_team(uuid, uuid[]) to authenticated;
grant execute on function public.respond_team_invite(uuid, boolean) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.org_teams(uuid) to authenticated;
grant execute on function public.team_suggestions(uuid) to authenticated;
grant execute on function public.my_teams() to authenticated;
revoke execute on function public.team_org(uuid) from public, anon;
grant execute on function public.team_org(uuid) to authenticated;

-- ===========================================================================
-- 8. Organization insights: dashboard, impact, regions, data health, alerts
--    p_org null = whole platform (admins only, real data only).
-- ===========================================================================
create or replace function public.org_insights(p_org uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_orgs uuid[]; v_demo boolean := false; v jsonb;
  m0 timestamptz := date_trunc('month', now());
begin
  if p_org is null then
    perform assert_platform_admin();
    v_orgs := array(select id from organizations where not is_demo);
  else
    if not (can_manage_org(p_org) or is_platform_admin()) then raise exception 'not_authorized'; end if;
    select is_demo into v_demo from organizations where id = p_org;
    v_orgs := array[p_org];
  end if;

  with
  ev as (
    select e.*, c.name as centre_name,
           coalesce(c.region, region_for(upper(substring(e.city from ',\s*([A-Za-z]{2})\s*$')), 'CA')) as ev_region
    from events e left join centres c on c.id = e.centre_id
    where e.org_id = any (v_orgs) and e.status <> 'cancelled'
  ),
  tk as (select t.*, ev.ev_region, ev.starts_at as ev_start, ev.ends_at as ev_end, ev.status as ev_status
         from seva_tasks t join ev on ev.id = t.event_id),
  asg as (
    select a.*, tk.category, tk.event_id, tk.ev_end, tk.ev_status, tk.ev_region, effective_hours(a.id) as h
    from assignments a join tk on tk.id = a.task_id where a.status <> 'cancelled'
  ),
  vols as (
    select p.* from profiles p
    where p.blocked_at is null and p.is_demo = v_demo
      and (p_org is null or in_org_directory(p_org, p.id))
      and not exists (select 1 from org_members m where m.user_id = p.id and m.org_id = any (v_orgs))
  ),
  act90 as (select distinct volunteer_id from asg where greatest(joined_at, coalesce(completed_at, joined_at)) > now() - interval '90 days'),
  act180 as (select distinct volunteer_id from asg where greatest(joined_at, coalesce(completed_at, joined_at))
             between now() - interval '180 days' and now() - interval '90 days'),
  upcoming as (select * from ev where status = 'published' and ends_at >= now()),
  months as (select generate_series(m0 - interval '7 months', m0, interval '1 month') as m),
  reg as (
    select r from (
      select region as r from vols union select ev_region from upcoming union select c.region from centres c where c.org_id = any (v_orgs)
    ) x where r is not null
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'volunteers', (select count(*) from vols),
      'active_volunteers', (select count(*) from act90),
      'active_prev', (select count(*) from act180),
      'teachers', (select count(*) from vols where person_type <> 'volunteer'),
      'upcoming_events', (select count(*) from upcoming),
      'new_events_month', (select count(*) from upcoming where created_at >= m0),
      'hours_total', round(coalesce((select sum(h) from asg), 0)::numeric, 1),
      'hours_month', round(coalesce((select sum(h) from asg where ev_end >= m0 and ev_end < now()), 0)::numeric, 1),
      'hours_prev_month', round(coalesce((select sum(h) from asg where ev_end >= m0 - interval '1 month' and ev_end < m0), 0)::numeric, 1),
      'people_reached', coalesce((select sum(people_reached) from ev where status = 'completed'), 0),
      'completed_events', (select count(*) from ev where status = 'completed'),
      'active_regions', (select count(distinct ev_region) from ev where ev_region is not null and ends_at > now() - interval '90 days'),
      'retention', case when (select count(*) from act180) = 0 then null
                        else round(100.0 * (select count(*) from act180 where volunteer_id in (select volunteer_id from act90))
                                   / (select count(*) from act180)) end,
      'teacher_coverage', case when (select count(*) from upcoming) = 0 then null
                               else round(100.0 * (select count(*) from upcoming u where exists (
                                   select 1 from asg a join profiles p on p.id = a.volunteer_id
                                   where a.event_id = u.id and p.person_type <> 'volunteer'))
                                 / (select count(*) from upcoming)) end
    ),
    'monthly_hours', (select jsonb_agg(jsonb_build_object('month', to_char(months.m, 'YYYY-MM'),
                        'hours', round(coalesce((select sum(h) from asg where ev_end >= months.m and ev_end < months.m + interval '1 month' and ev_end < now()), 0)::numeric, 1))
                        order by months.m) from months),
    'hours_by_area', coalesce((select jsonb_agg(jsonb_build_object('area', area, 'hours', hrs) order by hrs desc)
                       from (select coalesce(category, 'other') as area, round(sum(h)::numeric, 1) as hrs from asg group by 1 having sum(h) > 0) x), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(jsonb_build_object(
          'region', reg.r,
          'volunteers', (select count(*) from vols where region = reg.r),
          'active', (select count(*) from vols where region = reg.r and id in (select volunteer_id from act90)),
          'teachers', (select count(*) from vols where region = reg.r and person_type <> 'volunteer'),
          'teacher_names', (select coalesce(jsonb_agg(full_name order by full_name), '[]'::jsonb)
                            from (select full_name from vols where region = reg.r and person_type <> 'volunteer' order by full_name limit 3) z),
          'centres', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from centres c where c.org_id = any (v_orgs) and c.region = reg.r),
          'upcoming_events', (select count(*) from upcoming where ev_region = reg.r),
          'positions', (select coalesce(sum(positions), 0) from tk where ev_region = reg.r and type = 'role' and ev_status = 'published' and ev_end >= now()),
          'filled', (select coalesce(sum(least(volunteers_count, positions)), 0) from tk where ev_region = reg.r and type = 'role' and ev_status = 'published' and ev_end >= now()),
          'hours', round(coalesce((select sum(h) from asg where ev_region = reg.r), 0)::numeric, 1)
        ) order by reg.r) from reg), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(x order by x ->> 'starts_at') from (
        select jsonb_build_object('id', u.id, 'title', u.title, 'starts_at', u.starts_at, 'ends_at', u.ends_at, 'mode', u.mode,
          'city', u.city, 'centre', u.centre_name, 'region', u.ev_region, 'visibility', u.visibility,
          'positions', (select coalesce(sum(positions), 0) from tk where event_id = u.id and type = 'role'),
          'filled', (select coalesce(sum(least(volunteers_count, positions)), 0) from tk where event_id = u.id and type = 'role'),
          'volunteers', (select count(distinct volunteer_id) from asg where event_id = u.id)) x
        from upcoming u order by u.starts_at limit 8) y), '[]'::jsonb),
    'data_health', jsonb_build_object(
      'total', (select count(*) from vols),
      'profiles', (select count(*) from vols where onboarded_at is not null),
      'skills', (select count(*) from vols where cardinality(skills) > 0),
      'languages', (select count(*) from vols where cardinality(languages) > 0),
      'availability', (select count(*) from vols v where exists (select 1 from availability_slots s where s.user_id = v.id)),
      'location', (select count(*) from vols where latitude is not null and province is not null),
      'courses', (select count(*) from vols where cardinality(courses) > 0),
      'hours_logged', (select count(*) from asg a join ev on ev.id = a.event_id where ev.status = 'completed'
                       and exists (select 1 from event_hours eh where eh.assignment_id = a.id)),
      'hours_expected', (select count(*) from asg a join ev on ev.id = a.event_id where ev.status = 'completed')
    ),
    'alerts', coalesce((select jsonb_agg(al order by (al ->> 'rank')::int, al ->> 'at') from (
        -- understaffed in the next 14 days
        select jsonb_build_object('kind', 'understaffed', 'severity', 'high', 'rank', 1, 'event_id', u.id, 'title', u.title,
                                  'at', u.starts_at, 'missing', s.pos - s.fil) al
        from upcoming u, lateral (select coalesce(sum(positions), 0) pos, coalesce(sum(least(volunteers_count, positions)), 0) fil
                                  from tk where event_id = u.id and type = 'role') s
        where u.starts_at < now() + interval '10 days' and s.pos > 0 and s.fil < s.pos * 0.6
        union all
        -- almost full
        select jsonb_build_object('kind', 'almost_full', 'severity', 'low', 'rank', 3, 'event_id', u.id, 'title', u.title,
                                  'at', u.starts_at, 'percent', round(100.0 * s.fil / s.pos))
        from upcoming u, lateral (select coalesce(sum(positions), 0) pos, coalesce(sum(least(volunteers_count, positions)), 0) fil
                                  from tk where event_id = u.id and type = 'role') s
        where s.pos > 0 and s.fil >= s.pos * 0.75 and s.fil < s.pos
        union all
        -- ended but hours not logged yet
        select jsonb_build_object('kind', 'log_hours', 'severity', 'medium', 'rank', 2, 'event_id', e.id, 'title', e.title, 'at', e.ends_at)
        from ev e where e.status = 'published' and e.ends_at < now()
          and exists (select 1 from asg a where a.event_id = e.id)
        union all
        select jsonb_build_object('kind', 'missing_availability', 'severity', 'medium', 'rank', 2, 'at', now(),
                                  'count', (select count(*) from vols v where not exists (select 1 from availability_slots s where s.user_id = v.id)))
        where exists (select 1 from vols v where not exists (select 1 from availability_slots s where s.user_id = v.id))
        union all
        select jsonb_build_object('kind', 'pending_reviews', 'severity', 'medium', 'rank', 2, 'at', now(),
                                  'count', (select count(*) from progress_reports r join asg a on a.id = r.assignment_id where r.status = 'pending'))
        where exists (select 1 from progress_reports r join asg a on a.id = r.assignment_id where r.status = 'pending')
      ) q), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke execute on function public.org_insights(uuid) from public, anon;
grant execute on function public.org_insights(uuid) to authenticated;

-- ===========================================================================
-- 9. Deleting an account also removes private data (cascade covers profile_private / team_members).
-- ===========================================================================
