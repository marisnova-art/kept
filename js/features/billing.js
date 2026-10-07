/* Kept — Subscription with Paddle Billing (Free · monthly · yearly).
   Checkout runs in Paddle's overlay; Paddle is the merchant of record, so Kept never sees card details.
   The subscription itself is written by the paddle-webhook Edge Function (supabase/functions/paddle-webhook)
   into public.subscriptions, which the app reads back. Nothing here trusts the browser about who paid. */
import { S, emit } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { CFG } from '../lib/config.js';
import { LANG, t } from '../lib/i18n.js';
import { toast } from '../ui/feedback.js';

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const ACTIVE = ['active', 'trialing', 'past_due'];
const MISSING = /PGRST20[25]|42P01|does not exist|Could not find/i;

const Billing = {
  cfg: () => CFG.SUBSCRIBE || {},
  /* both prices and the client-side token are needed before anything can be sold */
  configured() { const c = this.cfg(); return !!(c.clientToken && c.prices?.monthly && c.prices?.yearly); },
  sub: null,           // the newest subscription row for this account, or null
  state: 'idle',       // idle · loading · ready · unavailable (no table yet) · error
  paddle: null,
  waiting: false,      // checkout finished, waiting for the webhook to land

  plan() { return this.sub && ACTIVE.includes(this.sub.status) ? this.sub.plan || 'monthly' : 'free'; },
  isSubscriber() { return this.plan() !== 'free'; },

  async refresh() {
    if (S.mode !== 'cloud' || !Sync.sb) { this.sub = null; this.state = 'idle'; return; }
    this.state = 'loading';
    const { data, error } = await Sync.sb.from('subscriptions')
      .select('subscription_id,status,plan,price_id,current_period_end,cancel_at,update_payment_url,cancel_url,updated_at')
      .order('updated_at', { ascending: false }).limit(1);
    if (error) { this.state = MISSING.test(`${error.code} ${error.message}`) ? 'unavailable' : 'error'; return; }
    const before = JSON.stringify(this.sub); this.sub = data[0] || null; this.state = 'ready';
    if (JSON.stringify(this.sub) !== before) emit('billing');
  },

  async load() {
    if (this.paddle) return this.paddle;
    if (!window.Paddle) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PADDLE_JS; s.onload = res; s.onerror = () => rej(new Error('paddle.js')); document.head.appendChild(s); });
    const c = this.cfg();
    if (c.environment !== 'production') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: c.clientToken, eventCallback: ev => this.onEvent(ev) });
    this.paddle = window.Paddle; return this.paddle;
  },

  async checkout(plan) {
    if (!this.configured()) { toast(t('plan.notConnected'), { error: true }); return; }
    if (S.mode !== 'cloud' || !S.user) { toast(t('plan.needAccount'), { error: true }); return; }
    if (!navigator.onLine) { toast(t('share.offline'), { error: true }); return; }
    try {
      const P = await this.load(); const c = this.cfg();
      P.Checkout.open({
        items: [{ priceId: c.prices[plan], quantity: 1 }],
        customer: { email: S.user.email },
        customData: { user_id: S.user.id }, // the webhook links the subscription to this account
        settings: { displayMode: 'overlay', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', locale: LANG === 'ko' ? 'ko' : 'en', allowLogout: false }
      });
    } catch (e) { console.warn(e); toast(t('plan.loadFail'), { error: true }); }
  },

  onEvent(ev) {
    if (ev?.name !== 'checkout.completed') return;
    this.waiting = true; emit('billing');
    // the webhook usually lands within seconds; look a few times, then leave it to the next visit
    let n = 0; const tick = async () => { await this.refresh(); if (this.isSubscriber() || ++n > 10) { this.waiting = false; emit('billing'); if (this.isSubscriber()) toast(t('plan.thanks')); return; } setTimeout(tick, 3000); };
    setTimeout(tick, 2500);
  }
};

export { Billing };
