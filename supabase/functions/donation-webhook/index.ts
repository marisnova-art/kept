// Supabase Edge Function — records voluntary contributions from Stripe into public.donations.
// Deploy:  supabase functions deploy donation-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe:  Developers → Webhooks → add https://<project>.supabase.co/functions/v1/donation-webhook
//          events: checkout.session.completed, invoice.paid
// Linking to an account: the app appends ?client_reference_id=<user id> to your Payment Link
// (KEPT_CONFIG.DONATE.userParam). Later monthly invoices are matched by the Stripe customer id.
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); // server-side only, never in the app
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature")!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (e) {
    return new Response(`bad signature: ${e}`, { status: 400 });
  }
  let row: Record<string, unknown> | null = null;
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const user_id = s.client_reference_id && UUID.test(s.client_reference_id) ? s.client_reference_id : null;
    if (s.mode === "payment" && s.payment_status === "paid") {
      row = { provider: "stripe", provider_ref: s.id, provider_customer: (s.customer as string) ?? null, kind: "once", amount: (s.amount_total ?? 0) / 100, currency: (s.currency ?? "usd").toUpperCase(), user_id };
    } else if (s.mode === "subscription" && user_id && s.customer) {
      // remember which account owns this subscription so invoice.paid can be attributed
      await admin.from("donation_customers").upsert({ provider_customer: s.customer as string, user_id });
    }
  } else if (event.type === "invoice.paid") {
    const inv = event.data.object as Stripe.Invoice;
    const { data } = await admin.from("donation_customers").select("user_id").eq("provider_customer", inv.customer as string).maybeSingle();
    row = { provider: "stripe", provider_ref: inv.id, provider_customer: inv.customer as string, kind: "monthly", amount: (inv.amount_paid ?? 0) / 100, currency: (inv.currency ?? "usd").toUpperCase(), user_id: data?.user_id ?? null };
  }
  if (row && (row.amount as number) > 0) {
    const { error } = await admin.from("donations").upsert(row, { onConflict: "provider_ref" });
    if (error) return new Response(error.message, { status: 500 });
  }
  return new Response("ok");
});
