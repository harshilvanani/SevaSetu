// Supabase Edge Function: connect an organization's own Stripe account (Stripe Connect, Accounts v2).
// POST { org_id, action: 'link' | 'status' }  (signed-in organizer of an approved organization)
//   link   → creates the connected account if needed and returns { url } for Stripe's onboarding page
//   status → refreshes and returns { connected, charges_enabled, details_submitted }
// The organization keeps its own full Stripe Dashboard; Stripe collects fees and handles losses (dashboard "full").
// Secrets: STRIPE_SECRET_KEY (sk_test_... while testing). SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_VERSION = '2026-10-28.endive';
const ALLOWED_ORIGINS = ['https://darkgrey-salamander-510696.hostingersite.com', 'http://localhost:8081'];
const extra = () => (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const allowed = (origin: string) => [...ALLOWED_ORIGINS, ...extra()].includes(origin);
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return reply({ error: 'stripe_not_configured' }, 503);
    const stripe = async (path: string, init: { method?: string; body?: unknown; query?: [string, string][] } = {}) => {
      const qs = init.query?.length ? `?${new URLSearchParams(init.query)}` : '';
      const res = await fetch(`https://api.stripe.com/v2${path}${qs}`, {
        method: init.method ?? 'GET',
        headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION, 'Content-Type': 'application/json' },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
      return json;
    };

    const auth = req.headers.get('authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: who } = await userClient.auth.getUser();
    if (!who.user) return reply({ error: 'not_authenticated' }, 401);

    const { org_id, action } = (await req.json().catch(() => ({}))) as { org_id?: string; action?: string };
    if (!org_id || (action !== 'link' && action !== 'status')) return reply({ error: 'bad_request' }, 400);
    const { data: canManage } = await userClient.rpc('can_manage_org', { p_org: org_id });
    if (!canManage) return reply({ error: 'not_authorized' }, 403);
    // Bank details are entered in Stripe's onboarding, so only an owner of the organization may open it.
    const { data: member } = await admin.from('org_members').select('role').eq('org_id', org_id).eq('user_id', who.user.id).maybeSingle();
    if (action === 'link' && member?.role !== 'owner') return reply({ error: 'owner_only' }, 403);
    const { data: org } = await admin.from('organizations').select('id, name, is_demo').eq('id', org_id).single();
    if (!org || org.is_demo) return reply({ error: 'not_available' }, 403);

    const { data: existing } = await admin.from('org_payments').select('*').eq('org_id', org_id).maybeSingle();
    let accountId = existing?.stripe_account_id as string | undefined;

    // Can the account take card payments yet? (merchant configuration, card_payments capability)
    const refresh = async (id: string) => {
      const acct = await stripe(`/core/accounts/${id}`, { query: [['include', 'configuration.merchant']] });
      const status = acct?.configuration?.merchant?.capabilities?.card_payments?.status as string | undefined;
      const charges = status === 'active';
      const submitted = status === 'active' || status === 'pending';
      await admin.from('org_payments').update({ charges_enabled: charges, details_submitted: submitted, updated_at: new Date().toISOString() }).eq('org_id', org_id);
      return { connected: true, charges_enabled: charges, details_submitted: submitted };
    };

    if (action === 'status') {
      if (!accountId) return reply({ connected: false, charges_enabled: false, details_submitted: false });
      return reply(await refresh(accountId));
    }

    if (!accountId) {
      const acct = await stripe('/core/accounts', {
        method: 'POST',
        body: {
          display_name: org.name,
          contact_email: who.user.email,
          identity: { country: 'CA' },
          dashboard: 'full',
          defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
          metadata: { org_id },
        },
      });
      accountId = acct.id as string;
      await admin.from('org_payments').upsert({ org_id, stripe_account_id: accountId, updated_at: new Date().toISOString() });
    }
    const base = origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0];
    const link = await stripe('/core/account_links', {
      method: 'POST',
      body: {
        account: accountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            refresh_url: `${base}/donations?stripe=refresh`,
            return_url: `${base}/donations?stripe=return`,
          },
        },
      },
    });
    return reply({ url: link.url });
  } catch (e) {
    // Keep the CORS headers on failures so the browser can read the error.
    console.error(e);
    return reply({ error: 'stripe_error', message: e instanceof Error ? e.message : String(e) }, 502);
  }
});
