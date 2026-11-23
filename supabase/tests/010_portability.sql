-- current_user_id() returns the same user as auth.uid() today, and works for any token that carries "sub".
begin;
select plan(4);

select is(current_user_id(), null, 'no token: no user');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000010a1","role":"authenticated"}', true);
select is(current_user_id(), '00000000-0000-0000-0000-0000000010a1'::uuid, 'reads sub from the JWT claims');
select is(current_user_id(), auth.uid(), 'same answer as auth.uid() on Supabase');

-- A Cognito-style token: extra claims, same sub
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000010a2","token_use":"access","client_id":"abc","cognito:groups":["admins"],"role":"authenticated"}', true);
select is(current_user_id(), '00000000-0000-0000-0000-0000000010a2'::uuid, 'works with Cognito access tokens');

select * from finish();
rollback;
