-- Scheduled reminders, invitation expiry, and push delivery hook.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.assignments add column if not exists reminded_at timestamptz;

-- Notify volunteers ~24h before their seva starts (once per assignment).
create function public.send_seva_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select a.id, a.volunteer_id, t.title, coalesce(t.starts_at, e.starts_at) as starts_at, t.id as task_id
    from assignments a
    join seva_tasks t on t.id = a.task_id
    join events e on e.id = t.event_id
    where a.status = 'active' and a.reminded_at is null and e.status = 'published'
      and not (t.mode = 'virtual' and t.type = 'quantity' and t.starts_at is null)
      and coalesce(t.starts_at, e.starts_at) between now() and now() + interval '24 hours'
  loop
    perform notify(r.volunteer_id, 'reminder', 'Seva tomorrow: ' || r.title,
      to_char(r.starts_at at time zone 'UTC', 'Dy, Mon DD HH24:MI') || ' UTC',
      jsonb_build_object('task_id', r.task_id, 'assignment_id', r.id, 'starts_at', r.starts_at));
    update assignments set reminded_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_seva_reminders() from public, anon, authenticated;

create function public.expire_invitations() returns integer
language sql security definer set search_path = public as $$
  with x as (
    update task_invitations set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning 1
  ) select count(*)::int from x
$$;
revoke execute on function public.expire_invitations() from public, anon, authenticated;

select cron.schedule('sevasetu-reminders', '7 * * * *', $$select public.send_seva_reminders()$$);
select cron.schedule('sevasetu-expire-invitations', '17 3 * * *', $$select public.expire_invitations()$$);

-- Push: each new notification is POSTed to the `send-push` Edge Function, which looks up the user's
-- Expo push tokens and calls the Expo Push API. Inactive until two Vault secrets exist:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<a long random string>', 'push_webhook_secret');  -- also set as PUSH_WEBHOOK_SECRET on the function
create function public.trg_push_notification() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id, 'user_id', new.user_id, 'title', new.title, 'body', new.body, 'data', new.data || jsonb_build_object('type', new.type))
  );
  return new;
exception when others then
  -- Never block the originating action because push delivery failed.
  return new;
end $$;
revoke execute on function public.trg_push_notification() from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.trg_push_notification();
