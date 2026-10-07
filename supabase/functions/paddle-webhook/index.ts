// Kept — Paddle Billing webhook → public.subscriptions
// Deploy:  supabase functions deploy paddle-webhook --no-verify-jwt
// Secrets: supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_… PADDLE_PRICE_MONTHLY=pri_… PADDLE_PRICE_YEARLY=pri_…
// Paddle → Developer tools → Notifications → new destination:
//   URL https://<project>.supabase.co/functions/v1/paddle-webhook
//   events: subscription.created, subscription.updated, subscription.activated, subscription.canceled,
//           subscription.past_due, subscription.paused, subscription.resumed, subscription.trialing
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? '';
const PRICE_MONTHLY = Deno.env.get('PADDLE_PRICE_MONTHLY') ?? '';
const PRICE_YEARLY = Deno.env.get('PADDLE_PRICE_YEARLY') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* Paddle-Signature: "ts=1671552777;h1=eb4d0dc8…" — HMAC-SHA256 of `${ts}:${rawBody}` with the destination's secret */
async function verify(raw: string, header: string | null) {
  if (!SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(';').map(p => p.split('=') as [string, string]));
  const ts = parts.ts; const sigs = header.split(';').filter(p => p.startsWith('h1=')).map(p => p.slice(3));
  if (!ts || !sigs.length || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5 min replay window
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${raw}`)));
  return sigs.some(s => safeEqual(s, mac));
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get('paddle-signature')))) return new Response('bad signature', { status: 401 });
  let ev: any; try { ev = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  if (!String(ev.event_type || '').startsWith('subscription.')) return new Response('ignored', { status: 200 });

  const s = ev.data ?? {};
  const priceId: string | undefined = s.items?.[0]?.price?.id;
  const plan = priceId === PRICE_YEARLY ? 'yearly' : priceId === PRICE_MONTHLY ? 'monthly' : (s.billing_cycle?.interval === 'year' ? 'yearly' : 'monthly');
  const userId = typeof s.custom_data?.user_id === 'string' && UUID.test(s.custom_data.user_id) ? s.custom_data.user_id : null;

  // events can arrive out of order: never let an older event overwrite a newer one
  const { data: prev } = await db.from('subscriptions').select('event_at,user_id').eq('subscription_id', s.id).maybeSingle();
  if (prev?.event_at && ev.occurred_at && new Date(prev.event_at) > new Date(ev.occurred_at)) return new Response('stale', { status: 200 });

  const row = {
    subscription_id: s.id,
    user_id: prev?.user_id ?? userId,
    customer_id: s.customer_id ?? null,
    status: s.status,
    plan, price_id: priceId ?? null, currency: s.currency_code ?? null,
    current_period_end: s.current_billing_period?.ends_at ?? null,
    cancel_at: s.scheduled_change?.action === 'cancel' ? s.scheduled_change.effective_at : (s.canceled_at ?? null),
    update_payment_url: s.management_urls?.update_payment_method ?? null,
    cancel_url: s.management_urls?.cancel ?? null,
    event_at: ev.occurred_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'subscription_id' });
  if (error) { console.error(error); return new Response('db error', { status: 500 }); } // Paddle retries
  return new Response('ok', { status: 200 });
});
