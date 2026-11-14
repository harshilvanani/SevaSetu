-- Organizers can see the name of people who asked to join (or were invited to) their events.
create or replace function public.can_see_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or is_platform_admin() or exists (
    select 1 from assignments a where a.volunteer_id = p_user and can_manage_org(task_org(a.task_id))
  ) or exists (
    select 1 from task_invitations i where i.invitee_id = p_user and can_manage_org(task_org(i.task_id))
  ) or exists (
    select 1 from event_access x where x.user_id = p_user and can_manage_org(event_org(x.event_id))
  ) or exists (
    select 1 from org_members m1 join org_members m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = p_user
  )
$$;
