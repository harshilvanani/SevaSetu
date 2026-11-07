-- Self-service account deletion (required by the App Store).
-- Cascades remove the profile, availability, assignments, reports and notifications.
-- Sole owners must transfer or delete their organization first.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (
    select 1 from org_members m
    where m.user_id = v_uid and m.role = 'owner'
      and not exists (select 1 from org_members o where o.org_id = m.org_id and o.role = 'owner' and o.user_id <> v_uid)
  ) then
    raise exception 'sole_org_owner';
  end if;
  delete from auth.users where id = v_uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
