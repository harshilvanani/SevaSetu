-- Row level security + column privileges.
-- Workflow mutations (join, report, review, invite, publish, org approval) happen only via RPCs.

alter table public.profiles enable row level security;
alter table public.availability_slots enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.events enable row level security;
alter table public.event_private_details enable row level security;
alter table public.seva_tasks enable row level security;
alter table public.task_invitations enable row level security;
alter table public.assignments enable row level security;
alter table public.progress_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Organizer can see a user's profile when that user participates in / is invited to their org's tasks.
create function public.can_see_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or is_platform_admin() or exists (
    select 1 from assignments a where a.volunteer_id = p_user and can_manage_org(task_org(a.task_id))
  ) or exists (
    select 1 from task_invitations i where i.invitee_id = p_user and can_manage_org(task_org(i.task_id))
  ) or exists (
    select 1 from org_members m1 join org_members m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = p_user
  )
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (can_see_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, city, latitude, longitude, radius_km, interests, skills,
  serve_mode, hours_per_week, locale, onboarded_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- availability
-- ---------------------------------------------------------------------------
create policy availability_own on public.availability_slots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy organizations_select on public.organizations for select to anon, authenticated
  using (status = 'approved' or is_org_member(id) or is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (exists (select 1 from org_members m where m.org_id = id and m.user_id = auth.uid() and m.role = 'owner'));

revoke insert, update, delete on public.organizations from anon, authenticated;
grant update (name, city, description, logo_url) on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- org_members
-- ---------------------------------------------------------------------------
create policy org_members_select on public.org_members for select to authenticated
  using (user_id = auth.uid() or is_org_member(org_id) or is_platform_admin());
create policy org_members_delete on public.org_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from org_members m where m.org_id = org_members.org_id
               and m.user_id = auth.uid() and m.role = 'owner' and org_members.role <> 'owner')
  );
revoke insert, update on public.org_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy events_select on public.events for select to anon, authenticated
  using (can_view_event(id));
create policy events_insert on public.events for insert to authenticated
  with check (can_manage_org(org_id) and status = 'draft');
create policy events_update on public.events for update to authenticated
  using (can_manage_org(org_id))
  -- publishing goes through publish_event(); organizers may cancel/complete directly
  with check (can_manage_org(org_id) and (status <> 'published' or published_at is not null));
create policy events_delete on public.events for delete to authenticated
  using (can_manage_org(org_id) and status = 'draft');

revoke update on public.events from anon, authenticated;
grant update (title, description, starts_at, ends_at, mode, venue_name, address, city, latitude,
  longitude, visibility, status) on public.events to authenticated;

create policy event_private_select on public.event_private_details for select to authenticated
  using (is_org_member((select org_id from events where id = event_id)) or is_event_participant(event_id));
create policy event_private_write on public.event_private_details for all to authenticated
  using (can_manage_org((select org_id from events where id = event_id)))
  with check (can_manage_org((select org_id from events where id = event_id)));

-- ---------------------------------------------------------------------------
-- seva_tasks
-- ---------------------------------------------------------------------------
create policy tasks_select on public.seva_tasks for select to anon, authenticated
  using (can_view_task(id));
create policy tasks_insert on public.seva_tasks for insert to authenticated
  with check (can_manage_org((select org_id from events where id = event_id))
              and status in ('draft', 'open'));
create policy tasks_update on public.seva_tasks for update to authenticated
  using (can_manage_org((select org_id from events where id = event_id)))
  with check (can_manage_org((select org_id from events where id = event_id)));
create policy tasks_delete on public.seva_tasks for delete to authenticated
  using (can_manage_org((select org_id from events where id = event_id)) and volunteers_count = 0);

-- Counters are trigger-maintained only.
revoke insert, update on public.seva_tasks from anon, authenticated;
grant insert (event_id, title, description, instructions, steps, category, type, target_qty, unit,
  max_per_volunteer, max_volunteers, minutes_per_unit, positions, starts_at, ends_at,
  signup_deadline, mode, visibility, status, created_by) on public.seva_tasks to authenticated;
grant update (title, description, instructions, steps, category, target_qty, unit,
  max_per_volunteer, max_volunteers, minutes_per_unit, positions, starts_at, ends_at,
  signup_deadline, mode, visibility, status) on public.seva_tasks to authenticated;

-- Capacity can't be lowered below what's already claimed.
create function public.trg_task_capacity_guard() returns trigger
language plpgsql as $$
begin
  if new.type = 'quantity' and new.target_qty < new.claimed_total then
    raise exception 'target_below_claimed';
  end if;
  if new.type = 'role' and new.positions < new.volunteers_count then
    raise exception 'positions_below_filled';
  end if;
  if new.type <> old.type and old.volunteers_count > 0 then
    raise exception 'type_locked';
  end if;
  return new;
end $$;
create trigger seva_tasks_capacity_guard before update on public.seva_tasks
  for each row execute function public.trg_task_capacity_guard();

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
create policy invitations_select on public.task_invitations for select to authenticated
  using (invitee_id = auth.uid() or can_manage_org(task_org(task_id)));
create policy invitations_revoke on public.task_invitations for update to authenticated
  using (can_manage_org(task_org(task_id)))
  with check (can_manage_org(task_org(task_id)) and status = 'revoked');
revoke insert, update, delete on public.task_invitations from anon, authenticated;
grant update (status) on public.task_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- assignments & reports (read-only; writes via RPC)
-- ---------------------------------------------------------------------------
create policy assignments_select on public.assignments for select to authenticated
  using (volunteer_id = auth.uid() or can_manage_org(task_org(task_id)));
revoke insert, update, delete on public.assignments from anon, authenticated;

create policy reports_select on public.progress_reports for select to authenticated
  using (exists (
    select 1 from assignments a where a.id = assignment_id
      and (a.volunteer_id = auth.uid() or can_manage_org(task_org(a.task_id)))
  ));
revoke insert, update, delete on public.progress_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- notifications & push tokens
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Anonymous visitors only ever read public data.
revoke insert, update, delete on all tables in schema public from anon;
revoke all on public.profiles, public.availability_slots, public.org_members, public.task_invitations,
  public.assignments, public.progress_reports, public.notifications, public.push_tokens,
  public.event_private_details from anon;

-- Internal trigger/helper functions are not part of the API.
revoke execute on function public.trg_assignment_counters() from public, anon, authenticated;
revoke execute on function public.trg_report_counters() from public, anon, authenticated;
revoke execute on function public.trg_task_capacity_guard() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
