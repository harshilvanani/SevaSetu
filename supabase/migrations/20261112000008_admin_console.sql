-- Super-admin console: organization review (approve / reject / suspend / reinstate / resubmit),
-- user blocking, platform-admin management, event cancellation, and an audit log.
-- Every admin RPC checks is_platform_admin(), writes admin_actions, and notifies the affected people.

-- ---------------------------------------------------------------------------
-- Blocked users
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_reason text;

create function public.is_blocked(p_user uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select blocked_at is not null from profiles where id = coalesce(p_user, auth.uid())), false)
$$;

create function public.assert_not_blocked() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if is_blocked() then raise exception 'account_blocked'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log (admins read; only admin RPCs write)
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null check (target_type in ('organization', 'user', 'event')),
  target_id uuid not null,
  target_label text,
  reason text,
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
create policy admin_actions_select on public.admin_actions for select to authenticated using (is_platform_admin());
revoke insert, update, delete on public.admin_actions from anon, authenticated;

create function public.log_admin_action(p_action text, p_type text, p_target uuid, p_label text, p_reason text)
returns void
language sql security definer set search_path = public as $$
  insert into admin_actions (admin_id, action, target_type, target_id, target_label, reason)
  values (auth.uid(), p_action, p_type, p_target, p_label, nullif(trim(p_reason), ''));
$$;
revoke execute on function public.log_admin_action(text, text, uuid, text, text) from public, anon, authenticated;

create function public.assert_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() or is_blocked() then raise exception 'not_authorized'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Visibility: suspended orgs and blocked organizers lose public reach / write access
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m join organizations o on o.id = m.org_id
    where m.org_id = p_org and m.user_id = auth.uid() and o.status = 'approved'
  ) and not is_blocked()
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
      or (o.status = 'approved' and e.status in ('published', 'completed') and (
        e.visibility = 'public'
        or exists (select 1 from seva_tasks t where t.event_id = e.id and has_task_access(t.id))
      ))
    )
  )
$$;

-- Admins can read all participation data (for user detail pages).
drop policy assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (volunteer_id = auth.uid() or can_manage_org(task_org(task_id)) or is_platform_admin());

drop policy reports_select on public.progress_reports;
create policy reports_select on public.progress_reports for select to authenticated
  using (is_platform_admin() or exists (
    select 1 from assignments a where a.id = assignment_id
      and (a.volunteer_id = auth.uid() or can_manage_org(task_org(a.task_id)))
  ));

-- ---------------------------------------------------------------------------
-- Blocked users can't join, report, or start organizations
-- (bodies unchanged from 20261107000002_logic.sql apart from the assert_not_blocked() guard)
-- ---------------------------------------------------------------------------
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
  if (t.visibility = 'private' or e.visibility = 'private') and not is_org_member(e.org_id)
     and not exists (
       select 1 from task_invitations i where i.task_id = p_task and i.invitee_id = v_uid
         and (i.status = 'accepted' or (i.status = 'pending' and i.expires_at > now()))
     ) then
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

  perform notify(v_uid, 'joined', t.title,
    case when t.type = 'quantity' then v_qty || ' ' || t.unit || ' reserved for you' else 'Your position is confirmed' end,
    jsonb_build_object('task_id', p_task, 'assignment_id', v_assignment));

  return jsonb_build_object('status', 'joined', 'assignment_id', v_assignment, 'qty', v_qty);
end $$;

create or replace function public.update_claim(p_assignment uuid, p_qty integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assignments; t seva_tasks; v_floor int; v_available int;
begin
  perform assert_not_blocked();
  select * into a from assignments where id = p_assignment and volunteer_id = auth.uid();
  if a.id is null then raise exception 'assignment_not_found'; end if;
  if a.status <> 'active' then raise exception 'assignment_not_active'; end if;
  select * into t from seva_tasks where id = a.task_id for update;
  if t.type <> 'quantity' then raise exception 'not_quantity_task'; end if;
  if t.max_per_volunteer is not null and p_qty > t.max_per_volunteer then
    raise exception 'quantity_exceeds_max';
  end if;

  select coalesce(sum(coalesce(verified_qty, reported_qty)) filter (where status <> 'rejected'), 0)
    into v_floor from progress_reports where assignment_id = a.id;
  if p_qty < greatest(v_floor, 1) then raise exception 'quantity_below_reported'; end if;

  v_available := greatest(t.target_qty - t.claimed_total, 0) + a.claimed_qty;
  if p_qty > v_available then
    return jsonb_build_object('status', 'capacity_changed', 'available', v_available);
  end if;

  update assignments set claimed_qty = p_qty where id = a.id;
  return jsonb_build_object('status', 'updated', 'qty', p_qty);
end $$;

create or replace function public.submit_progress(p_assignment uuid, p_qty integer, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a assignments; t seva_tasks; v_used int; v_report uuid; v_org uuid; m record;
begin
  perform assert_not_blocked();
  select * into a from assignments where id = p_assignment and volunteer_id = auth.uid() for update;
  if a.id is null then raise exception 'assignment_not_found'; end if;
  if a.status <> 'active' then raise exception 'assignment_not_active'; end if;
  select * into t from seva_tasks where id = a.task_id;
  if t.type <> 'quantity' then raise exception 'not_quantity_task'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'invalid_quantity'; end if;

  select coalesce(sum(case when status = 'approved' then verified_qty else reported_qty end)
                  filter (where status <> 'rejected'), 0)
    into v_used from progress_reports where assignment_id = a.id;
  if v_used + p_qty > a.claimed_qty then
    raise exception 'quantity_exceeds_remaining:%', a.claimed_qty - v_used;
  end if;

  insert into progress_reports (assignment_id, reported_qty, note)
  values (a.id, p_qty, nullif(trim(p_note), '')) returning id into v_report;

  v_org := task_org(t.id);
  for m in select user_id from org_members where org_id = v_org loop
    perform notify(m.user_id, 'report_submitted', 'Progress awaiting review',
      t.title || ': ' || p_qty || ' ' || t.unit || ' reported',
      jsonb_build_object('task_id', t.id, 'report_id', v_report));
  end loop;
  return v_report;
end $$;

create or replace function public.create_organization(p_name text, p_city text default null, p_description text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; m record;
begin
  perform assert_not_blocked();
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into organizations (name, city, description, created_by)
  values (trim(p_name), nullif(trim(p_city), ''), nullif(trim(p_description), ''), auth.uid())
  returning id into v_org;
  insert into org_members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  for m in select id from profiles where is_platform_admin loop
    perform notify(m.id, 'org_pending', 'New organization to review', trim(p_name),
      jsonb_build_object('org_id', v_org));
  end loop;
  return v_org;
end $$;

-- ---------------------------------------------------------------------------
-- Organizations: review, suspend, reinstate, resubmit
-- ---------------------------------------------------------------------------
drop function public.review_organization(uuid, boolean, text);

-- p_action: 'approve' | 'reject' | 'suspend' | 'reinstate'. Reject and suspend need a reason.
create function public.admin_review_organization(p_org uuid, p_action text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o organizations; v_reason text := nullif(trim(p_reason), ''); v_new org_status; m record;
  v_title text; v_body text;
begin
  perform assert_platform_admin();
  select * into o from organizations where id = p_org for update;
  if o.id is null then raise exception 'org_not_found'; end if;

  if p_action = 'approve' and o.status in ('pending', 'rejected') then v_new := 'approved';
  elsif p_action = 'reject' and o.status = 'pending' then v_new := 'rejected';
  elsif p_action = 'suspend' and o.status = 'approved' then v_new := 'suspended';
  elsif p_action = 'reinstate' and o.status = 'suspended' then v_new := 'approved';
  else raise exception 'invalid_transition';
  end if;
  if p_action in ('reject', 'suspend') and v_reason is null then raise exception 'reason_required'; end if;

  update organizations set status = v_new, reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_reason
  where id = p_org;

  v_title := case p_action when 'approve' then 'Organization approved'
                           when 'reject' then 'Organization not approved'
                           when 'suspend' then 'Organization suspended'
                           else 'Organization reinstated' end;
  v_body := case p_action when 'approve' then o.name || ' can now publish events.'
                          when 'reinstate' then o.name || ' is active again.'
                          else o.name || ': ' || v_reason end;
  for m in select user_id from org_members where org_id = p_org loop
    perform notify(m.user_id, 'org_reviewed', v_title, v_body,
      jsonb_build_object('org_id', p_org, 'action', p_action));
  end loop;
  perform log_admin_action('org_' || p_action, 'organization', p_org, o.name, v_reason);
end $$;

-- The owner of a rejected organization edits it and sends it back for review.
create function public.resubmit_organization(p_org uuid, p_name text, p_city text default null, p_description text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o organizations; m record;
begin
  perform assert_not_blocked();
  if not exists (select 1 from org_members where org_id = p_org and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_authorized';
  end if;
  select * into o from organizations where id = p_org for update;
  if o.status <> 'rejected' then raise exception 'invalid_transition'; end if;
  update organizations set name = trim(p_name), city = nullif(trim(p_city), ''), description = nullif(trim(p_description), ''),
    status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null
  where id = p_org;
  for m in select id from profiles where is_platform_admin loop
    perform notify(m.id, 'org_pending', 'Organization resubmitted for review', trim(p_name),
      jsonb_build_object('org_id', p_org));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Users: block / unblock, platform admins
-- ---------------------------------------------------------------------------
-- Blocking bans sign-in, ends sessions, and releases the user's upcoming spots that have no reports yet.
-- Returns {"cancelled": <assignments released>}.
create function public.admin_set_user_blocked(p_user uuid, p_blocked boolean, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare p profiles; v_reason text := nullif(trim(p_reason), ''); v_cancelled int := 0;
begin
  perform assert_platform_admin();
  select * into p from public.profiles where id = p_user for update;
  if p.id is null then raise exception 'user_not_found'; end if;
  if p_user = auth.uid() then raise exception 'cannot_block_self'; end if;

  if p_blocked then
    if p.is_platform_admin then raise exception 'cannot_block_admin'; end if;
    if v_reason is null then raise exception 'reason_required'; end if;
    if p.blocked_at is not null then raise exception 'already_blocked'; end if;
    update public.profiles set blocked_at = now(), blocked_reason = v_reason where id = p_user;
    update auth.users set banned_until = now() + interval '100 years' where id = p_user;
    delete from auth.sessions where user_id = p_user;

    update public.assignments a set status = 'cancelled', cancelled_at = now()
    from public.seva_tasks t join public.events e on e.id = t.event_id
    where a.task_id = t.id and a.volunteer_id = p_user and a.status = 'active'
      and not exists (select 1 from public.progress_reports r where r.assignment_id = a.id)
      and (coalesce(t.starts_at, e.starts_at) > now() or (t.type = 'quantity' and t.starts_at is null and t.mode = 'virtual'));
    get diagnostics v_cancelled = row_count;

    perform log_admin_action('user_block', 'user', p_user, coalesce(nullif(p.full_name, ''), p.email), v_reason);
  else
    if p.blocked_at is null then raise exception 'not_blocked'; end if;
    update public.profiles set blocked_at = null, blocked_reason = null where id = p_user;
    update auth.users set banned_until = null where id = p_user;
    perform notify(p_user, 'account_unblocked', 'Your account is active again', coalesce(v_reason, ''), '{}'::jsonb);
    perform log_admin_action('user_unblock', 'user', p_user, coalesce(nullif(p.full_name, ''), p.email), v_reason);
  end if;
  return jsonb_build_object('cancelled', v_cancelled);
end $$;

create function public.admin_set_platform_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  perform assert_platform_admin();
  select * into p from profiles where id = p_user for update;
  if p.id is null then raise exception 'user_not_found'; end if;
  if p.is_platform_admin = p_admin then return; end if;
  if p_admin and p.blocked_at is not null then raise exception 'user_blocked'; end if;
  if not p_admin then
    if p_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
    if (select count(*) from profiles where is_platform_admin) <= 1 then raise exception 'last_admin'; end if;
  end if;
  update profiles set is_platform_admin = p_admin where id = p_user;
  perform notify(p_user, 'admin_role',
    case when p_admin then 'You are now a SevaSetu admin' else 'Your admin access was removed' end, '', '{}'::jsonb);
  perform log_admin_action(case when p_admin then 'admin_grant' else 'admin_revoke' end, 'user', p_user,
    coalesce(nullif(p.full_name, ''), p.email), null);
end $$;

-- ---------------------------------------------------------------------------
-- Events: admin cancellation
-- ---------------------------------------------------------------------------
create function public.admin_cancel_event(p_event uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare e events; v_reason text := nullif(trim(p_reason), ''); r record;
begin
  perform assert_platform_admin();
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into e from events where id = p_event for update;
  if e.id is null then raise exception 'event_not_found'; end if;
  if e.status not in ('draft', 'published') then raise exception 'invalid_transition'; end if;

  -- Notify everyone who signed up, then release their spots.
  for r in
    select distinct a.volunteer_id from assignments a join seva_tasks t on t.id = a.task_id
    where t.event_id = p_event and a.status = 'active'
  loop
    perform notify(r.volunteer_id, 'event_cancelled', 'Event cancelled: ' || e.title, v_reason,
      jsonb_build_object('event_id', p_event));
  end loop;
  update assignments a set status = 'cancelled', cancelled_at = now()
  from seva_tasks t where a.task_id = t.id and t.event_id = p_event and a.status = 'active'
    and not exists (select 1 from progress_reports pr where pr.assignment_id = a.id);

  update events set status = 'cancelled' where id = p_event;
  update seva_tasks set status = 'closed' where event_id = p_event and status in ('draft', 'open', 'full');

  for r in select user_id from org_members where org_id = e.org_id loop
    perform notify(r.user_id, 'event_cancelled', 'Event cancelled by a SevaSetu admin: ' || e.title, v_reason,
      jsonb_build_object('event_id', p_event));
  end loop;
  perform log_admin_action('event_cancel', 'event', p_event, e.title, v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Admin reads
-- ---------------------------------------------------------------------------
create function public.admin_list_users(p_query text default null)
returns table (
  id uuid, email text, full_name text, city text, created_at timestamptz, last_sign_in_at timestamptz,
  providers text[], is_platform_admin boolean, blocked_at timestamptz, blocked_reason text,
  onboarded boolean, org_count integer, assignment_count integer
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform assert_platform_admin();
  return query
    select p.id, p.email, p.full_name, p.city, p.created_at, u.last_sign_in_at,
      coalesce(array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')), '{}'),
      p.is_platform_admin, p.blocked_at, p.blocked_reason, p.onboarded_at is not null,
      (select count(*)::int from public.org_members m where m.user_id = p.id),
      (select count(*)::int from public.assignments a where a.volunteer_id = p.id and a.status <> 'cancelled')
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(trim(p_query), '') = ''
       or p.full_name ilike '%' || trim(p_query) || '%'
       or p.email ilike '%' || trim(p_query) || '%'
    order by p.created_at desc
    limit 500;
end $$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform assert_platform_admin();
  select jsonb_build_object(
    'users', (select count(*) from profiles),
    'users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'blocked', (select count(*) from profiles where blocked_at is not null),
    'admins', (select count(*) from profiles where is_platform_admin),
    'orgs', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from organizations group by status) s),
    'events_live', (select count(*) from events where status = 'published' and ends_at >= now()),
    'active_volunteers', (select count(distinct volunteer_id) from assignments where status = 'active'),
    'verified_hours', round((
      coalesce((select sum(extract(epoch from (coalesce(t.ends_at, e.ends_at) - coalesce(t.starts_at, e.starts_at))) / 3600)
        from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
        where a.status = 'completed' and t.type = 'role'), 0)
      + coalesce((select sum(r.verified_qty * coalesce(t.minutes_per_unit, 0)) / 60.0
        from progress_reports r join assignments a on a.id = r.assignment_id join seva_tasks t on t.id = a.task_id
        where r.status = 'approved'), 0))::numeric, 1)
  ) into v;
  return v;
end $$;

revoke execute on function public.admin_review_organization(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_user_blocked(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_platform_admin(uuid, boolean) from public, anon;
revoke execute on function public.admin_cancel_event(uuid, text) from public, anon;
revoke execute on function public.admin_list_users(text) from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.resubmit_organization(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_organization(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_blocked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_platform_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_cancel_event(uuid, text) to authenticated;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.resubmit_organization(uuid, text, text, text) to authenticated;
