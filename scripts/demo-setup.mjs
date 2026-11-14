#!/usr/bin/env node
// One-time (and repeatable) demo setup: creates the three demo logins if missing, then rebuilds the demo content.
//   SUPABASE_PROJECT_REF=xxxx SUPABASE_ACCESS_TOKEN=sbp_... node scripts/demo-setup.mjs
// Demo users get random passwords that only super admins can read (Admin console -> Demo mode).
import { randomBytes, randomUUID } from 'node:crypto';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const lit = (s) => `'${s.replaceAll("'", "''")}'`;
const personas = [
  ['volunteer', 'demo.volunteer@sevasetu.demo', 'Priya Sharma (demo volunteer)'],
  ['volunteer2', 'demo.volunteer2@sevasetu.demo', 'Arjun Patel (demo volunteer)'],
  ['organizer', 'demo.organizer@sevasetu.demo', 'Meera Nair (demo organizer)'],
];

const existing = new Set((await query('select persona from public.demo_accounts')).map((r) => r.persona));
for (const [persona, email, name] of personas) {
  if (existing.has(persona)) continue;
  const id = randomUUID();
  const password = randomBytes(18).toString('base64url');
  await query(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', ${lit(id)}, 'authenticated', 'authenticated', ${lit(email)},
      extensions.crypt(${lit(password)}, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', ${lit(name)}), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), ${lit(id)}, ${lit(id)},
      jsonb_build_object('sub', ${lit(id)}, 'email', ${lit(email)}, 'email_verified', true), 'email', now(), now(), now());
    insert into public.demo_accounts (persona, user_id, email, password) values (${lit(persona)}, ${lit(id)}, ${lit(email)}, ${lit(password)});
  `);
  console.log(`created ${persona}`);
}
await query('select public.reset_demo_data()');
console.log('demo content ready');
