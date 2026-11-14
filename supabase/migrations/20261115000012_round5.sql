-- Round 5: completed courses (and seva that require one), volunteer search that includes unfinished profiles,
-- donation campaigns paid through each organization's own Stripe account, and richer demo content.

-- ===========================================================================
-- 1. Courses
-- ===========================================================================
alter table public.profiles add column if not exists courses text[] not null default '{}'
  check (courses <@ array['part1', 'part2', 'vtp', 'teachers', 'sri_sri_yoga', 'sky_teens', 'sanyam']::text[]);
alter table public.seva_tasks add column if not exists required_courses text[] not null default '{}'
  check (required_courses <@ array['part1', 'part2', 'vtp', 'teachers', 'sri_sri_yoga', 'sky_teens', 'sanyam']::text[]);
grant update (courses) on public.profiles to authenticated;
grant insert (required_courses), update (required_courses) on public.seva_tasks to authenticated;

create or replace function public.join_task(p_task uuid, p_qty integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t seva_tasks;
  e events;
  v_existing assignments;
  v_qty int;
  v_remaining int;
  v_assignment uuid;
begin
  perform assert_not_blocked();
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Lock the task row: concurrent joins serialize here, so capacity can't be oversold.
  select * into t from seva_tasks where id = p_task for update;
  if t.id is null or not can_view_task(p_task) then raise exception 'task_not_found'; end if;
  select * into e from events where id = t.event_id;

  if e.status <> 'published' then raise exception 'event_not_published'; end if;
  if t.status not in ('open', 'full') then raise exception 'task_not_open'; end if;
  if t.signup_deadline is not null and t.signup_deadline < now() then
    raise exception 'signup_closed';
  end if;
  if e.visibility = 'private' and not is_org_member(e.org_id) and not has_event_access(e.id) then
    raise exception 'invitation_required';
  end if;
  if cardinality(t.required_courses) > 0 and not is_org_member(e.org_id)
     and not exists (select 1 from profiles p where p.id = v_uid and p.courses && t.required_courses) then
    raise exception 'course_required';
  end if;

  select * into v_existing from assignments where task_id = p_task and volunteer_id = v_uid;
  if v_existing.id is not null and v_existing.status <> 'cancelled' then
    raise exception 'already_joined';
  end if;

  if t.type = 'role' then
    v_qty := 1;
  else
    v_qty := coalesce(p_qty, 1);
    if v_qty < 1 then raise exception 'invalid_quantity'; end if;
    if t.max_per_volunteer is not null and v_qty > t.max_per_volunteer then
      raise exception 'quantity_exceeds_max';
    end if;
  end if;

  v_remaining := task_remaining(t);
  if v_remaining = 0 then
    return jsonb_build_object('status', 'full');
  end if;
  if v_qty > v_remaining then
    return jsonb_build_object('status', 'capacity_changed', 'available', v_remaining);
  end if;

  if v_existing.id is not null then
    update assignments set status = 'active', claimed_qty = v_qty, joined_at = now(),
      cancelled_at = null, completed_at = null
    where id = v_existing.id returning id into v_assignment;
  else
    insert into assignments (task_id, volunteer_id, claimed_qty)
    values (p_task, v_uid, v_qty) returning id into v_assignment;
  end if;

  update task_invitations set status = 'accepted', responded_at = now()
   where task_id = p_task and invitee_id = v_uid and status = 'pending';
  update event_access set status = 'approved', responded_at = now()
   where event_id = e.id and user_id = v_uid and status = 'invited';

  perform notify(v_uid, 'joined', t.title,
    case when t.type = 'quantity' then v_qty || ' ' || t.unit || ' reserved for you' else 'Your position is confirmed' end,
    jsonb_build_object('task_id', p_task, 'assignment_id', v_assignment));

  return jsonb_build_object('status', 'joined', 'assignment_id', v_assignment, 'qty', v_qty);
end $$;

-- ===========================================================================
-- 2. Volunteer search: everyone with an account, unfinished profiles last; course filter
-- ===========================================================================
drop function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text);
create function public.find_volunteers(
  p_event uuid, p_task uuid default null, p_skills text[] default '{}',
  p_only_available boolean default false, p_only_near boolean default false, p_tz text default 'UTC',
  p_courses text[] default '{}'
)
returns table (id uuid, full_name text, city text, interests text[], skills text[], serve_mode public.serve_mode,
               availability jsonb, distance_km numeric, score integer, reasons text[], courses text[], onboarded boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  e events; o organizations; t seva_tasks;
  v_start timestamptz; v_end timestamptz; v_flexible boolean := false; v_mode public.participation_mode;
  v_cats text[]; v_skills text[]; v_courses text[];
  v_dow int; v_from_h numeric; v_to_h numeric; v_periods text[] := '{}';
begin
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  select * into o from organizations where id = e.org_id;
  if p_task is not null then
    select * into t from seva_tasks where id = p_task and event_id = p_event;
    if t.id is null then raise exception 'task_not_found'; end if;
  end if;
  v_mode := coalesce(t.mode, e.mode);
  v_flexible := t.id is not null and t.type = 'quantity' and t.starts_at is null;
  v_start := coalesce(t.starts_at, e.starts_at);
  v_end := coalesce(t.ends_at, e.ends_at);
  v_cats := case when t.id is not null then array_remove(array[t.category], null)
                 else array(select distinct category from seva_tasks where event_id = p_event and category is not null) end;
  v_skills := array(select lower(trim(s)) from unnest(coalesce(p_skills, '{}')) s where trim(s) <> '');
  v_courses := case when cardinality(coalesce(p_courses, '{}')) > 0 then p_courses
                    when t.id is not null then t.required_courses
                    else array(select distinct unnest(required_courses) from seva_tasks where event_id = p_event) end;

  -- weekday (0 = Monday) and the day periods the seva covers, in the organizer's time zone
  v_dow := extract(isodow from (v_start at time zone p_tz))::int - 1;
  v_from_h := extract(hour from (v_start at time zone p_tz)) + extract(minute from (v_start at time zone p_tz)) / 60.0;
  v_to_h := least(24, v_from_h + extract(epoch from (v_end - v_start)) / 3600.0);
  if v_from_h < 12 and v_to_h > 0 then v_periods := array_append(v_periods, 'morning'); end if;
  if v_from_h < 17 and v_to_h > 12 then v_periods := array_append(v_periods, 'afternoon'); end if;
  if v_to_h > 17 then v_periods := array_append(v_periods, 'evening'); end if;
  if cardinality(v_periods) = 0 then v_periods := array[case when v_from_h < 12 then 'morning' when v_from_h < 17 then 'afternoon' else 'evening' end]; end if;

  return query
  with cand as (
    select p.id, p.full_name, p.city, p.interests, p.skills, p.serve_mode, p.latitude, p.longitude, p.radius_km,
      p.courses, p.onboarded_at is not null as is_onboarded,
      coalesce((select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'period', s.period) order by s.weekday, s.period)
                from availability_slots s where s.user_id = p.id), '[]'::jsonb) as slots,
      case when e.latitude is not null and p.latitude is not null and p.longitude is not null
           then 6371 * acos(least(1, greatest(-1,
                cos(radians(e.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude - e.longitude))
                + sin(radians(e.latitude)) * sin(radians(p.latitude)))))
      end as dist
    from profiles p
    where p.id <> auth.uid() and p.blocked_at is null and p.is_demo = o.is_demo
      and not exists (select 1 from event_access x where x.event_id = p_event and x.user_id = p.id
                      and (x.status in ('requested', 'approved') or (x.status = 'invited' and x.expires_at > now())))
      and not exists (select 1 from assignments a join seva_tasks st on st.id = a.task_id
                      where a.volunteer_id = p.id and a.status <> 'cancelled'
                        and st.event_id = p_event and (p_task is null or st.id = p_task))
  ), scored as (
    select c.*,
      (cardinality(v_cats) > 0 and c.interests && v_cats) as m_interest,
      (cardinality(v_courses) > 0 and c.courses && v_courses) as m_course,
      (cardinality(v_skills) > 0 and exists (select 1 from unnest(c.skills) sk where lower(trim(sk)) = any (v_skills))) as m_skills,
      case when v_flexible then jsonb_array_length(c.slots) > 0
           else exists (select 1 from availability_slots s where s.user_id = c.id and s.weekday = v_dow and s.period::text = any (v_periods)) end as m_avail,
      case v_mode
        when 'virtual' then c.serve_mode <> 'onsite'
        when 'onsite' then c.serve_mode <> 'virtual' and c.dist is not null and c.dist <= c.radius_km
        else (c.serve_mode <> 'onsite') or (c.serve_mode <> 'virtual' and c.dist is not null and c.dist <= c.radius_km)
      end as m_near
    from cand c
  )
  select s.id, s.full_name, s.city, s.interests, s.skills, s.serve_mode, s.slots,
         round(s.dist::numeric, 1),
         (case when s.m_interest then 3 else 0 end + case when s.m_skills then 2 else 0 end + case when s.m_course then 2 else 0 end
          + case when s.m_avail then 2 else 0 end + case when s.m_near then 2 else 0 end),
         array_remove(array[
           case when s.m_interest then 'interest' end,
           case when s.m_skills then 'skills' end,
           case when s.m_course then 'course' end,
           case when s.m_avail then 'available' end,
           case when s.m_near then case when v_mode = 'virtual' or (v_mode = 'hybrid' and s.serve_mode <> 'onsite' and (s.dist is null or s.dist > s.radius_km)) then 'online' else 'near' end end
         ], null),
         s.courses, s.is_onboarded
  from scored s
  where (not p_only_available or s.m_avail) and (not p_only_near or s.m_near)
    and (cardinality(coalesce(p_courses, '{}')) = 0 or s.m_course)
  order by s.is_onboarded desc, 9 desc, s.dist asc nulls last, s.full_name
  limit 50;
end $$;

-- ===========================================================================
-- 3. Donations (Stripe Connect: every organization is paid into its own Stripe account)
-- ===========================================================================
create table public.org_payments (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.org_payments enable row level security;
create policy org_payments_select on public.org_payments for select to authenticated
  using (is_org_member(org_id) or is_platform_admin());
revoke all on public.org_payments from anon;
revoke insert, update, delete on public.org_payments from authenticated;

create function public.org_accepts_donations(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select charges_enabled from org_payments where org_id = p_org), false)
$$;
grant execute on function public.org_accepts_donations(uuid) to anon, authenticated;

create table public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  goal_cents integer check (goal_cents is null or goal_cents > 0),
  currency text not null default 'cad' check (currency = 'cad'),
  presets integer[] not null default '{2500,5000,10000,25000}',
  allow_monthly boolean not null default true,
  allow_cover_fees boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  raised_cents bigint not null default 0,
  donors_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index donation_campaigns_org_idx on public.donation_campaigns (org_id);
alter table public.donation_campaigns enable row level security;
create policy campaigns_select on public.donation_campaigns for select to anon, authenticated
  using (
    (status = 'active' and exists (select 1 from organizations o where o.id = org_id and o.status = 'approved' and o.is_demo = is_demo_user()))
    or can_manage_org(org_id) or is_platform_admin()
  );
create policy campaigns_insert on public.donation_campaigns for insert to authenticated with check (can_manage_org(org_id));
create policy campaigns_update on public.donation_campaigns for update to authenticated using (can_manage_org(org_id)) with check (can_manage_org(org_id));
create policy campaigns_delete on public.donation_campaigns for delete to authenticated using (can_manage_org(org_id) and raised_cents = 0);
revoke insert, update, delete on public.donation_campaigns from anon, authenticated;
grant insert (org_id, event_id, title, description, image_url, goal_cents, presets, allow_monthly, allow_cover_fees, status)
  on public.donation_campaigns to authenticated;
grant update (event_id, title, description, image_url, goal_cents, presets, allow_monthly, allow_cover_fees, status)
  on public.donation_campaigns to authenticated;
grant delete on public.donation_campaigns to authenticated;

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.donation_campaigns (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  donor_id uuid references public.profiles (id) on delete set null,
  donor_name text,
  donor_email text,
  amount_cents integer not null check (amount_cents > 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  currency text not null default 'cad',
  interval text not null default 'one_time' check (interval in ('one_time', 'month')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_subscription_id text,
  stripe_invoice_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index donations_campaign_idx on public.donations (campaign_id, created_at desc);
alter table public.donations enable row level security;
create policy donations_select on public.donations for select to authenticated
  using (donor_id = auth.uid() or can_manage_org(org_id) or is_platform_admin());
revoke all on public.donations from anon;
revoke insert, update, delete on public.donations from authenticated;

-- Campaign totals and "donation received" notifications follow the donations table (written by the Stripe webhook).
create function public.trg_donation_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_campaign uuid := coalesce(new.campaign_id, old.campaign_id); c donation_campaigns; m record;
begin
  update donation_campaigns set
    raised_cents = coalesce((select sum(amount_cents) from donations where campaign_id = v_campaign and status = 'paid'), 0),
    donors_count = (select count(distinct coalesce(lower(donor_email), id::text)) from donations where campaign_id = v_campaign and status = 'paid')
  where id = v_campaign;
  if tg_op <> 'DELETE' and new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select * into c from donation_campaigns where id = new.campaign_id;
    for m in select user_id from org_members where org_id = new.org_id loop
      perform notify(m.user_id, 'donation_received',
        'Donation received: $' || to_char(new.amount_cents / 100.0, 'FM999999990.00'),
        c.title || case when new.donor_name is not null then ' · ' || new.donor_name else '' end,
        jsonb_build_object('campaign_id', new.campaign_id));
    end loop;
  end if;
  return null;
end $$;
create trigger donations_totals after insert or update or delete on public.donations
  for each row execute function public.trg_donation_totals();

-- ===========================================================================
-- 4. Demo content
-- ===========================================================================
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_org constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  v_vol uuid; v_vol2 uuid; v_orgr uuid;
  v_a uuid;
  d timestamptz := date_trunc('day', now());
  lat constant double precision := 43.6629; lng constant double precision := -79.3957;
begin
  select user_id into v_vol from demo_accounts where persona = 'volunteer';
  select user_id into v_vol2 from demo_accounts where persona = 'volunteer2';
  select user_id into v_orgr from demo_accounts where persona = 'organizer';
  if v_vol is null or v_vol2 is null or v_orgr is null then raise exception 'demo_not_set_up'; end if;

  update auth.users u set encrypted_password = crypt(a.password, gen_salt('bf')), updated_at = now(), banned_until = null
  from demo_accounts a where a.user_id = u.id;

  update profiles set is_demo = true, blocked_at = null, blocked_reason = null, onboarded_at = coalesce(onboarded_at, now()),
    city = 'Toronto, ON', latitude = lat, longitude = lng, radius_km = 25, serve_mode = 'either'
  where id in (v_vol, v_vol2, v_orgr);
  update profiles set full_name = 'Priya Sharma (demo volunteer)', interests = '{food,teaching,outreach}', skills = '{teaching,translation}',
    hours_per_week = '3-5', courses = '{}' where id = v_vol;
  update profiles set full_name = 'Arjun Patel (demo volunteer)', interests = '{food,outreach,environment}', skills = '{driving}',
    hours_per_week = '1-2', courses = '{part1,part2}' where id = v_vol2;
  update profiles set full_name = 'Meera Nair (demo organizer)', interests = '{food,event_setup}', hours_per_week = '6+',
    courses = '{part1,part2,vtp,teachers}' where id = v_orgr;
  delete from availability_slots where user_id in (v_vol, v_vol2, v_orgr);
  insert into availability_slots (user_id, weekday, period)
  select v_vol, w, p::day_period from generate_series(0, 6) w, unnest(array['evening']) p
  union all select v_vol, w, 'morning'::day_period from generate_series(5, 6) w
  union all select v_vol2, w, p::day_period from generate_series(5, 6) w, unnest(array['morning', 'afternoon']) p;
  delete from notifications where user_id in (v_vol, v_vol2, v_orgr);

  delete from donation_campaigns where org_id = v_org;
  delete from events where org_id = v_org;
  insert into organizations (id, name, city, description, status, is_demo, created_by, reviewed_at, review_note)
  values (v_org, 'Demo Seva Centre', 'Toronto, ON',
          'A sample organization for trying out SevaSetu. Nothing here is real.', 'approved', true, v_orgr, now(), null)
  on conflict (id) do update set name = excluded.name, description = excluded.description, status = 'approved',
    is_demo = true, review_note = null;
  insert into org_members (org_id, user_id, role) values (v_org, v_orgr, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  insert into events (id, org_id, title, description, starts_at, ends_at, mode, venue_name, address, city,
                      latitude, longitude, visibility, status, published_at, created_by, template_id) values
    ('d0000000-0000-4000-8000-0000000000e1', v_org, 'Art of Living Course Part 1',
     'Weekend Happiness Program. Volunteers help with outreach, setup, meals and hosting the teacher.',
     d + interval '4 days 18 hours', d + interval '4 days 21 hours', 'onsite', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON',
     lat, lng, 'private', 'published', now(), v_orgr, '7e000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-0000000000e2', v_org, 'Satsang',
     'An evening of music and meditation. Help set up, serve prasad and take photos.',
     d + interval '2 days 19 hours', d + interval '2 days 21 hours', 'onsite', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON',
     lat, lng, 'public', 'published', now(), v_orgr, '7e000000-0000-4000-8000-000000000002'),
    ('d0000000-0000-4000-8000-0000000000e3', v_org, 'Neighborhood Cleanup: Riverside Park',
     'Spend a morning tidying the park together. Gloves and bags provided.',
     d + interval '6 days 9 hours', d + interval '6 days 12 hours', 'onsite', 'Riverside Park', '12 River Rd, Toronto, ON', 'Toronto, ON',
     43.6532, -79.3832, 'public', 'published', now(), v_orgr, '7e000000-0000-4000-8000-000000000003'),
    ('d0000000-0000-4000-8000-0000000000e4', v_org, 'Emergency Winter Supply Drive',
     'Collect and sort warm clothing for families arriving at local shelters.',
     d + interval '5 days 10 hours', d + interval '5 days 15 hours', 'hybrid', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON',
     lat, lng, 'public', 'published', now(), v_orgr, '7e000000-0000-4000-8000-000000000004'),
    ('d0000000-0000-4000-8000-0000000000e5', v_org, 'Community Meal Drive',
     'Cook, pack and hand out meals for neighbours in need.',
     d + interval '3 days 11 hours', d + interval '3 days 15 hours', 'onsite', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON',
     lat, lng, 'public', 'published', now(), v_orgr, '7e000000-0000-4000-8000-000000000005'),
    ('d0000000-0000-4000-8000-0000000000e6', v_org, '2026 Art of Living Canada Hackathon',
     'A weekend of building tech for good. Mentors, judges and helpers make it happen.',
     d + interval '12 days 9 hours', d + interval '13 days 17 hours', 'hybrid', 'Innovation Hub', '100 Queen St W, Toronto, ON', 'Toronto, ON',
     43.6525, -79.3839, 'public', 'published', now(), v_orgr, null),
    ('d0000000-0000-4000-8000-0000000000e7', v_org, 'Tree Planting Day',
     'Plant native trees along the creek with the city parks team.',
     d + interval '9 days 9 hours', d + interval '9 days 13 hours', 'onsite', 'Don Valley trailhead', '200 Pottery Rd, Toronto, ON', 'Toronto, ON',
     43.6880, -79.3600, 'public', 'published', now(), v_orgr, null),
    ('d0000000-0000-4000-8000-0000000000e8', v_org, 'Prison SMART & Seniors Meditation Outreach',
     'Support breathing and meditation sessions at a correctional centre and two seniors’ homes.',
     d + interval '8 days 10 hours', d + interval '8 days 13 hours', 'hybrid', 'Community Hall', '50 Maple Ave, Toronto, ON', 'Toronto, ON',
     lat, lng, 'public', 'published', now(), v_orgr, null);

  insert into seva_tasks (id, event_id, title, description, category, type, target_qty, unit, max_per_volunteer, max_volunteers,
                          minutes_per_unit, positions, starts_at, ends_at, signup_deadline, mode, status, created_by, required_courses) values
    -- Course Part 1 (private)
    ('d0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-0000000000e1', 'Outreach Seva', 'Call people who showed interest and invite them to the course.', 'outreach', 'quantity', 40, 'calls', 10, 4, 10, null, null, null, d + interval '3 days', 'virtual', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000102', 'd0000000-0000-4000-8000-0000000000e1', 'Venue Setup Seva', 'Set up mats, chairs and the sound system.', 'event_setup', 'role', null, null, null, null, null, 3, d + interval '4 days 17 hours', d + interval '4 days 18 hours', null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000103', 'd0000000-0000-4000-8000-0000000000e1', 'Meal Prep Seva', 'Prepare light snacks and tea for participants.', 'food', 'role', null, null, null, null, null, 2, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000104', 'd0000000-0000-4000-8000-0000000000e1', 'Teacher Hospitality Seva', 'Host the visiting teacher: pickup, meals and comfort.', 'event_setup', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{part1}'),
    ('d0000000-0000-4000-8000-000000000105', 'd0000000-0000-4000-8000-0000000000e1', 'Wrap-up Seva', 'Pack up and leave the hall as we found it.', 'event_setup', 'role', null, null, null, null, null, 2, d + interval '4 days 21 hours', d + interval '4 days 22 hours', null, 'onsite', 'open', v_orgr, '{}'),
    -- Satsang
    ('d0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-0000000000e2', 'Venue Setup', 'Arrange the hall, flowers and the stage.', 'event_setup', 'role', null, null, null, null, null, 3, d + interval '2 days 18 hours', d + interval '2 days 19 hours', null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-0000000000e2', 'Food Prep', 'Prepare and serve prasad after satsang.', 'food', 'role', null, null, null, null, null, 2, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-0000000000e2', 'Photography Seva', 'Capture the evening for the community newsletter.', 'design_media', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    -- Cleanup
    ('d0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-0000000000e3', 'Volunteer Coordinator', 'Welcome volunteers and assign zones.', 'administration', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-0000000000e3', 'Procurement & Supplies', 'Pick up gloves, bags and water beforehand.', 'administration', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-0000000000e3', 'Cleanups', 'Walk a zone of the park and collect litter.', 'environment', 'role', null, null, null, null, null, 12, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-0000000000e3', 'Photography Seva', 'Before and after photos for the city.', 'design_media', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    -- Emergency supply
    ('d0000000-0000-4000-8000-000000000401', 'd0000000-0000-4000-8000-0000000000e4', 'Volunteer Coordinator', 'Coordinate drop-offs and sorting tables.', 'administration', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000402', 'd0000000-0000-4000-8000-0000000000e4', 'Collection of winter clothing', 'Collect coats, toques and gloves from neighbours and sort them by size.', 'food', 'quantity', 200, 'items', 40, null, 2, null, null, null, d + interval '5 days', 'hybrid', 'open', v_orgr, '{}'),
    -- Meal drive
    ('d0000000-0000-4000-8000-000000000501', 'd0000000-0000-4000-8000-0000000000e5', 'Volunteer Coordinator', 'Keep the kitchen and delivery teams in sync.', 'administration', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000502', 'd0000000-0000-4000-8000-0000000000e5', 'Donate Food', 'Cook or buy meals and bring them to the hall.', 'food', 'quantity', 120, 'meals', 20, null, 5, null, null, null, d + interval '3 days', 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000503', 'd0000000-0000-4000-8000-0000000000e5', 'Meal packing', 'Pack meals into boxes and label them.', 'food', 'role', null, null, null, null, null, 6, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    -- Hackathon
    ('d0000000-0000-4000-8000-000000000601', 'd0000000-0000-4000-8000-0000000000e6', 'Mentors', 'Guide teams on product, design or code for a few hours.', 'technology', 'role', null, null, null, null, null, 8, null, null, null, 'hybrid', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000602', 'd0000000-0000-4000-8000-0000000000e6', 'Judges', 'Review final demos and score them.', 'technology', 'role', null, null, null, null, null, 3, d + interval '13 days 14 hours', d + interval '13 days 17 hours', null, 'hybrid', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000603', 'd0000000-0000-4000-8000-0000000000e6', 'Event logistics', 'Registration desk, food and room setup.', 'event_setup', 'role', null, null, null, null, null, 4, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000604', 'd0000000-0000-4000-8000-0000000000e6', 'Outreach to universities', 'Email and call student clubs to invite participants.', 'outreach', 'quantity', 50, 'contacts', 10, null, 10, null, null, null, d + interval '10 days', 'virtual', 'open', v_orgr, '{}'),
    -- Tree planting
    ('d0000000-0000-4000-8000-000000000701', 'd0000000-0000-4000-8000-0000000000e7', 'Planting crew', 'Dig, plant and mulch saplings with the parks team.', 'environment', 'role', null, null, null, null, null, 15, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000702', 'd0000000-0000-4000-8000-0000000000e7', 'Water & tools station', 'Hand out tools, water and gloves; keep the station tidy.', 'environment', 'role', null, null, null, null, null, 3, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000703', 'd0000000-0000-4000-8000-0000000000e7', 'Photography Seva', 'Photos for the parks team and our newsletter.', 'design_media', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    -- Prison SMART & seniors
    ('d0000000-0000-4000-8000-000000000801', 'd0000000-0000-4000-8000-0000000000e8', 'Program coordinator', 'Coordinate with the centre and the seniors’ homes; brief volunteers.', 'elder_care', 'role', null, null, null, null, null, 1, null, null, null, 'onsite', 'open', v_orgr, '{part1,part2}'),
    ('d0000000-0000-4000-8000-000000000802', 'd0000000-0000-4000-8000-0000000000e8', 'Drivers', 'Drive the teacher and supplies between sites.', 'elder_care', 'role', null, null, null, null, null, 3, null, null, null, 'onsite', 'open', v_orgr, '{}'),
    ('d0000000-0000-4000-8000-000000000803', 'd0000000-0000-4000-8000-0000000000e8', 'Calling seniors’ homes', 'Call activity coordinators to confirm session times.', 'elder_care', 'quantity', 30, 'calls', 10, null, 10, null, null, null, d + interval '7 days', 'virtual', 'open', v_orgr, '{}');

  -- Arjun has joined a few seva: one report waiting for review, one approved.
  insert into assignments (task_id, volunteer_id, claimed_qty) values ('d0000000-0000-4000-8000-000000000502', v_vol2, 12) returning id into v_a;
  insert into progress_reports (assignment_id, reported_qty, note, status) values (v_a, 8, 'Cooked 8 meals so far.', 'pending');
  insert into assignments (task_id, volunteer_id, claimed_qty) values ('d0000000-0000-4000-8000-000000000604', v_vol2, 10) returning id into v_a;
  insert into progress_reports (assignment_id, reported_qty, note, status, verified_qty, reviewed_by, reviewed_at)
  values (v_a, 6, 'Reached 6 student clubs.', 'approved', 6, v_orgr, now());
  insert into assignments (task_id, volunteer_id, claimed_qty) values ('d0000000-0000-4000-8000-000000000201', v_vol2, 1);

  -- Priya asked to join the private course
  insert into event_access (event_id, user_id, status, note)
  values ('d0000000-0000-4000-8000-0000000000e1', v_vol, 'requested', 'Hi, I would love to help with outreach.');
  insert into notifications (user_id, type, title, body, data)
  values (v_orgr, 'event_request', 'Request to join Art of Living Course Part 1', 'Priya Sharma (demo volunteer) would like to join.',
          jsonb_build_object('event_id', 'd0000000-0000-4000-8000-0000000000e1', 'user_id', v_vol));

  -- A campaign to show the Give page (payments stay off for the demo organization)
  insert into donation_campaigns (org_id, event_id, title, description, goal_cents, status, created_by)
  values (v_org, 'd0000000-0000-4000-8000-0000000000e6', 'Support the 2026 Hackathon',
          'Help cover venue, food and prizes for students building tech for good.', 500000, 'active', v_orgr);
end $$;


revoke execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text, text[]) from public, anon;
grant execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text, text[]) to authenticated;
