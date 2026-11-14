#!/usr/bin/env node
// Deploy Supabase Edge Functions through the Management API (no Docker or Supabase CLI needed).
//   SUPABASE_PROJECT_REF=xxxx SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deploy-functions.mjs [name ...]
import { readFileSync } from 'node:fs';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

// verify_jwt: false for endpoints called by Stripe or by visitors who are not signed in.
const FUNCTIONS = {
  'stripe-connect': { verify_jwt: true },
  'donate-checkout': { verify_jwt: false },
  'stripe-webhook': { verify_jwt: false },
  'send-push': { verify_jwt: false },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['stripe-connect', 'donate-checkout', 'stripe-webhook'];
for (const name of names) {
  const cfg = FUNCTIONS[name];
  if (!cfg) throw new Error(`unknown function ${name}`);
  const form = new FormData();
  form.append('metadata', JSON.stringify({ entrypoint_path: 'index.ts', name, verify_jwt: cfg.verify_jwt }));
  form.append('file', new Blob([readFileSync(`supabase/functions/${name}/index.ts`)], { type: 'application/typescript' }), 'index.ts');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${name}: ${res.status} ${text}`);
    process.exit(1);
  }
  const out = JSON.parse(text);
  console.log(`${name}: deployed (version ${out.version}, verify_jwt=${out.verify_jwt})`);
}
