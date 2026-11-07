-- Organizer write paths as the authenticated role (regression: INSERT ... RETURNING under RLS).
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'org2@test.dev', '{"full_name":"Org Two"}'),
  ('00000000-0000-0000-0000-0000000000b9', 'vol9@test.dev', '{"full_name":"Vol Nine"}');
insert into organizations (id, name, status) values ('00000000-0000-0000-0000-0000000000a0', 'Writes Org', 'approved');
insert into org_members (org_id, user_id, role) values ('00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a2', 'owner');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

create temp table _ids(kind text, id uuid) on commit drop;

select lives_ok($$
  with e as (
    insert into events (org_id, title, starts_at, ends_at, mode, address)
    values ('00000000-0000-0000-0000-0000000000a0', 'Draft drive', now() + interval '2 days', now() + interval '2 days 2 hours', 'onsite', '1 Main St')
    returning id)
  insert into _ids select 'event', id from e
$$, 'organizer inserts an event with RETURNING');

select lives_ok($$
  with t as (
    insert into seva_tasks (event_id, title, type, target_qty, unit, max_per_volunteer)
    select id, 'Pack boxes', 'quantity', 20, 'boxes', 5 from _ids where kind = 'event'
    returning id)
  insert into _ids select 'task', id from t
$$, 'organizer inserts a task with RETURNING');

select throws_ok($$ update seva_tasks set claimed_total = 99 $$, '42501', null, 'counters are not client-writable');
select lives_ok($$ select publish_event((select id from _ids where kind = 'event')) $$, 'organizer publishes');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from seva_tasks where id = (select id from _ids where kind = 'task')), 1, 'volunteer sees the published task');
select throws_ok($$ insert into events (org_id, title, starts_at, ends_at) values ('00000000-0000-0000-0000-0000000000a0', 'x', now(), now() + interval '1 hour') $$,
  '42501', null, 'non-member cannot create events');

select finish();
rollback;
