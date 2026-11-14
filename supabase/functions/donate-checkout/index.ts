// Supabase Edge Function: start a Stripe Checkout for a donation. Public (no sign-in needed).
// POST { campaign_id, amount_cents, monthly, cover_fees, name, email } → { url }
// The payment is created on the organization's own Stripe account (Connect direct charge), in CAD.
// Secrets: STRIPE_SECRET_KEY. Deploy with verify_jwt = false.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

const ALLOWED_ORIGINS = ['https://darkgrey-salamander-510696.hostingersite.com', 'http://localhost:8081'];
const extra = () => (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const allowed = (origin: string) => [...ALLOWED_ORIGINS, ...extra()].includes(origin);
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

// Same as src/domain/donations.ts
const MIN = 200;
const MAX = 10_000_000;
const coverFeeCents = (amount: number) => Math.ceil((amount + 30) / (1 - 0.029)) - amount;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => ({}))) as {
    campaign_id?: string; amount_cents?: number; monthly?: boolean; cover_fees?: boolean; name?: string; email?: string;
  };
  const amount = Math.round(Number(body.amount_cents));
  const email = (body.email ?? '').trim();
  const name = (body.name ?? '').trim().slice(0, 120);
  if (!body.campaign_id || !Number.isFinite(amount) || amount < MIN || amount > MAX) return reply({ error: 'invalid_amount' }, 400);
  if (!EMAIL.test(email) || !name) return reply({ error: 'invalid_donor' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: campaign } = await admin
    .from('donation_campaigns')
    .select('id, org_id, title, status, allow_monthly, allow_cover_fees, organizations!inner(status, is_demo)')
    .eq('id', body.campaign_id)
    .maybeSingle();
  const org = campaign?.organizations as unknown as { status: string; is_demo: boolean } | undefined;
  if (!campaign || campaign.status !== 'active' || !org || org.status !== 'approved' || org.is_demo) return reply({ error: 'not_accepting' }, 409);
  const { data: pay } = await admin.from('org_payments').select('stripe_account_id, charges_enabled').eq('org_id', campaign.org_id).maybeSingle();
  if (!pay?.stripe_account_id || !pay.charges_enabled) return reply({ error: 'not_accepting' }, 409);

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return reply({ error: 'stripe_not_configured' }, 503);
  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

  // A signed-in donor is linked to their profile (the anon key alone is not a user).
  let donorId: string | null = null;
  const auth = req.headers.get('authorization');
  if (auth) {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data } = await userClient.auth.getUser();
    donorId = data.user?.id ?? null;
  }

  const monthly = !!body.monthly && campaign.allow_monthly;
  const fee = body.cover_fees && campaign.allow_cover_fees ? coverFeeCents(amount) : 0;
  const { data: donation, error } = await admin
    .from('donations')
    .insert({ campaign_id: campaign.id, org_id: campaign.org_id, donor_id: donorId, donor_name: name, donor_email: email,
      amount_cents: amount, fee_cents: fee, interval: monthly ? 'month' : 'one_time' })
    .select('id')
    .single();
  if (error) return reply({ error: 'server_error' }, 500);

  const base = origin && allowed(origin) ? origin : ALLOWED_ORIGINS[0];
  const metadata = { donation_id: donation.id, campaign_id: campaign.id, org_id: campaign.org_id };
  const session = await stripe.checkout.sessions.create(
    {
      mode: monthly ? 'subscription' : 'payment',
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: amount + fee,
          product_data: { name: campaign.title },
          ...(monthly ? { recurring: { interval: 'month' as const } } : {}),
        },
      }],
      ...(monthly ? { subscription_data: { metadata } } : { submit_type: 'donate' as const, payment_intent_data: { metadata } }),
      metadata,
      success_url: `${base}/give/${campaign.id}?thanks=1`,
      cancel_url: `${base}/give/${campaign.id}`,
    },
    { stripeAccount: pay.stripe_account_id },
  );
  await admin.from('donations').update({ stripe_session_id: session.id }).eq('id', donation.id);
  return reply({ url: session.url });
});
