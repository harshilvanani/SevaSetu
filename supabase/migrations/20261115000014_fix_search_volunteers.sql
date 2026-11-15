-- "Invite someone" search failed with "column reference id is ambiguous" since the demo-mode change
-- (the function's output column "id" clashed with organizations.id). Found by the security regression run.
create or replace function public.search_volunteers(p_org uuid, p_query text)
returns table (id uuid, full_name text, email text, city text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_demo boolean;
begin
  if not can_manage_org(p_org) then raise exception 'not_authorized'; end if;
  if char_length(trim(p_query)) < 2 then return; end if;
  select o.is_demo into v_demo from organizations o where o.id = p_org;
  return query
    select p.id, p.full_name,
      case when lower(p.email) = lower(trim(p_query)) then p.email
           else regexp_replace(p.email, '^(.).*(@.*)$', '\1•••\2') end,
      p.city
    from profiles p
    where p.is_demo = v_demo and p.blocked_at is null
      and (lower(p.email) = lower(trim(p_query)) or p.full_name ilike '%' || trim(p_query) || '%')
    order by p.full_name
    limit 20;
end $$;
