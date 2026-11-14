-- Demo mode: walled-off demo accounts (volunteer, second volunteer, organizer) and a demo organization,
-- so the super admin can switch to a volunteer's or organizer's view for testing and live demos.
-- Demo data is invisible to real users, demo accounts can't touch real data, and demo numbers stay out of the
-- admin overview. Admins can reset the demo content with one click.

alter table public.profiles add column if not exists is_demo boolean not null default false;
alter table public.organizations add column if not exists is_demo boolean not null default false;

create function public.is_demo_user(p_user uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_demo from profiles where id = coalesce(p_user, auth.uid())), false)
$$;

-- Demo logins. No client access at all; admins read it through admin_demo_accounts().
create table public.demo_accounts (
  persona text primary key check (persona in ('volunteer', 'volunteer2', 'organizer')),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  password text not null
);
alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Walls
-- ---------------------------------------------------------------------------
-- Demo viewers see only demo seva; real viewers never see demo seva. Admins and members see everything of theirs.
create or replace function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from seva_tasks t join events e on e.id = t.event_id join organizations o on o.id = e.org_id
    where t.id = p_task and (
      is_org_member(e.org_id)
      or is_platform_admin()
      or (
        o.status = 'approved'
        and o.is_demo = is_demo_user()
        and e.status in ('published', 'completed') and t.status <> 'draft'
        and (
          (e.visibility = 'public' and t.visibility = 'public')
          or has_task_access(t.id)
        )
      )
    )
  )
$$;

create or replace function public.can_view_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join organizations o on o.id = e.org_id
    where e.id = p_event and (
      is_org_member(e.org_id)
      or is_platform_admin()
      or (o.status = 'approved' and o.is_demo = is_demo_user() and e.status in ('published', 'completed') and (
        e.visibility = 'public'
        or exists (select 1 from seva_tasks t where t.event_id = e.id and has_task_access(t.id))
      ))
    )
  )
$$;

drop policy organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to anon, authenticated
  using (
    (status = 'approved' and (not is_demo or is_demo_user()))
    or is_org_member(id) or is_platform_admin()
  );

-- Defence in depth: demo and real data never mix, whatever the client asks for.
create function public.trg_demo_wall_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_demo_user(new.volunteer_id) is distinct from coalesce((
    select o.is_demo from seva_tasks t join events e on e.id = t.event_id join organizations o on o.id = e.org_id
    where t.id = new.task_id), false) then
    raise exception 'demo_only';
  end if;
  return new;
end $$;
create trigger assignments_demo_wall before insert on public.assignments
  for each row execute function public.trg_demo_wall_assignment();

create function public.trg_demo_wall_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_demo_user(new.invitee_id) is distinct from coalesce((
    select o.is_demo from seva_tasks t join events e on e.id = t.event_id join organizations o on o.id = e.org_id
    where t.id = new.task_id), false) then
    raise exception 'demo_only';
  end if;
  return new;
end $$;
create trigger invitations_demo_wall before insert on public.task_invitations
  for each row execute function public.trg_demo_wall_invitation();

create function public.trg_demo_wall_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_demo and is_demo_user() then raise exception 'demo_only'; end if;
  return new;
end $$;
create trigger organizations_demo_wall before insert on public.organizations
  for each row execute function public.trg_demo_wall_org();

-- Organizers of a demo org find only demo volunteers (and the reverse).
create or replace function public.search_volunteers(p_org uuid, p_query text)
returns table (id uuid, full_name text, email text, city text)
language plpgsql stable security definer set search_path = public as $$
declare v_demo boolean;
begin
  if not can_manage_org(p_org) then raise exception 'not_authorized'; end if;
  if char_length(trim(p_query)) < 2 then return; end if;
  select is_demo into v_demo from organizations where id = p_org;
  return query
    select p.id, p.full_name,
      case when lower(p.email) = lower(trim(p_query)) then p.email
           else regexp_replace(p.email, '^(.).*(@.*)$', '\1•••\2') end,
      p.city
    from profiles p
    where p.is_demo = v_demo
      and (lower(p.email) = lower(trim(p_query)) or p.full_name ilike '%' || trim(p_query) || '%')
    order by p.full_name
    limit 20;
end $$;

-- Demo accounts can't delete themselves (the demo would break).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if is_demo_user() then raise exception 'demo_only'; end if;
  if exists (
    select 1 from org_members m
    where m.user_id = v_uid and m.role = 'owner'
      and not exists (select 1 from org_members o where o.org_id = m.org_id and o.role = 'owner' and o.user_id <> v_uid)
  ) then
    raise exception 'sole_org_owner';
  end if;
  delete from auth.users where id = v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- Admin console: demo people and orgs stay out of the numbers
-- ---------------------------------------------------------------------------
drop function public.admin_list_users(text);
create function public.admin_list_users(p_query text default null)
returns table (
  id uuid, email text, full_name text, city text, created_at timestamptz, last_sign_in_at timestamptz,
  providers text[], is_platform_admin boolean, blocked_at timestamptz, blocked_reason text,
  onboarded boolean, org_count integer, assignment_count integer, is_demo boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform assert_platform_admin();
  return query
    select p.id, p.email, p.full_name, p.city, p.created_at, u.last_sign_in_at,
      coalesce(array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')), '{}'),
      p.is_platform_admin, p.blocked_at, p.blocked_reason, p.onboarded_at is not null,
      (select count(*)::int from public.org_members m where m.user_id = p.id),
      (select count(*)::int from public.assignments a where a.volunteer_id = p.id and a.status <> 'cancelled'),
      p.is_demo
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(trim(p_query), '') = ''
       or p.full_name ilike '%' || trim(p_query) || '%'
       or p.email ilike '%' || trim(p_query) || '%'
    order by p.is_demo, p.created_at desc
    limit 500;
end $$;
revoke execute on function public.admin_list_users(text) from public, anon;
grant execute on function public.admin_list_users(text) to authenticated;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform assert_platform_admin();
  select jsonb_build_object(
    'users', (select count(*) from profiles where not is_demo),
    'users_7d', (select count(*) from profiles where not is_demo and created_at > now() - interval '7 days'),
    'blocked', (select count(*) from profiles where blocked_at is not null),
    'admins', (select count(*) from profiles where is_platform_admin),
    'orgs', (select coalesce(jsonb_object_agg(status, n), '{}')
             from (select status, count(*) n from organizations where not is_demo group by status) s),
    'events_live', (select count(*) from events e join organizations o on o.id = e.org_id
                    where not o.is_demo and e.status = 'published' and e.ends_at >= now()),
    'active_volunteers', (select count(distinct a.volunteer_id) from assignments a join profiles p on p.id = a.volunteer_id
                          where a.status = 'active' and not p.is_demo),
    'verified_hours', round((
      coalesce((select sum(extract(epoch from (coalesce(t.ends_at, e.ends_at) - coalesce(t.starts_at, e.starts_at))) / 3600)
        from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
        join organizations o on o.id = e.org_id
        where a.status = 'completed' and t.type = 'role' and not o.is_demo), 0)
      + coalesce((select sum(r.verified_qty * coalesce(t.minutes_per_unit, 0)) / 60.0
        from progress_reports r join assignments a on a.id = r.assignment_id join seva_tasks t on t.id = a.task_id
        join events e on e.id = t.event_id join organizations o on o.id = e.org_id
        where r.status = 'approved' and not o.is_demo), 0))::numeric, 1)
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Demo content
-- ---------------------------------------------------------------------------
-- Rebuilds the demo organization, events, joins and a pending report from scratch and resets demo logins.
-- No auth check: not callable by clients. Run by scripts/demo-setup.mjs and by admin_reset_demo().
create function public.reset_demo_data() returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_org constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  v_vol uuid; v_vol2 uuid; v_orgr uuid;
  v_a1 uuid; v_a2 uuid; v_a3 uuid;
  d timestamptz := date_trunc('day', now());
begin
  select user_id into v_vol from demo_accounts where persona = 'volunteer';
  select user_id into v_vol2 from demo_accounts where persona = 'volunteer2';
  select user_id into v_orgr from demo_accounts where persona = 'organizer';
  if v_vol is null or v_vol2 is null or v_orgr is null then raise exception 'demo_not_set_up'; end if;

  -- logins back to their saved passwords
  update auth.users u set encrypted_password = crypt(a.password, gen_salt('bf')), updated_at = now(),
    banned_until = null
  from demo_accounts a where a.user_id = u.id;

  -- profiles
  update profiles set is_demo = true, blocked_at = null, blocked_reason = null, onboarded_at = coalesce(onboarded_at, now()),
    city = 'Toronto, ON', latitude = 43.6629, longitude = -79.3957, radius_km = 25, serve_mode = 'either'
  where id in (v_vol, v_vol2, v_orgr);
  update profiles set full_name = 'Priya Sharma (demo volunteer)', interests = '{food,teaching,outreach}', skills = '{teaching,translation}',
    hours_per_week = '3-5' where id = v_vol;
  update profiles set full_name = 'Arjun Patel (demo volunteer)', interests = '{food,outreach}', skills = '{driving}',
    hours_per_week = '1-2' where id = v_vol2;
  update profiles set full_name = 'Meera Nair (demo organizer)', interests = '{food,event_setup}', hours_per_week = '6+' where id = v_orgr;
  delete from notifications where user_id in (v_vol, v_vol2, v_orgr);

  -- organization (events, tasks, assignments and reports cascade away)
  delete from events where org_id = v_org;
  insert into organizations (id, name, city, description, status, is_demo, created_by, reviewed_at, review_note)
  values (v_org, 'Demo Seva Centre', 'Toronto, ON',
          'A sample organization for trying out SevaSetu. Nothing here is real.', 'approved', true, v_orgr, now(), null)
  on conflict (id) do update set name = excluded.name, description = excluded.description, status = 'approved',
    is_demo = true, review_note = null;
  insert into org_members (org_id, user_id, role) values (v_org, v_orgr, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  insert into events (id, org_id, title, description, starts_at, ends_at, mode, venue_name, address, city,
                      latitude, longitude, visibility, status, published_at, created_by) values
    ('d0000000-0000-4000-8000-0000000000e1', v_org, 'Community Food Drive',
     'Pack and hand out food boxes for neighbours in need, with phone outreach for donors beforehand.',
     d + interval '3 days 9 hours', d + interval '3 days 15 hours', 'hybrid', 'Community Hall',
     '50 Maple Ave, Toronto, ON', 'Toronto, ON', 43.6629, -79.3957, 'public', 'published', now(), v_orgr),
    ('d0000000-0000-4000-8000-0000000000e2', v_org, 'Neighbourhood Clean-up Day',
     'Spend a morning tidying the local park and sorting recyclables together.',
     d + interval '6 days 9 hours', d + interval '6 days 12 hours', 'onsite', 'Riverside Park',
     '12 River Rd, Toronto, ON', 'Toronto, ON', 43.6532, -79.3832, 'public', 'published', now(), v_orgr),
    ('d0000000-0000-4000-8000-0000000000e3', v_org, 'Seniors Tech Café (demo)',
     'Friendly one-on-one help for seniors learning phones and video calls.',
     d + interval '8 days 18 hours', d + interval '8 days 20 hours', 'virtual', null, null, 'Toronto, ON',
     null, null, 'public', 'published', now(), v_orgr);

  insert into seva_tasks (id, event_id, title, description, instructions, steps, category, type,
    target_qty, unit, max_per_volunteer, max_volunteers, minutes_per_unit, positions,
    starts_at, ends_at, signup_deadline, mode, visibility, status, created_by) values
    ('d0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000e1', 'Pack food boxes',
     'Assemble boxes from pre-sorted supplies: tins, pasta, fruit and a welcome note.',
     'Check in at the welcome desk and pick up a station number.',
     array['Check in at the welcome desk', 'Pack each box using the checklist', 'Report how many boxes you packed in My Seva'],
     'food', 'quantity', 120, 'boxes', 12, null, 10, null,
     d + interval '3 days 9 hours', d + interval '3 days 12 hours', d + interval '2 days 18 hours',
     'onsite', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f2', 'd0000000-0000-4000-8000-0000000000e1', 'Welcome-desk helper',
     'Greet neighbours, hand out numbers and point people to the right queue.', 'Arrive by 8:45 AM for a short briefing.',
     array['Check in with the event lead', 'Greet guests', 'Help with directions'],
     'event_setup', 'role', null, null, null, null, null, 3,
     d + interval '3 days 9 hours', d + interval '3 days 12 hours', null, 'onsite', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f3', 'd0000000-0000-4000-8000-0000000000e1', 'Call donors to confirm drop-offs',
     'Phone local donors to confirm what they are bringing and when.', 'Your call list is shared after you join.', '{}',
     'outreach', 'quantity', 40, 'calls', 10, 4, 10, null,
     null, null, d + interval '2 days', 'virtual', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f4', 'd0000000-0000-4000-8000-0000000000e2', 'Litter pick in the park',
     'Walk a zone of the park with gloves and bags.', '', '{}',
     'environment', 'role', null, null, null, null, null, 10,
     d + interval '6 days 9 hours', d + interval '6 days 12 hours', null, 'onsite', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f5', 'd0000000-0000-4000-8000-0000000000e2', 'Sort recyclables',
     'Sort the collected material into the right bins.', '', '{}',
     'environment', 'role', null, null, null, null, null, 4,
     d + interval '6 days 10 hours', d + interval '6 days 12 hours', null, 'onsite', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f6', 'd0000000-0000-4000-8000-0000000000e3', 'Teach phone basics to seniors',
     'Guide seniors one-on-one through calls, video chats and messages.', 'A short guide is shared after you join.', '{}',
     'teaching', 'role', null, null, null, null, null, 4,
     d + interval '8 days 18 hours', d + interval '8 days 20 hours', null, 'virtual', 'public', 'open', v_orgr),
    ('d0000000-0000-4000-8000-0000000000f7', 'd0000000-0000-4000-8000-0000000000e3', 'Session leads (invitation only)',
     'Lead the session and pair volunteers with seniors.', '', '{}',
     'teaching', 'role', null, null, null, null, null, 2,
     d + interval '8 days 17 hours 30 minutes', d + interval '8 days 20 hours', null, 'virtual', 'private', 'open', v_orgr);

  -- Arjun has already joined three tasks: one with a report waiting for review, one with verified progress.
  insert into assignments (task_id, volunteer_id, claimed_qty) values
    ('d0000000-0000-4000-8000-0000000000f1', v_vol2, 12) returning id into v_a1;
  insert into assignments (task_id, volunteer_id, claimed_qty) values
    ('d0000000-0000-4000-8000-0000000000f2', v_vol2, 1) returning id into v_a2;
  insert into assignments (task_id, volunteer_id, claimed_qty) values
    ('d0000000-0000-4000-8000-0000000000f3', v_vol2, 10) returning id into v_a3;
  insert into progress_reports (assignment_id, reported_qty, note, status) values
    (v_a1, 8, 'Packed 8 boxes so far, more to come.', 'pending');
  insert into progress_reports (assignment_id, reported_qty, note, status, verified_qty, reviewed_by, reviewed_at) values
    (v_a3, 6, 'Reached 6 donors.', 'approved', 6, v_orgr, now());
end $$;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;

create function public.admin_demo_accounts()
returns table (persona text, user_id uuid, email text, password text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select a.persona, a.user_id, a.email, a.password, p.full_name
    from demo_accounts a join profiles p on p.id = a.user_id
    order by case a.persona when 'volunteer' then 1 when 'organizer' then 2 else 3 end;
end $$;

create function public.admin_reset_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  perform reset_demo_data();
  perform log_admin_action('demo_reset', 'organization', 'd0000000-0000-4000-8000-0000000000a1', 'Demo Seva Centre', null);
end $$;

revoke execute on function public.admin_demo_accounts() from public, anon;
revoke execute on function public.admin_reset_demo() from public, anon;
grant execute on function public.admin_demo_accounts() to authenticated;
grant execute on function public.admin_reset_demo() to authenticated;
