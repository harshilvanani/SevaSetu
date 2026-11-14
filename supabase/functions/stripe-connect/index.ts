// Supabase Edge Function: connect an organization's own Stripe account (Stripe Connect, Standard accounts).
// POST { org_id, action: 'link' | 'status' }  (signed-in organizer of an approved organization)
//   link   → returns { url } for Stripe's onboarding page
//   status → refreshes and returns { connected, charges_enabled, details_submitted }
// Secrets: STRIPE_SECRET_KEY (sk_test_... while testing). SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

const ALLOWED_ORIGINS = ['https://darkgrey-salamander-510696.hostingersite.com', 'http://localhost:8081'];
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const extra = () => (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const allowed = (origin: string) => [...ALLOWED_ORIGINS, ...extra()].includes(origin);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return reply({ error: 'stripe_not_configured' }, 503);
  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

  const auth = req.headers.get('authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: who } = await userClient.auth.getUser();
  if (!who.user) return reply({ error: 'not_authenticated' }, 401);

  const { org_id, action } = (await req.json().catch(() => ({}))) as { org_id?: string; action?: string };
  if (!org_id || (action !== 'link' && action !== 'status')) return reply({ error: 'bad_request' }, 400);
  const { data: canManage } = await userClient.rpc('can_manage_org', { p_org: org_id });
  if (!canManage) return reply({ error: 'not_authorized' }, 403);
  const { data: org } = await admin.from('organizations').select('id, name, is_demo').eq('id', org_id).single();
  if (!org || org.is_demo) return reply({ error: 'not_available' }, 403);

  const { data: existing } = await admin.from('org_payments').select('*').eq('org_id', org_id).maybeSingle();
  let accountId = existing?.stripe_account_id as string | undefined;

  if (action === 'status') {
    if (!accountId) return reply({ connected: false, charges_enabled: false, details_submitted: false });
    const acct = await stripe.accounts.retrieve(accountId);
    await admin.from('org_payments').update({
      charges_enabled: acct.charges_enabled, details_submitted: acct.details_submitted, updated_at: new Date().toISOString(),
    }).eq('org_id', org_id);
    return reply({ connected: true, charges_enabled: acct.charges_enabled, details_submitted: acct.details_submitted });
  }

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'standard',
      country: 'CA',
      email: who.user.email,
      business_profile: { name: org.name },
      metadata: { org_id },
    });
    accountId = acct.id;
    await admin.from('org_payments').upsert({ org_id, stripe_account_id: accountId, updated_at: new Date().toISOString() });
  }
  const base = origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0];
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/donations?stripe=refresh`,
    return_url: `${base}/donations?stripe=return`,
    type: 'account_onboarding',
  });
  return reply({ url: link.url });
});
