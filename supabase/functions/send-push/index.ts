// Supabase Edge Function: deliver a SevaSetu notification as an Expo push notification.
// Invoked by the notifications_push trigger (see migration 20261107000006_reminders_push.sql).
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: supabase secrets set PUSH_WEBHOOK_SECRET=<same value as the vault secret push_webhook_secret>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
import { createClient } from 'npm:@supabase/supabase-js@2';

type Payload = { notification_id: string; user_id: string; title: string; body: string; data: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as Payload;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: tokens, error } = await admin.from('push_tokens').select('token').eq('user_id', payload.user_id);
  if (error) return new Response(error.message, { status: 500 });
  if (!tokens?.length) return Response.json({ sent: 0 });

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: { ...payload.data, notification_id: payload.notification_id },
    sound: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json();

  // Drop tokens Expo reports as no longer registered.
  const tickets: { status: string; details?: { error?: string } }[] = result?.data ?? [];
  const stale = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter(Boolean) as string[];
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);

  return Response.json({ sent: messages.length, stale: stale.length });
});
