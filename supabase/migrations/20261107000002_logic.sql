-- SevaSetu business logic: counters, capacity-safe joins, progress review, orgs, notifications.
-- All mutating workflows go through SECURITY DEFINER RPCs that validate auth.uid().

-- ---------------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------------
create function public.notify(
  p_user uuid, p_type text, p_title text, p_body text default '', p_data jsonb default '{}'
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, coalesce(p_body, ''), coalesce(p_data, '{}'::jsonb));
$$;
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Capacity helpers
-- ---------------------------------------------------------------------------
-- Units (quantity) or positions (role) still claimable, ignoring per-volunteer caps.
create function public.task_remaining(t public.seva_tasks) returns integer
language sql immutable as $$
  select case
    when t.type = 'role' then greatest(t.positions - t.volunteers_count, 0)
    when t.max_volunteers is not null and t.volunteers_count >= t.max_volunteers then 0
    else greatest(t.target_qty - t.claimed_total, 0)
  end
$$;

-- Recompute denormalized counters and flip open <-> full.
create function public.refresh_task_counters(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_claimed int; v_vols int; v_verified int; v_pending int; v_completed int;
  t seva_tasks;
begin
  select coalesce(sum(claimed_qty), 0), count(*),
         count(*) filter (where status = 'completed')
    into v_claimed, v_vols, v_completed
    from assignments where task_id = p_task and status <> 'cancelled';

  select coalesce(sum(r.verified_qty) filter (where r.status = 'approved'), 0),
         coalesce(sum(r.reported_qty) filter (where r.status = 'pending'), 0)
    into v_verified, v_pending
    from progress_reports r join assignments a on a.id = r.assignment_id
   where a.task_id = p_task;

  update seva_tasks set
    claimed_total = v_claimed,
    volunteers_count = v_vols,
    verified_total = case when type = 'role' then v_completed else v_verified end,
    pending_total = v_pending
  where id = p_task
  returning * into t;

  if t.id is null then return; end if;

  if t.status = 'open' and task_remaining(t) = 0 then
    update seva_tasks set status = 'full' where id = p_task;
  elsif t.status = 'full' and task_remaining(t) > 0 then
    update seva_tasks set status = 'open' where id = p_task;
  end if;
end $$;
revoke execute on function public.refresh_task_counters(uuid) from public, anon, authenticated;

create function public.trg_assignment_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_task_counters(coalesce(new.task_id, old.task_id));
  if tg_op = 'UPDATE' and new.task_id <> old.task_id then
    perform refresh_task_counters(old.task_id);
  end if;
  return null;
end $$;

create trigger assignments_counters after insert or update or delete on public.assignments
  for each row execute function public.trg_assignment_counters();

create function public.trg_report_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_task_counters(
    (select task_id from assignments where id = coalesce(new.assignment_id, old.assignment_id))
  );
  return null;
end $$;

create trigger progress_reports_counters after insert or update or delete on public.progress_reports
  for each row execute function public.trg_report_counters();

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------
-- Returns json:
--   {status:'joined', assignment_id, qty}
--   {status:'capacity_changed', available}  -- fewer units left than requested; nothing reserved
--   {status:'full'}
-- Raises for authorization/validation errors (codes in message prefix).
create function public.join_task(p_task uuid, p_qty integer default 1) returns jsonb
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

-- Leave a task. Work already verified is kept (assignment completes with that amount);
-- the rest is released back to the pool. Not allowed while reports await review.
create function public.leave_task(p_assignment uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assignments;
  v_verified int;
begin
  select * into a from assignments where id = p_assignment and volunteer_id = auth.uid() for update;
  if a.id is null then raise exception 'assignment_not_found'; end if;
  if a.status <> 'active' then raise exception 'assignment_not_active'; end if;
  perform 1 from seva_tasks where id = a.task_id for update;
  if exists (select 1 from progress_reports where assignment_id = a.id and status = 'pending') then
    raise exception 'reports_pending';
  end if;

  select coalesce(sum(verified_qty), 0) into v_verified
    from progress_reports where assignment_id = a.id and status = 'approved';

  if v_verified > 0 then
    update assignments set status = 'completed', claimed_qty = v_verified, completed_at = now()
     where id = a.id;
    return jsonb_build_object('status', 'completed', 'kept', v_verified);
  end if;

  update assignments set status = 'cancelled', cancelled_at = now() where id = a.id;
  return jsonb_build_object('status', 'cancelled');
end $$;

-- Change claimed quantity on an active quantity assignment (can't go below reported work).
create function public.update_claim(p_assignment uuid, p_qty integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assignments; t seva_tasks; v_floor int; v_available int;
begin
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

-- ---------------------------------------------------------------------------
-- Progress reports
-- ---------------------------------------------------------------------------
create function public.submit_progress(p_assignment uuid, p_qty integer, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a assignments; t seva_tasks; v_used int; v_report uuid; v_org uuid; m record;
begin
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

-- p_decision: 'approve' | 'adjust' | 'reject'
create function public.review_progress(
  p_report uuid, p_decision text, p_verified_qty integer default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r progress_reports; a assignments; t seva_tasks; v_verified int; v_total int; v_reason text;
begin
  select * into r from progress_reports where id = p_report for update;
  if r.id is null then raise exception 'report_not_found'; end if;
  select * into a from assignments where id = r.assignment_id;
  select * into t from seva_tasks where id = a.task_id;
  if not can_manage_org(task_org(t.id)) then raise exception 'not_authorized'; end if;
  if r.status <> 'pending' then raise exception 'report_already_reviewed'; end if;
  v_reason := nullif(trim(p_reason), '');

  if p_decision = 'approve' then
    v_verified := r.reported_qty;
  elsif p_decision = 'adjust' then
    if p_verified_qty is null or p_verified_qty < 0 or p_verified_qty >= r.reported_qty then
      raise exception 'invalid_adjustment';
    end if;
    if v_reason is null then raise exception 'reason_required'; end if;
    v_verified := p_verified_qty;
  elsif p_decision = 'reject' then
    if v_reason is null then raise exception 'reason_required'; end if;
  else
    raise exception 'invalid_decision';
  end if;

  update progress_reports set
    status = case when p_decision = 'reject' then 'rejected'::report_status else 'approved'::report_status end,
    verified_qty = v_verified,
    reviewed_by = auth.uid(), review_reason = v_reason, reviewed_at = now()
  where id = r.id;

  -- Auto-complete the assignment once all claimed work is verified.
  select coalesce(sum(verified_qty), 0) into v_total
    from progress_reports where assignment_id = a.id and status = 'approved';
  if a.status = 'active' and v_total >= a.claimed_qty then
    update assignments set status = 'completed', completed_at = now() where id = a.id;
  end if;

  perform notify(a.volunteer_id, 'report_reviewed',
    case p_decision when 'approve' then 'Progress verified'
                    when 'adjust' then 'Progress adjusted'
                    else 'Progress not approved' end,
    case p_decision when 'approve' then r.reported_qty || ' ' || t.unit || ' verified for ' || t.title
                    when 'adjust' then r.reported_qty || ' → ' || v_verified || ' ' || t.unit || ': ' || v_reason
                    else v_reason end,
    jsonb_build_object('task_id', t.id, 'assignment_id', a.id, 'report_id', r.id, 'decision', p_decision));
end $$;

-- Role tasks: organizer marks a volunteer's position as served (counts toward verified hours).
create function public.complete_assignment(p_assignment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a assignments; t seva_tasks;
begin
  select * into a from assignments where id = p_assignment for update;
  if a.id is null then raise exception 'assignment_not_found'; end if;
  select * into t from seva_tasks where id = a.task_id;
  if not can_manage_org(task_org(t.id)) then raise exception 'not_authorized'; end if;
  if a.status <> 'active' then raise exception 'assignment_not_active'; end if;
  update assignments set status = 'completed', completed_at = now() where id = a.id;
  perform notify(a.volunteer_id, 'assignment_completed', 'Seva verified',
    'Thank you for serving: ' || t.title, jsonb_build_object('task_id', t.id, 'assignment_id', a.id));
end $$;

-- ---------------------------------------------------------------------------
-- Volunteer stats (verified hours)
-- ---------------------------------------------------------------------------
-- Role: task duration for completed assignments. Quantity: verified units x minutes_per_unit.
create function public.volunteer_stats(p_user uuid default null)
returns table (verified_hours numeric, completed_count integer, active_count integer)
language sql stable security definer set search_path = public as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  allowed as (
    select (select id from u) = auth.uid() or exists (
      select 1 from assignments a2 join seva_tasks t2 on t2.id = a2.task_id
      where a2.volunteer_id = (select id from u) and can_manage_org(task_org(t2.id))
    ) as ok
  ),
  role_hours as (
    select coalesce(sum(extract(epoch from (coalesce(t.ends_at, e.ends_at) - coalesce(t.starts_at, e.starts_at))) / 3600), 0) h
    from assignments a join seva_tasks t on t.id = a.task_id join events e on e.id = t.event_id
    where a.volunteer_id = (select id from u) and a.status = 'completed' and t.type = 'role'
  ),
  qty_hours as (
    select coalesce(sum(r.verified_qty * coalesce(t.minutes_per_unit, 0)) / 60.0, 0) h
    from progress_reports r join assignments a on a.id = r.assignment_id join seva_tasks t on t.id = a.task_id
    where a.volunteer_id = (select id from u) and r.status = 'approved'
  )
  select round((select h from role_hours) + (select h from qty_hours), 1),
         (select count(*)::int from assignments where volunteer_id = (select id from u) and status = 'completed'),
         (select count(*)::int from assignments where volunteer_id = (select id from u) and status = 'active')
  where (select ok from allowed)
$$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create function public.create_organization(p_name text, p_city text default null, p_description text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; m record;
begin
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

create function public.review_organization(p_org uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o organizations; m record;
begin
  if not is_platform_admin() then raise exception 'not_authorized'; end if;
  update organizations set status = case when p_approve then 'approved'::org_status else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
  where id = p_org returning * into o;
  if o.id is null then raise exception 'org_not_found'; end if;
  for m in select user_id from org_members where org_id = p_org loop
    perform notify(m.user_id, 'org_reviewed',
      case when p_approve then 'Organization approved' else 'Organization not approved' end,
      case when p_approve then o.name || ' can now publish events.' else coalesce(o.review_note, o.name) end,
      jsonb_build_object('org_id', p_org, 'approved', p_approve));
  end loop;
end $$;

-- Owners add existing users as organizers (by exact email).
create function public.add_org_member(p_org uuid, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not exists (select 1 from org_members where org_id = p_org and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_authorized';
  end if;
  select id into v_user from profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'user_not_found'; end if;
  insert into org_members (org_id, user_id, role) values (p_org, v_user, 'organizer')
  on conflict do nothing;
  return v_user;
end $$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
-- Organizers search existing users to invite: exact email, or name match (min 2 chars).
create function public.search_volunteers(p_org uuid, p_query text)
returns table (id uuid, full_name text, email text, city text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_manage_org(p_org) then raise exception 'not_authorized'; end if;
  if char_length(trim(p_query)) < 2 then return; end if;
  return query
    select p.id, p.full_name,
      case when lower(p.email) = lower(trim(p_query)) then p.email
           else regexp_replace(p.email, '^(.).*(@.*)$', '\1•••\2') end,
      p.city
    from profiles p
    where lower(p.email) = lower(trim(p_query))
       or p.full_name ilike '%' || trim(p_query) || '%'
    order by p.full_name
    limit 20;
end $$;

create function public.invite_to_task(p_task uuid, p_users uuid[], p_days integer default 7)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_user uuid; t seva_tasks; v_inserted uuid;
begin
  select * into t from seva_tasks where id = p_task;
  if t.id is null or not can_manage_org(task_org(p_task)) then raise exception 'not_authorized'; end if;
  if p_days not in (3, 7, 14) then raise exception 'invalid_expiry'; end if;
  foreach v_user in array p_users loop
    insert into task_invitations (task_id, invitee_id, invited_by, expires_at)
    values (p_task, v_user, auth.uid(), now() + make_interval(days => p_days))
    on conflict (task_id, invitee_id) do update
      set status = 'pending', expires_at = excluded.expires_at, invited_by = excluded.invited_by,
          responded_at = null
      where task_invitations.status in ('declined', 'expired', 'revoked')
    returning id into v_inserted;
    if v_inserted is not null then
      v_count := v_count + 1;
      perform notify(v_user, 'invited', 'You''re invited to a private seva', t.title,
        jsonb_build_object('task_id', p_task, 'invitation_id', v_inserted));
    end if;
    v_inserted := null;
  end loop;
  return v_count;
end $$;

create function public.decline_invitation(p_invitation uuid) returns void
language sql security definer set search_path = public as $$
  update task_invitations set status = 'declined', responded_at = now()
  where id = p_invitation and invitee_id = auth.uid() and status = 'pending';
$$;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------
create function public.publish_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where id = p_event for update;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  if e.status <> 'draft' then raise exception 'event_not_draft'; end if;
  if e.mode in ('onsite', 'hybrid') and coalesce(trim(e.address), '') = '' then
    raise exception 'venue_required';
  end if;
  if not exists (select 1 from seva_tasks where event_id = e.id) then
    raise exception 'task_required';
  end if;
  update events set status = 'published', published_at = now() where id = e.id;
  update seva_tasks set status = 'open' where event_id = e.id and status = 'draft';
  update seva_tasks t set status = 'full' where t.event_id = e.id and t.status = 'open' and task_remaining(t) = 0;
end $$;

-- ---------------------------------------------------------------------------
-- Public profile names (for "organized by", reviewer names, avatars)
-- ---------------------------------------------------------------------------
create view public.public_profiles as
  select id, full_name, avatar_url from public.profiles;
grant select on public.public_profiles to anon, authenticated;
