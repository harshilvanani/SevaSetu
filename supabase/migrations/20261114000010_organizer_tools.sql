-- Organizer tools: pre-setup event templates, private-event access requests and invitations,
-- seva visibility that follows the event, volunteer search by preference, and organizer-logged hours on completion.

-- ===========================================================================
-- 1. Event templates (global ones are managed by super admins, others by an organization)
-- ===========================================================================
create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,  -- null = built in for everyone
  name text not null check (char_length(name) between 2 and 140),
  name_i18n jsonb not null default '{}',
  visibility public.visibility not null default 'public',
  sort integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index event_templates_org_idx on public.event_templates (org_id);

create table public.event_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.event_templates (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  name_i18n jsonb not null default '{}',
  sort integer not null default 0
);
create index event_template_tasks_idx on public.event_template_tasks (template_id, sort);

alter table public.events add column if not exists template_id uuid references public.event_templates (id) on delete set null;
alter table public.events add column if not exists completed_at timestamptz;

create function public.can_edit_template(p_template uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_templates x where x.id = p_template and (
      (x.org_id is null and is_platform_admin() and not is_blocked())
      or (x.org_id is not null and can_manage_org(x.org_id))
    )
  )
$$;

alter table public.event_templates enable row level security;
alter table public.event_template_tasks enable row level security;
create policy templates_select on public.event_templates for select to authenticated
  using (org_id is null or is_org_member(org_id) or is_platform_admin());
create policy templates_insert on public.event_templates for insert to authenticated
  with check ((org_id is null and is_platform_admin() and not is_blocked()) or (org_id is not null and can_manage_org(org_id)));
create policy templates_update on public.event_templates for update to authenticated
  using (can_edit_template(id))
  with check ((org_id is null and is_platform_admin() and not is_blocked()) or (org_id is not null and can_manage_org(org_id)));
create policy templates_delete on public.event_templates for delete to authenticated using (can_edit_template(id));

create policy template_tasks_select on public.event_template_tasks for select to authenticated
  using (exists (select 1 from event_templates x where x.id = template_id
                 and (x.org_id is null or is_org_member(x.org_id) or is_platform_admin())));
create policy template_tasks_write on public.event_template_tasks for all to authenticated
  using (can_edit_template(template_id)) with check (can_edit_template(template_id));

revoke all on public.event_templates, public.event_template_tasks from anon;
revoke update on public.events from anon, authenticated;
grant update (title, description, starts_at, ends_at, mode, venue_name, address, city, latitude,
  longitude, visibility, status, template_id) on public.events to authenticated;

-- Built-in templates (English, Hindi, French).
do $$
declare
  v_t uuid; i int;
  tpl jsonb := $json$[
    {"id":"7e000000-0000-4000-8000-000000000001","name":"Art of Living Course Part 1/2","hi":"आर्ट ऑफ़ लिविंग कोर्स भाग 1/2","fr":"Cours Art of Living, partie 1/2","visibility":"private","tasks":[
      ["Outreach Seva","आउटरीच सेवा","Seva de sensibilisation"],
      ["Venue Setup Seva","स्थल सज्जा सेवा","Seva d’installation du lieu"],
      ["Purchasing Seva","खरीद सेवा","Seva d’achats"],
      ["Meal Prep Seva","भोजन तैयारी सेवा","Seva de préparation des repas"],
      ["Logistics Seva","लॉजिस्टिक्स सेवा","Seva de logistique"],
      ["Teacher Hospitality Seva","शिक्षक आतिथ्य सेवा","Seva d’accueil des enseignants"],
      ["Wrap-up Seva","समापन सेवा","Seva de clôture"]]},
    {"id":"7e000000-0000-4000-8000-000000000002","name":"Satsang","hi":"सत्संग","fr":"Satsang","visibility":"public","tasks":[
      ["Venue Setup","स्थल सज्जा","Installation du lieu"],
      ["Food Prep","भोजन तैयारी","Préparation des repas"],
      ["Logistics Seva","लॉजिस्टिक्स सेवा","Seva de logistique"],
      ["Photography Seva","फ़ोटोग्राफ़ी सेवा","Seva de photographie"]]},
    {"id":"7e000000-0000-4000-8000-000000000003","name":"Neighborhood Cleanups","hi":"मोहल्ले की सफ़ाई","fr":"Nettoyages de quartier","visibility":"public","tasks":[
      ["Volunteer Coordinator","स्वयंसेवक समन्वयक","Coordinateur des bénévoles"],
      ["Procurement & Supplies","खरीद और सामग्री","Approvisionnement et fournitures"],
      ["Cleanups","सफ़ाई","Nettoyage"],
      ["Photography Seva","फ़ोटोग्राफ़ी सेवा","Seva de photographie"]]},
    {"id":"7e000000-0000-4000-8000-000000000004","name":"Emergency Supply","hi":"आपातकालीन सामग्री","fr":"Fournitures d’urgence","visibility":"public","tasks":[
      ["Volunteer Coordinator","स्वयंसेवक समन्वयक","Coordinateur des bénévoles"],
      ["Collection of ","संग्रह: ","Collecte de "]]},
    {"id":"7e000000-0000-4000-8000-000000000005","name":"Meal Drives","hi":"भोजन अभियान","fr":"Distributions de repas","visibility":"public","tasks":[
      ["Volunteer Coordinator","स्वयंसेवक समन्वयक","Coordinateur des bénévoles"],
      ["Donate Food","भोजन दान","Don de nourriture"]]}
  ]$json$;
  e jsonb; k jsonb;
begin
  for e in select * from jsonb_array_elements(tpl) loop
    v_t := (e ->> 'id')::uuid;
    insert into event_templates (id, org_id, name, name_i18n, visibility, sort, created_by)
    values (v_t, null, e ->> 'name', jsonb_build_object('hi', e ->> 'hi', 'fr', e ->> 'fr'), (e ->> 'visibility')::visibility,
            (select count(*) from event_templates where org_id is null), null)
    on conflict (id) do nothing;
    i := 0;
    for k in select * from jsonb_array_elements(e -> 'tasks') loop
      insert into event_template_tasks (template_id, name, name_i18n, sort)
      select v_t, k ->> 0, jsonb_build_object('hi', k ->> 1, 'fr', k ->> 2), i
      where not exists (select 1 from event_template_tasks where template_id = v_t and sort = i);
      i := i + 1;
    end loop;
  end loop;
end $$;

-- ===========================================================================
-- 2. Seva visibility follows the event
-- ===========================================================================
create function public.trg_task_inherit_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.visibility := (select visibility from events where id = new.event_id);
  return new;
end $$;
create trigger seva_tasks_inherit_visibility before insert or update of event_id, visibility on public.seva_tasks
  for each row execute function public.trg_task_inherit_visibility();

create function public.trg_event_cascade_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update seva_tasks set visibility = new.visibility where event_id = new.id and visibility <> new.visibility;
  return new;
end $$;
create trigger events_cascade_visibility after update of visibility on public.events
  for each row when (old.visibility is distinct from new.visibility)
  execute function public.trg_event_cascade_visibility();

update public.seva_tasks t set visibility = e.visibility from public.events e
  where e.id = t.event_id and t.visibility <> e.visibility;

-- ===========================================================================
-- 3. Event access: requests and invitations for private events
-- ===========================================================================
create table public.event_access (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('requested', 'invited', 'approved', 'declined', 'revoked', 'expired')),
  note text check (char_length(note) <= 300),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (event_id, user_id)
);
create index event_access_user_idx on public.event_access (user_id);
alter table public.event_access enable row level security;
create policy event_access_select on public.event_access for select to authenticated
  using (user_id = auth.uid() or can_manage_org(event_org(event_id)) or is_platform_admin());
revoke all on public.event_access from anon;
revoke insert, update, delete on public.event_access from authenticated;

create function public.has_event_access(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_access a where a.event_id = p_event and a.user_id = auth.uid()
      and (a.status = 'approved' or (a.status = 'invited' and (a.expires_at is null or a.expires_at > now())))
  ) or exists (
    select 1 from assignments a join seva_tasks t on t.id = a.task_id
    where t.event_id = p_event and a.volunteer_id = auth.uid()
  ) or exists (
    select 1 from task_invitations i join seva_tasks t on t.id = i.task_id
    where t.event_id = p_event and i.invitee_id = auth.uid()
      and (i.status = 'accepted' or (i.status = 'pending' and i.expires_at > now()))
  )
$$;

create or replace function public.has_task_access(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_event_access((select event_id from seva_tasks where id = p_task))
$$;

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
        and (e.visibility = 'public' or has_event_access(e.id))
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
      or (o.status = 'approved' and o.is_demo = is_demo_user() and e.status in ('published', 'completed')
          and (e.visibility = 'public' or has_event_access(e.id)))
    )
  )
$$;

-- demo and real people never mix
create function public.trg_demo_wall_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_demo_user(new.user_id) is distinct from coalesce((
    select o.is_demo from events e join organizations o on o.id = e.org_id where e.id = new.event_id), false) then
    raise exception 'demo_only';
  end if;
  return new;
end $$;
create trigger event_access_demo_wall before insert on public.event_access
  for each row execute function public.trg_demo_wall_access();

-- Signed-in volunteers can see that a private event exists (name, organization, date), nothing more.
create function public.list_private_events()
returns table (id uuid, title text, org_id uuid, org_name text, starts_at timestamptz, access text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return query
    select e.id, e.title, o.id, o.name, e.starts_at, a.status
    from events e join organizations o on o.id = e.org_id
    left join event_access a on a.event_id = e.id and a.user_id = auth.uid()
    where e.visibility = 'private' and e.status = 'published' and e.ends_at >= now()
      and o.status = 'approved' and o.is_demo = is_demo_user() and not is_org_member(o.id)
    order by e.starts_at
    limit 100;
end $$;

create function public.request_event_access(p_event uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare e events; o organizations; a event_access; v_name text; m record;
begin
  perform assert_not_blocked();
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into e from events where id = p_event;
  select * into o from organizations where id = e.org_id;
  if e.id is null or e.visibility <> 'private' or e.status <> 'published' or o.status <> 'approved'
     or o.is_demo <> is_demo_user() or is_org_member(e.org_id) then
    raise exception 'event_not_found';
  end if;
  select * into a from event_access where event_id = p_event and user_id = auth.uid();
  if a.status = 'approved' or (a.status = 'invited' and (a.expires_at is null or a.expires_at > now())) then
    raise exception 'already_has_access';
  end if;
  if a.status = 'requested' then return 'requested'; end if;
  insert into event_access (event_id, user_id, status, note)
  values (p_event, auth.uid(), 'requested', nullif(trim(p_note), ''))
  on conflict (event_id, user_id) do update
    set status = 'requested', note = excluded.note, created_at = now(), responded_at = null, expires_at = null;
  select coalesce(nullif(full_name, ''), email) into v_name from profiles where id = auth.uid();
  for m in select user_id from org_members where org_id = e.org_id loop
    perform notify(m.user_id, 'event_request', 'Request to join ' || e.title, v_name || ' would like to join.',
      jsonb_build_object('event_id', p_event, 'user_id', auth.uid()));
  end loop;
  return 'requested';
end $$;

create function public.respond_event_request(p_event uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  perform assert_not_blocked();
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  update event_access set status = case when p_approve then 'approved' else 'declined' end, responded_at = now()
   where event_id = p_event and user_id = p_user and status = 'requested';
  if not found then raise exception 'request_not_found'; end if;
  perform notify(p_user, case when p_approve then 'event_approved' else 'event_declined' end,
    case when p_approve then 'You''re in: ' else 'Request declined: ' end || e.title,
    case when p_approve then 'You can now see and join its seva.' else '' end,
    jsonb_build_object('event_id', p_event));
end $$;

create function public.invite_to_event(p_event uuid, p_users uuid[], p_days integer default 7) returns integer
language plpgsql security definer set search_path = public as $$
declare e events; o organizations; v_user uuid; a event_access; v_count int := 0;
begin
  perform assert_not_blocked();
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  if e.status not in ('draft', 'published') then raise exception 'event_not_open'; end if;
  if p_days not in (3, 7, 14) then raise exception 'invalid_expiry'; end if;
  select * into o from organizations where id = e.org_id;
  foreach v_user in array p_users loop
    continue when v_user = auth.uid() or is_blocked(v_user) or is_demo_user(v_user) <> o.is_demo;
    select * into a from event_access where event_id = p_event and user_id = v_user;
    if a.status = 'approved' or (a.status = 'invited' and (a.expires_at is null or a.expires_at > now())) then continue; end if;
    if a.status = 'requested' then
      update event_access set status = 'approved', responded_at = now() where event_id = p_event and user_id = v_user;
      perform notify(v_user, 'event_approved', 'You''re in: ' || e.title, 'You can now see and join its seva.',
        jsonb_build_object('event_id', p_event));
    else
      insert into event_access (event_id, user_id, status, invited_by, expires_at)
      values (p_event, v_user, 'invited', auth.uid(), now() + make_interval(days => p_days))
      on conflict (event_id, user_id) do update
        set status = 'invited', invited_by = excluded.invited_by, expires_at = excluded.expires_at,
            responded_at = null, note = null;
      perform notify(v_user, 'invited', 'You''re invited: ' || e.title, o.name,
        jsonb_build_object('event_id', p_event));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.revoke_event_access(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_org(event_org(p_event)) then raise exception 'not_authorized'; end if;
  update event_access set status = 'revoked', responded_at = now()
   where event_id = p_event and user_id = p_user and status in ('requested', 'invited', 'approved');
end $$;

create function public.decline_event_invitation(p_event uuid) returns void
language sql security definer set search_path = public as $$
  update event_access set status = 'declined', responded_at = now()
  where event_id = p_event and user_id = auth.uid() and status = 'invited';
$$;

create or replace function public.expire_invitations() returns integer
language sql security definer set search_path = public as $$
  with x as (
    update task_invitations set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning 1
  ), y as (
    update event_access set status = 'expired'
    where status = 'invited' and expires_at < now()
    returning 1
  ) select (select count(*) from x)::int + (select count(*) from y)::int
$$;

-- join_task: access now comes from event_access (or an existing legacy invitation)
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
-- 4. Hours logged by the organizer when an event is completed
-- ===========================================================================
create table public.event_hours (
  assignment_id uuid primary key references public.assignments (id) on delete cascade,
  hours numeric(5, 2) not null check (hours >= 0 and hours <= 100),
  logged_by uuid references public.profiles (id) on delete set null,
  logged_at timestamptz not null default now()
);
alter table public.event_hours enable row level security;
create policy event_hours_select on public.event_hours for select to authenticated
  using (exists (select 1 from assignments a where a.id = assignment_id
                 and (a.volunteer_id = auth.uid() or can_manage_org(task_org(a.task_id)))) or is_platform_admin());
revoke all on public.event_hours from anon;
revoke insert, update, delete on public.event_hours from authenticated;

-- What SevaSetu would count without a logged value: role = scheduled duration once served, quantity = verified units x minutes.
create function public.estimate_hours(p_assignment uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when t.type = 'role' then
        case when a.status = 'completed'
          then extract(epoch from (coalesce(t.ends_at, e.ends_at) - coalesce(t.starts_at, e.starts_at))) / 3600
          else 0 end
      else coalesce((select sum(r.verified_qty) from progress_reports r where r.assignment_id = a.id and r.status = 'approved'), 0)
           * coalesce(t.minutes_per_unit, 0) / 60.0
    end
    from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
    where a.id = p_assignment
  ), 0)
$$;
revoke execute on function public.estimate_hours(uuid) from public, anon, authenticated;

-- The hours that count: what the organizer logged (once the event is completed), otherwise the estimate.
create function public.effective_hours(p_assignment uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((
    select h.hours from event_hours h
    join assignments a on a.id = h.assignment_id join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
    where h.assignment_id = p_assignment and e.status = 'completed'
  ), estimate_hours(p_assignment))
$$;
revoke execute on function public.effective_hours(uuid) from public, anon, authenticated;

create or replace function public.volunteer_stats(p_user uuid default null)
returns table (verified_hours numeric, completed_count integer, active_count integer)
language sql stable security definer set search_path = public as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  allowed as (
    select (select id from u) = auth.uid() or exists (
      select 1 from assignments a2 join seva_tasks t2 on t2.id = a2.task_id
      where a2.volunteer_id = (select id from u) and can_manage_org(task_org(t2.id))
    ) as ok
  )
  select round(coalesce((select sum(effective_hours(a.id)) from assignments a
                         where a.volunteer_id = (select id from u)), 0), 1),
         (select count(*)::int from assignments where volunteer_id = (select id from u) and status = 'completed'),
         (select count(*)::int from assignments where volunteer_id = (select id from u) and status = 'active')
  where (select ok from allowed)
$$;

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
    'verified_hours', round(coalesce((
      select sum(effective_hours(a.id)) from assignments a join seva_tasks t on t.id = a.task_id
      join events e on e.id = t.event_id join organizations o on o.id = e.org_id where not o.is_demo), 0)::numeric, 1)
  ) into v;
  return v;
end $$;

-- Volunteers with approved work in the event, with the calculated estimate and anything already logged.
create function public.event_hours_candidates(p_event uuid)
returns table (assignment_id uuid, task_id uuid, task_title text, volunteer_id uuid, volunteer_name text,
               estimate numeric, logged numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_manage_org(event_org(p_event)) then raise exception 'not_authorized'; end if;
  return query
    select a.id, t.id, t.title, a.volunteer_id, coalesce(nullif(p.full_name, ''), p.email, '—'),
           round(estimate_hours(a.id), 2), h.hours
    from assignments a
    join seva_tasks t on t.id = a.task_id
    join profiles p on p.id = a.volunteer_id
    left join event_hours h on h.assignment_id = a.id
    where t.event_id = p_event and a.status <> 'cancelled'
      and (a.status = 'completed' or exists (select 1 from progress_reports r where r.assignment_id = a.id and r.status = 'approved'))
    order by t.title, p.full_name;
end $$;

create function public.complete_event(p_event uuid, p_hours jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e events; cand record; v_hours numeric;
begin
  perform assert_not_blocked();
  select * into e from events where id = p_event for update;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  if e.status <> 'published' then raise exception 'event_not_published'; end if;
  if jsonb_typeof(coalesce(p_hours, '[]'::jsonb)) <> 'array' then raise exception 'invalid_hours'; end if;
  -- every entry must belong to a volunteer in the candidate list
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) x
    where not exists (select 1 from event_hours_candidates(p_event) c where c.assignment_id = (x ->> 'assignment_id')::uuid)
  ) then raise exception 'invalid_assignment'; end if;
  for cand in select * from event_hours_candidates(p_event) loop
    select (x ->> 'hours')::numeric into v_hours
      from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) x where (x ->> 'assignment_id')::uuid = cand.assignment_id;
    v_hours := coalesce(v_hours, cand.logged, cand.estimate);
    if v_hours < 0 or v_hours > 100 then raise exception 'invalid_hours'; end if;
    insert into event_hours (assignment_id, hours, logged_by) values (cand.assignment_id, round(v_hours, 2), auth.uid())
    on conflict (assignment_id) do update set hours = excluded.hours, logged_by = excluded.logged_by, logged_at = now();
    perform notify(cand.volunteer_id, 'hours_logged', 'Hours logged: ' || trim_scale(round(v_hours, 2))::text || ' h',
      cand.task_title, jsonb_build_object('task_id', cand.task_id, 'event_id', p_event));
  end loop;
  update events set status = 'completed', completed_at = now() where id = p_event;
end $$;

create function public.reopen_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  perform assert_not_blocked();
  select * into e from events where id = p_event for update;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  if e.status <> 'completed' then raise exception 'event_not_completed'; end if;
  update events set status = 'published', completed_at = null where id = p_event;
end $$;

-- ===========================================================================
-- 5. Find volunteers by preference (no contact details are returned)
-- ===========================================================================
create function public.find_volunteers(
  p_event uuid, p_task uuid default null, p_skills text[] default '{}',
  p_only_available boolean default false, p_only_near boolean default false, p_tz text default 'UTC'
)
returns table (id uuid, full_name text, city text, interests text[], skills text[], serve_mode public.serve_mode,
               availability jsonb, distance_km numeric, score integer, reasons text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  e events; o organizations; t seva_tasks;
  v_start timestamptz; v_end timestamptz; v_flexible boolean := false; v_mode public.participation_mode;
  v_cats text[]; v_skills text[];
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
      coalesce((select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'period', s.period) order by s.weekday, s.period)
                from availability_slots s where s.user_id = p.id), '[]'::jsonb) as slots,
      case when e.latitude is not null and p.latitude is not null and p.longitude is not null
           then 6371 * acos(least(1, greatest(-1,
                cos(radians(e.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude - e.longitude))
                + sin(radians(e.latitude)) * sin(radians(p.latitude)))))
      end as dist
    from profiles p
    where p.id <> auth.uid() and p.blocked_at is null and p.onboarded_at is not null and p.is_demo = o.is_demo
      and not exists (select 1 from event_access x where x.event_id = p_event and x.user_id = p.id
                      and (x.status in ('requested', 'approved') or (x.status = 'invited' and x.expires_at > now())))
      and not exists (select 1 from assignments a join seva_tasks st on st.id = a.task_id
                      where a.volunteer_id = p.id and a.status <> 'cancelled'
                        and st.event_id = p_event and (p_task is null or st.id = p_task))
  ), scored as (
    select c.*,
      (cardinality(v_cats) > 0 and c.interests && v_cats) as m_interest,
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
         (case when s.m_interest then 3 else 0 end + case when s.m_skills then 2 else 0 end
          + case when s.m_avail then 2 else 0 end + case when s.m_near then 2 else 0 end),
         array_remove(array[
           case when s.m_interest then 'interest' end,
           case when s.m_skills then 'skills' end,
           case when s.m_avail then 'available' end,
           case when s.m_near then case when v_mode = 'virtual' or (v_mode = 'hybrid' and s.serve_mode <> 'onsite' and (s.dist is null or s.dist > s.radius_km)) then 'online' else 'near' end end
         ], null)
  from scored s
  where (not p_only_available or s.m_avail) and (not p_only_near or s.m_near)
  order by 9 desc, s.dist asc nulls last, s.full_name
  limit 50;
end $$;

-- ===========================================================================
-- 6. Demo content: a private demo event with a pending request, and a template-based event
-- ===========================================================================
create or replace function public.reset_demo_data() returns void
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
     null, null, 'private', 'published', now(), v_orgr);

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

  update events set template_id = '7e000000-0000-4000-8000-000000000005' where id = 'd0000000-0000-4000-8000-0000000000e1';
  insert into event_access (event_id, user_id, status, note)
  values ('d0000000-0000-4000-8000-0000000000e3', v_vol, 'requested', 'Hi, I would love to help at the café.');
  insert into notifications (user_id, type, title, body, data)
  values (v_orgr, 'event_request', 'Request to join Seniors Tech Café (demo)', 'Priya Sharma (demo volunteer) would like to join.',
          jsonb_build_object('event_id', 'd0000000-0000-4000-8000-0000000000e3', 'user_id', v_vol));
end $$;

-- ===========================================================================
-- Grants
-- ===========================================================================
revoke execute on function public.list_private_events() from public, anon;
revoke execute on function public.request_event_access(uuid, text) from public, anon;
revoke execute on function public.respond_event_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.invite_to_event(uuid, uuid[], integer) from public, anon;
revoke execute on function public.revoke_event_access(uuid, uuid) from public, anon;
revoke execute on function public.decline_event_invitation(uuid) from public, anon;
revoke execute on function public.event_hours_candidates(uuid) from public, anon;
revoke execute on function public.complete_event(uuid, jsonb) from public, anon;
revoke execute on function public.reopen_event(uuid) from public, anon;
revoke execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text) from public, anon;
grant execute on function public.list_private_events() to authenticated;
grant execute on function public.request_event_access(uuid, text) to authenticated;
grant execute on function public.respond_event_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.invite_to_event(uuid, uuid[], integer) to authenticated;
grant execute on function public.revoke_event_access(uuid, uuid) to authenticated;
grant execute on function public.decline_event_invitation(uuid) to authenticated;
grant execute on function public.event_hours_candidates(uuid) to authenticated;
grant execute on function public.complete_event(uuid, jsonb) to authenticated;
grant execute on function public.reopen_event(uuid) to authenticated;
grant execute on function public.find_volunteers(uuid, uuid, text[], boolean, boolean, text) to authenticated;
