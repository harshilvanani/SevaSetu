-- INSERT ... RETURNING evaluates SELECT policies against the new row. can_view_event(id) / can_view_task(id)
-- re-query the table using the statement's snapshot, which doesn't contain the row being inserted, so
-- organizers creating an event or task got "new row violates row-level security policy".
-- Check org membership from the row's own columns first.

create function public.event_org(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from events where id = p_event
$$;

drop policy events_select on public.events;
create policy events_select on public.events for select to anon, authenticated
  using (is_org_member(org_id) or can_view_event(id));

drop policy tasks_select on public.seva_tasks;
create policy tasks_select on public.seva_tasks for select to anon, authenticated
  using (is_org_member(event_org(event_id)) or can_view_task(id));
