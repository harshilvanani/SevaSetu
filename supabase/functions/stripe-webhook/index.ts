// Supabase Edge Function: Stripe Connect webhook. Public, verified by Stripe's signature.
// Stripe → Developers → Webhooks → add endpoint (listen to events on Connected accounts):
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   events: checkout.session.completed, checkout.session.expired, invoice.paid, charge.refunded, account.updated
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_...). Deploy with verify_jwt = false.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!key || !secret) return new Response('stripe not configured', { status: 503 });
  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') ?? '', secret, undefined,
      Stripe.createSubtleCryptoProvider());
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = new Date().toISOString();

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const id = s.metadata?.donation_id;
      if (id && (s.payment_status === 'paid' || s.mode === 'subscription')) {
        await admin.from('donations').update({
          status: 'paid', paid_at: now,
          stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null,
          stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
        }).eq('id', id).eq('status', 'pending');
      }
      break;
    }
    case 'checkout.session.expired': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.donation_id) await admin.from('donations').update({ status: 'failed' }).eq('id', s.metadata.donation_id).eq('status', 'pending');
      break;
    }
    case 'invoice.paid': {
      // Later monthly payments: the first one is recorded by checkout.session.completed.
      const inv = event.data.object as Stripe.Invoice;
      const sub = typeof inv.subscription === 'string' ? inv.subscription : null;
      if (!sub || inv.billing_reason === 'subscription_create') break;
      const { data: first } = await admin.from('donations').select('*').eq('stripe_subscription_id', sub).order('created_at').limit(1).maybeSingle();
      if (!first) break;
      await admin.from('donations').upsert({
        campaign_id: first.campaign_id, org_id: first.org_id, donor_id: first.donor_id, donor_name: first.donor_name,
        donor_email: first.donor_email, amount_cents: first.amount_cents, fee_cents: first.fee_cents, interval: 'month',
        status: 'paid', paid_at: now, stripe_subscription_id: sub, stripe_invoice_id: inv.id,
        stripe_payment_intent: typeof inv.payment_intent === 'string' ? inv.payment_intent : null,
      }, { onConflict: 'stripe_invoice_id', ignoreDuplicates: true });
      break;
    }
    case 'charge.refunded': {
      const ch = event.data.object as Stripe.Charge;
      if (typeof ch.payment_intent === 'string' && ch.refunded) {
        await admin.from('donations').update({ status: 'refunded' }).eq('stripe_payment_intent', ch.payment_intent);
      }
      break;
    }
    case 'account.updated': {
      const acct = event.data.object as Stripe.Account;
      await admin.from('org_payments').update({
        charges_enabled: acct.charges_enabled, details_submitted: acct.details_submitted, updated_at: now,
      }).eq('stripe_account_id', acct.id);
      break;
    }
  }
  return Response.json({ received: true });
});
