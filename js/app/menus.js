/* Kept — Dialogs and menus (shortcuts, bell, user) */
import { ACT } from './actions.js';
import { S, entryDisplayTitle, live, typeOf } from '../data/store.js';
import { Conn } from '../data/supabase.js';
import { Editor, ICON_SETS } from '../editor/editor.js';
import { Billing } from '../features/billing.js';
import { Reminders } from '../features/reminders.js';
import { LANG, fmtDate, fmtTime, t } from '../lib/i18n.js';
import { $, esc, icon, todayKey } from '../lib/utils.js';
import { fmtDue } from '../ui/entries.js';
import { closeLayers, dialog, menu } from '../ui/feedback.js';
import { go } from '../ui/router.js';
import { isEventOn } from '../views/today.js';

function pwProblem(a, b) { if (a.length < 8) return t('auth.pwShort'); if (!/[A-Za-z]/.test(a) || !/\d/.test(a)) return t('auth.pwWeak'); if (b != null && a !== b) return t('auth.pwMismatch'); return ''; }
async function typedConfirm(title, body, word) {
  return dialog({ title, body, html: `<div class="field"><label>${esc(t('set.typeToConfirm', { w: word }))}</label><input class="input" id="tc" autocomplete="off"></div>`,
    actions: [{ label: t('common.cancel'), cls: 'ghost', value: false }, { label: t('common.delete'), cls: 'danger solid', run: d => d.querySelector('#tc').value.trim() === word ? true : (d.querySelector('#tc').style.borderColor = 'var(--err)', false) }] });
}
function pickIconDialog() {
  const all = [...new Set(Object.values(ICON_SETS).flat())];
  return dialog({ title: t('set.pickIcon'), html: `<div class="picker" style="width:100%"><div class="pgrid">${all.map(n => `<button data-v="${n}" title="${n}">${icon(n)}</button>`).join('')}</div></div>`, actions: [{ label: t('common.skip'), cls: 'ghost', value: null }],
    onMount: (d, done) => d.querySelector('.pgrid').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); }) });
}
function showShortcuts() {
  const mod = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
  const rows = [['/ · ' + mod + ' K', 'sc.search'], ['N · Alt N', 'sc.new'], ['Esc', 'sc.close'], ['?', 'sc.help'], [mod + ' B / I / U', 'sc.biu'], [mod + ' ⇧ X', 'sc.strike'], [mod + ' ⇧ H', 'sc.highlight'], [mod + ' ⇧ 8 / 7', 'sc.lists'], [mod + ' ⇧ 9', 'sc.quote'], [mod + ' ⇧ I', 'sc.icon'], [mod + ' ⇧ E', 'sc.emoji'], [mod + ' Z / ⇧ Z', 'sc.undo'], [mod + ' S', 'sc.save'], ['- · 1. · > · #', 'sc.md'], ['Enter', 'sc.capture']];
  dialog({ title: t('set.shortcuts'), wide: true, html: `<dl class="kv" style="grid-template-columns:auto 1fr;gap:10px 22px">${rows.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(t(d))}</dd>`).join('')}</dl>`, actions: [{ label: t('common.close'), cls: 'primary', value: true }] });
}
function toggleSidebar(force) {
  const sb = $('#sidebar'); const open = force ?? !sb.classList.contains('open');
  sb.classList.toggle('open', open); $('.scrim.sb')?.remove();
  if (open) { const s = document.createElement('div'); s.className = 'scrim sb'; s.style.zIndex = 41; s.onclick = () => toggleSidebar(false); document.body.appendChild(s); requestAnimationFrame(() => s.classList.add('show')); }
}
function bellMenu(el) {
  const k = todayKey(); const L = live();
  const over = L.filter(e => e.type === 'todo' && !e.meta.done && e.meta.due && e.meta.due < k);
  const today = L.filter(e => (e.type === 'todo' && !e.meta.done && e.meta.due === k) || isEventOn(e, k));
  const up = Reminders.upcoming(48).filter(x => !today.includes(x.e));
  const it = (e, w, cls = '') => `<div class="notif-item ${cls}" data-id="${e.id}">${icon(typeOf(e.type).icon)}<div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(entryDisplayTitle(e))}</div><div class="w">${esc(w)}</div></div></div>`;
  const html = `<div style="padding:6px 8px 2px;font-weight:500">${esc(t('notif.title'))}</div>` +
    (over.length ? `<div class="mh">${esc(t('task.overdue'))}</div>` + over.slice(0, 8).map(e => it(e, fmtDue(e.meta.due, e.meta.due_time), 'over')).join('') : '') +
    (today.length ? `<div class="mh">${esc(t('date.today'))}</div>` + today.slice(0, 10).map(e => it(e, e.type === 'event' ? (e.meta.time ? fmtTime(e.meta.time) : t('cal.allDay')) : t('type.todo'))).join('') : '') +
    (up.length ? `<div class="mh">${esc(t('notif.upcoming'))}</div>` + up.slice(0, 8).map(x => it(x.e, t('notif.remindAt', { t: fmtDate(new Date(x.at), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) }))).join('') : '') +
    (!over.length && !today.length && !up.length ? `<div class="mh" style="padding:16px 12px">${esc(t('notif.none'))}</div>` : '') +
    (Reminders.permission() !== 'granted' ? `<hr><a class="mi" href="#/settings#notifications">${icon('bell')}<span>${esc(t('notif.enableCta'))}</span></a>` : '');
  menu(el, [], { html, alignRight: true, onMount: m => { m.style.width = '320px'; m.addEventListener('click', e => { const n = e.target.closest('[data-id]'); if (n) { closeLayers(); Editor.open(n.dataset.id); } if (e.target.closest('a')) closeLayers(); }); } });
}
function userMenu(el) {
  const items = [];
  if (S.mode === 'cloud') items.push({ header: S.user.email }); else items.push({ header: t('set.localMode') });
  items.push({ label: t('nav.settings'), icon: 'settings', run: () => go('settings') }, { label: t('nav.support'), icon: Billing.isSubscriber() ? 'gem' : 'hand-heart', run: () => go('support') }, { label: t('set.shortcuts'), icon: 'keyboard', run: showShortcuts }, { label: t('about.nav'), icon: 'info', run: () => go('about') }, { label: t('faq.nav'), icon: 'circle-help', run: () => go('faq') },
    { label: LANG === 'ko' ? 'English' : '한국어', icon: 'globe', run: () => ACT.setLang({ dataset: { v: LANG === 'ko' ? 'en' : 'ko' } }) }, '-');
  if (S.mode === 'cloud') items.push({ label: t('set.signOut'), icon: 'log-out', run: ACT.signOut }); else if (Conn.configured()) items.push({ label: t('auth.signIn'), icon: 'user', run: ACT.signIn });
  menu(el, items, { alignRight: true });
}

export { bellMenu, pickIconDialog, pwProblem, showShortcuts, toggleSidebar, typedConfirm, userMenu };
