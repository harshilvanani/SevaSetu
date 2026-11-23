-- Portability (ADR-003): the signed-in user's id, read straight from the request's JWT "sub" claim.
-- Supabase's auth.uid() is a Supabase-only function; PostgREST sets the same request.jwt.claims setting
-- whether the token comes from Supabase Auth or from AWS Cognito, so this works on both.
-- New SQL uses current_user_id(); existing auth.uid() calls are switched in one migration during the AWS move.
create or replace function public.current_user_id() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;
grant execute on function public.current_user_id() to anon, authenticated;
