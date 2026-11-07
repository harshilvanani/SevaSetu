-- Reminders are sent once per assignment for seva starting within 24h; stale invitations expire.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'remind@test.dev'),
  ('00000000-0000-0000-0000-0000000000d2', 'invitee@test.dev');
insert into organizations (id, name, status) values ('00000000-0000-0000-0000-0000000000dd', 'Remind Org', 'approved');
insert into events (id, org_id, title, starts_at, ends_at, mode, address, status, visibility) values
  ('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000dd', 'Soon', now() + interval '3 hours', now() + interval '5 hours', 'onsite', 'x', 'published', 'public');
insert into seva_tasks (id, event_id, title, type, positions, status) values
  ('00000000-0000-0000-0000-0000000000df', '00000000-0000-0000-0000-0000000000de', 'Greeter', 'role', 3, 'open');
insert into assignments (task_id, volunteer_id, claimed_qty) values
  ('00000000-0000-0000-0000-0000000000df', '00000000-0000-0000-0000-0000000000d1', 1);
insert into task_invitations (task_id, invitee_id, expires_at) values
  ('00000000-0000-0000-0000-0000000000df', '00000000-0000-0000-0000-0000000000d2', now() - interval '1 day');

select ok(send_seva_reminders() >= 1, 'reminder sent for seva starting soon');
select is((select count(*)::int from notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and type = 'reminder'), 1, 'one reminder notification');
select is(send_seva_reminders() - send_seva_reminders(), 0, 'reminders are not repeated');
select ok(expire_invitations() >= 1, 'expiry job reports expired invitations');
select is((select status::text from task_invitations where invitee_id = '00000000-0000-0000-0000-0000000000d2'), 'expired', 'stale invitation is marked expired');

select finish();
rollback;
