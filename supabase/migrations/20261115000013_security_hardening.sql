-- Security hardening after the November 2026 review. See docs/security-review-2026-11.md.

-- ---------------------------------------------------------------------------
-- 1. public_profiles was writable by every signed-in user (and bypassed row security),
--    and listed every user's id and name to visitors.
--    Now: read-only, and only organizers of approved organizations (the names shown publicly as
--    "organized by" / "reviewed by"), yourself, or everyone when the caller is a platform admin.
-- ---------------------------------------------------------------------------
create or replace view public.public_profiles as
  select p.id, p.full_name, p.avatar_url
  from public.profiles p
  where p.id = auth.uid()
     or public.is_platform_admin()
     or exists (
       select 1 from public.org_members m join public.organizations o on o.id = m.org_id
       where m.user_id = p.id and o.status = 'approved'
     );
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- Nobody using the API needs TRUNCATE / REFERENCES / TRIGGER on any table.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Organizers could read any user's full profile (email, exact location) just by inviting them.
--    Now a profile opens to an organizer only when that person came to them:
--    joined one of their seva, asked to join / was approved for their event, or accepted an invitation.
-- ---------------------------------------------------------------------------
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
  )
$$;

-- Names (only) for the organizer's "Requests and invitations" list, including people who are just invited.
create function public.event_access_people(p_event uuid)
returns table (user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_manage_org(event_org(p_event)) then raise exception 'not_authorized'; end if;
  return query
    select x.user_id, coalesce(nullif(p.full_name, ''), '—')
    from event_access x join profiles p on p.id = x.user_id
    where x.event_id = p_event;
end $$;

-- The old per-seva invitation function is no longer used by the app.
revoke execute on function public.invite_to_task(uuid, uuid[], integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Organizers could set any event status directly (undo an admin's cancellation, skip the hours step).
--    Direct API updates may now only cancel a draft or published event; everything else goes through
--    publish_event / complete_event / reopen_event / admin_cancel_event.
-- ---------------------------------------------------------------------------
create function public.trg_event_status_guard() returns trigger
language plpgsql as $$
begin
  -- Inside the RPCs current_user is the function owner; a direct API call runs as the API role.
  if current_user in ('authenticated', 'anon')
     and new.status is distinct from old.status
     and not (new.status = 'cancelled' and old.status in ('draft', 'published')) then
    raise exception 'invalid_status_change';
  end if;
  return new;
end $$;
create trigger events_status_guard before update of status on public.events
  for each row execute function public.trg_event_status_guard();

-- Approved organizations can no longer rename or re-describe themselves without review
-- (a rejected organization still edits through resubmit_organization).
revoke update on public.organizations from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. "Remove access" on a private event did not remove it for anyone who had ever joined a seva.
-- ---------------------------------------------------------------------------
create or replace function public.has_event_access(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_access a where a.event_id = p_event and a.user_id = auth.uid()
      and (a.status = 'approved' or (a.status = 'invited' and (a.expires_at is null or a.expires_at > now())))
  ) or (
    not exists (select 1 from event_access r where r.event_id = p_event and r.user_id = auth.uid() and r.status = 'revoked')
    and (
      exists (
        select 1 from assignments a join seva_tasks t on t.id = a.task_id
        where t.event_id = p_event and a.volunteer_id = auth.uid() and a.status <> 'cancelled'
      ) or exists (
        select 1 from task_invitations i join seva_tasks t on t.id = i.task_id
        where t.event_id = p_event and i.invitee_id = auth.uid()
          and (i.status = 'accepted' or (i.status = 'pending' and i.expires_at > now()))
      )
    )
  )
$$;

-- Removing access also releases the person's open spots in that event (work already reported is kept).
create or replace function public.revoke_event_access(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where id = p_event;
  if e.id is null or not can_manage_org(e.org_id) then raise exception 'not_authorized'; end if;
  -- only people who actually have a request, an invitation or a spot in this event
  if not exists (select 1 from event_access where event_id = p_event and user_id = p_user)
     and not exists (select 1 from assignments a join seva_tasks t on t.id = a.task_id
                     where t.event_id = p_event and a.volunteer_id = p_user and a.status <> 'cancelled') then
    return;
  end if;
  insert into event_access (event_id, user_id, status, responded_at)
  values (p_event, p_user, 'revoked', now())
  on conflict (event_id, user_id) do update set status = 'revoked', responded_at = now();
  update assignments a set status = 'cancelled', cancelled_at = now()
   where a.volunteer_id = p_user and a.status = 'active'
     and a.task_id in (select id from seva_tasks where event_id = p_event)
     and not exists (select 1 from progress_reports r where r.assignment_id = a.id);
  perform notify(p_user, 'event_declined', 'Access removed: ' || e.title, '', jsonb_build_object('event_id', p_event));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Functions: visitors (not signed in) may only run what the public pages need.
-- ---------------------------------------------------------------------------
do $$
declare f record; had boolean;
begin
  for f in
    select p.oid, p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    had := has_function_privilege('authenticated', f.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', f.sig);
    if had then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
-- Used by the row-security rules of tables visitors can read (events, seva, organizations, campaigns).
grant execute on function public.is_org_member(uuid) to anon;
grant execute on function public.is_platform_admin() to anon;
grant execute on function public.is_demo_user(uuid) to anon;
grant execute on function public.can_manage_org(uuid) to anon;
grant execute on function public.can_view_event(uuid) to anon;
grant execute on function public.can_view_task(uuid) to anon;
grant execute on function public.event_org(uuid) to anon;
grant execute on function public.org_accepts_donations(uuid) to anon;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function public.event_access_people(uuid) from public, anon;
grant execute on function public.event_access_people(uuid) to authenticated;
