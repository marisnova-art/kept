/* Kept — Support, about, FAQ, legal */
import { S } from '../data/store.js';
import { Aurora } from '../features/aurora.js';
import { Billing } from '../features/billing.js';
import { norm } from '../features/search.js';
import { APP_VERSION, CFG, LIMITS } from '../lib/config.js';
import { fmtDate, fmtNum, locale, t } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { emptyState, header } from '../ui/entries.js';
import { V } from '../ui/router.js';

/* ---------- Subscription: Free · monthly · yearly (Paddle) ---------- */
function viewSupport() {
  const B = Billing; const c = B.cfg(); const d = c.display || {}; const cur = d.currency || 'USD';
  const money = n => new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  const plan = B.plan(); const cloud = S.mode === 'cloud'; const ready = B.configured();
  const perMonth = d.yearly ? Math.floor(d.yearly / 12 * 100) / 100 : 0;
  const feats = k => `<ul class="pl-f">${t(k).split('|').map(x => `<li>${icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>`;
  const cta = id => {
    if (plan === id) return `<button class="btn pl-cta" disabled>${icon('check')}${esc(t('plan.current'))}</button>`;
    if (id === 'free') return plan === 'free' ? '' : `<p class="pl-note">${esc(t('plan.freeAfter'))}</p>`;
    if (B.isSubscriber()) return `<p class="pl-note">${esc(t('plan.switchHint'))}</p>`;
    if (!cloud) return `<button class="btn pl-cta" data-act="signIn">${icon('user')}${esc(t('plan.signInFirst'))}</button>`;
    return `<button class="btn ${id === 'yearly' ? 'accent' : 'primary'} pl-cta" data-act="planGo" data-v="${id}" ${ready ? '' : 'disabled'}>${esc(t('plan.go.' + id, { p: money(d[id] || 0) }))}</button>`;
  };
  const card = (id, price, unit, extra = '') => `<div class="pl-card ${id} ${plan === id ? 'on' : ''}">${id === 'yearly' ? `<span class="pl-badge">${esc(t('plan.twoFree'))}</span>` : ''}
      <div class="pl-name">${esc(t('plan.' + id))}</div><div class="pl-price"><b>${esc(price)}</b>${unit ? `<span>${esc(unit)}</span>` : ''}</div>${extra}
      ${feats('plan.f.' + id)}${cta(id)}</div>`;
  const s = B.sub; const fmt = v => v ? fmtDate(v, { dateStyle: 'long' }) : '';
  const status = B.waiting ? `<div class="note pl-status">${icon('loader', 'spin')}<span>${esc(t('plan.waiting'))}</span></div>`
    : s && B.isSubscriber() ? `<div class="panel pl-manage"><div class="set-row"><div class="l"><b>${esc(t('plan.yours', { p: t('plan.' + plan) }))}${s.status === 'past_due' ? ` <span class="pl-warn">${esc(t('plan.pastDue'))}</span>` : ''}</b>
        <small>${esc(s.cancel_at ? t('plan.endsOn', { d: fmt(s.cancel_at) }) : s.current_period_end ? t('plan.renewsOn', { d: fmt(s.current_period_end) }) : '')}</small></div>
        <div class="r">${s.update_payment_url ? `<a class="btn sm" href="${esc(safeUrl(s.update_payment_url))}" target="_blank" rel="noopener noreferrer">${icon('credit-card')}${esc(t('plan.payment'))}</a>` : ''}${s.cancel_url && !s.cancel_at ? `<a class="btn sm ghost" href="${esc(safeUrl(s.cancel_url))}" target="_blank" rel="noopener noreferrer">${esc(t('plan.cancel'))}</a>` : ''}</div></div></div>` : '';
  const gate = !ready ? `<div class="note warn">${icon('info')}<span>${esc(t('plan.notConnected'))}</span></div>`
    : B.state === 'unavailable' && cloud ? `<div class="note warn">${icon('info')}<span>${esc(t('plan.noServer'))}</span></div>` : '';
  return `<div class="wrap view-enter" style="max-width:960px">
    <section class="aurora support-hero" ${Aurora.attr()}>${Aurora.layers}<div class="cap" style="font-size:var(--t-sub);opacity:.8;margin-bottom:auto">${esc(t('plan.kicker'))}</div><h2>${esc(t('plan.title'))}</h2><p>${esc(t('plan.sub'))}</p></section>
    ${status}${gate}
    <div class="plans">${card('free', money(0), '')}${card('monthly', money(d.monthly || 0), t('plan.perMonth'))}${card('yearly', money(d.yearly || 0), t('plan.perYear'), perMonth ? `<div class="pl-sub">${esc(t('plan.yearlyEq', { p: money(perMonth) }))}</div>` : '')}</div>
    <div class="uses">${[['database', 'sup.use1'], ['shield', 'sup.use2'], ['sparkle', 'sup.use3']].map(([ic, k]) => `<div>${icon(ic)}<b>${esc(t(k))}</b><small>${esc(t(k + 'Sub'))}</small></div>`).join('')}</div>
    <p class="pl-legal">${esc(t('plan.legal'))}</p></div>`;
}
const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : '#'; } catch { return '#'; } };

/* ---------- About (company) ---------- */
function viewAbout() {
  const op = CFG.OPERATOR || t('about.opPh'); const contact = CFG.PRIVACY_CONTACT || t('legal.contactPh');
  const card = (ic, k) => `<div class="ab-card">${icon(ic)}<b>${esc(t('about.' + k))}</b><p>${esc(t('about.' + k + 'Body'))}</p></div>`;
  return `<div class="wrap view-enter" style="max-width:960px">
    <section class="aurora about-hero" ${Aurora.attr()}>${Aurora.layers}<div class="ab-k">${esc(t('about.kicker'))}</div><h2>${esc(t('about.title'))}</h2><p>${esc(t('about.lead'))}</p></section>
    <section class="ab-sec"><h3 class="ab-h">${esc(t('about.whatH'))}</h3><p class="ab-p">${esc(t('about.what'))}</p></section>
    <section class="ab-sec"><h3 class="ab-h">${esc(t('about.promiseH'))}</h3><div class="ab-grid">${card('hand-heart', 'p1')}${card('shield', 'p2')}${card('feather', 'p3')}${card('download', 'p4')}${card('zap', 'p5')}${card('globe', 'p6')}</div></section>
    <section class="ab-sec"><h3 class="ab-h">${esc(t('about.howH'))}</h3><p class="ab-p">${esc(t('about.how'))}</p>
      <div class="ab-flow">${['f1', 'f2', 'f3'].map((k, i) => `<div><span>${i + 1}</span><b>${esc(t('about.' + k))}</b><small>${esc(t('about.' + k + 'Sub'))}</small></div>`).join('')}</div></section>
    <section class="ab-sec"><h3 class="ab-h">${esc(t('about.storyH'))}</h3><p class="ab-p">${esc(t('about.story'))}</p></section>
    <section class="panel ab-info"><dl class="kv">
      <dt>${esc(t('about.company'))}</dt><dd>Kept · ${esc(op)}</dd>
      <dt>${esc(t('about.contact'))}</dt><dd>${esc(contact)}</dd>
      <dt>${esc(t('about.model'))}</dt><dd>${esc(t('about.modelVal'))}</dd>
      <dt>${esc(t('about.langs'))}</dt><dd>한국어 · English</dd>
      <dt>${esc(t('about.version'))}</dt><dd>${APP_VERSION}</dd></dl></section>
    <div class="ab-cta"><a class="btn primary" href="#/faq">${icon('circle-help')}${esc(t('faq.nav'))}</a><a class="btn accent" href="#/support">${icon('hand-heart')}${esc(t('nav.support'))}</a><a class="btn" href="#/privacy">${esc(t('legal.privacy'))}</a></div>
  </div>`;
}
/* ---------- FAQ ---------- */
const FAQ_GROUPS = [['g1', [1, 2, 3, 4]], ['g2', [5, 6, 7, 8]], ['g3', [9, 10, 16, 11, 12]], ['g4', [13, 14, 15]]];
function viewFaq() {
  const q = norm(V.faqQ || '');
  const groups = FAQ_GROUPS.map(([g, ids]) => [g, ids.filter(i => !q || norm(t('faq.q' + i) + ' ' + t('faq.a' + i)).includes(q))]).filter(([, ids]) => ids.length);
  return `<div class="wrap view-enter" style="max-width:820px">${header(esc(t('faq.title')), esc(t('faq.sub')))}
    <div class="search" style="max-width:none;margin-bottom:18px">${icon('search')}<input id="faqQ" value="${esc(V.faqQ || '')}" placeholder="${esc(t('faq.searchPh'))}" style="padding-right:16px"></div>
    ${groups.length ? groups.map(([g, ids]) => `<h3 class="ab-h">${esc(t('faq.' + g))}</h3><div class="faq">${ids.map(i => `<details class="faq-i"${q ? ' open' : ''}><summary><span>${esc(t('faq.q' + i))}</span>${icon('chevron-down')}</summary><p>${esc(t('faq.a' + i))}</p></details>`).join('')}</div>`).join('')
      : emptyState(t('search.none'), t('faq.none'))}
    <div class="note" style="margin-top:22px">${icon('mail')}<span>${esc(t('faq.more', { contact: CFG.PRIVACY_CONTACT || t('legal.contactPh') }))}</span></div></div>`;
}

/* ---------- Legal templates ---------- */
function viewLegal(kind) {
  const op = CFG.OPERATOR || t('legal.operatorPh'); const contact = CFG.PRIVACY_CONTACT || t('legal.contactPh');
  const secs = kind === 'privacy' ? ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] : ['t1', 't2', 't3', 't4', 't5', 't6'];
  return `<div class="wrap view-enter">${header(esc(t(kind === 'privacy' ? 'legal.privacy' : 'legal.terms')), esc(t('legal.template')))}
    <article class="doc">${secs.map(s => `<h2>${esc(t('legal.' + s))}</h2><p>${esc(t('legal.' + s + 'Body', { op, contact, days: 30, n: fmtNum(LIMITS.entries) }))}</p>`).join('')}</article></div>`;
}

export { viewAbout, viewFaq, viewLegal, viewSupport };
