/* Kept — Items (where things are) and contacts */
import { S, entryDisplayTitle, live } from '../data/store.js';
import { hayOf, norm, sortEntries } from '../features/search.js';
import { fmtNum, fmtRel, locale, t } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { emptyState, header } from '../ui/entries.js';
import { V } from '../ui/router.js';

/* ---------- Items & Contacts ---------- */
function viewItems() {
  const q = norm(V.itemQ); let list = live().filter(e => e.type === 'item');
  if (q) list = list.filter(e => hayOf(e).includes(q));
  list = sortEntries(list, ['title', 'date', 'created', 'oldest'].includes(S.prefs.sort) ? S.prefs.sort : 'updated');
  return `<div class="wrap view-enter">${header(esc(t('nav.items')) + ` <span class="mut">${fmtNum(list.length)}</span>`, esc(t('items.sub')))}
    <form class="quick-add" id="itemAdd" autocomplete="off">${icon('box')}<input type="text" id="itemName" maxlength="200" placeholder="${esc(t('items.namePh'))}" aria-label="${esc(t('items.namePh'))}">
      <span style="color:var(--text-3)">→</span><input type="text" id="itemLoc" maxlength="200" placeholder="${esc(t('items.locPh'))}" aria-label="${esc(t('items.locPh'))}"><button class="btn primary sm" type="submit">${esc(t('common.add'))}</button></form>
    <div class="toolbar-row"><div class="search" style="max-width:340px">${icon('search')}<input id="itemQ" value="${esc(V.itemQ)}" placeholder="${esc(t('items.filterPh'))}" style="height:40px;padding-right:16px"></div></div>
    ${list.length ? `<div class="grid-cards">${list.slice(0, V.listLimit).map(e => `<article class="item-card" data-act="open" data-id="${e.id}" tabindex="0">
      <button class="heart ${e.favorite ? 'on' : ''}" data-act="fav" data-id="${e.id}" style="color:${e.favorite ? 'var(--dot)' : 'var(--text-3)'}" aria-label="${esc(t('ed.favorite'))}">${icon('heart')}</button>
      <div class="nm">${esc(entryDisplayTitle(e))}</div><div class="loc">${icon('map-pin')}<span>${esc(e.meta.location || t('items.noLoc'))}</span></div>
      ${e.text ? `<div class="ds">${esc(e.text.slice(0, 160))}</div>` : ''}<div class="card ft" style="all:unset;margin-top:auto;display:flex;gap:6px;font-size:var(--t-cap);color:var(--text-3)">${e.tags.slice(0, 3).map(g => `<span class="tg">#${esc(g)}</span>`).join('')}<span style="margin-left:auto">${esc(fmtRel(e.updated_at))}</span></div></article>`).join('')}</div>`
      : emptyState(q ? t('search.none') : t('items.emptyTitle'), q ? t('search.noneSub') : t('items.emptySub'))}</div>`;
}
function viewContacts() {
  const q = norm(V.contactQ); let list = live().filter(e => e.type === 'contact');
  if (q) list = list.filter(e => hayOf(e).includes(q));
  list.sort((a, b) => entryDisplayTitle(a).localeCompare(entryDisplayTitle(b), locale()));
  const safeTel = p => p.replace(/[^\d+]/g, '');
  return `<div class="wrap view-enter" style="max-width:900px">${header(esc(t('nav.contacts')) + ` <span class="mut">${fmtNum(list.length)}</span>`, esc(t('contacts.sub')), `<button class="btn primary" data-act="new" data-type="contact">${icon('plus')}${esc(t('contacts.new'))}</button>`)}
    <div class="toolbar-row"><div class="search" style="max-width:340px">${icon('search')}<input id="contactQ" value="${esc(V.contactQ)}" placeholder="${esc(t('contacts.filterPh'))}" style="height:40px;padding-right:16px"></div></div>
    ${list.length ? `<div class="list">${list.slice(0, V.listLimit).map(e => { const m = e.meta; const nm = entryDisplayTitle(e); return `<div class="contact-row" data-act="open" data-id="${e.id}" tabindex="0">
      <span class="avatar" style="background:${['linear-gradient(135deg,#ff6a2b,#e8432c)', 'linear-gradient(135deg,#14b8a6,#124a4a)', 'linear-gradient(135deg,#6366f1,#a855f7)', 'linear-gradient(135deg,#f5b301,#ff6a2b)'][nm.charCodeAt(0) % 4]}">${esc(nm[0]?.toUpperCase() || '?')}</span>
      <div style="flex:1;min-width:0"><div class="cn">${esc(nm)}${m.org ? ` <span style="color:var(--text-3);font-weight:400;font-size:var(--t-sub)">· ${esc(m.org)}</span>` : ''}</div>
      <div class="cs">${m.phone ? `<a href="tel:${esc(safeTel(m.phone))}" data-stop>${icon('phone')}${esc(m.phone)}</a>` : ''}${m.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) ? `<a href="mailto:${esc(m.email)}" data-stop>${icon('mail')}${esc(m.email)}</a>` : ''}${m.address ? `<span>${icon('map-pin')} ${esc(m.address)}</span>` : ''}</div></div>
      <button class="heart ${e.favorite ? 'on' : ''}" data-act="fav" data-id="${e.id}" style="position:static;color:${e.favorite ? 'var(--dot)' : 'var(--text-3)'}" aria-label="${esc(t('ed.favorite'))}">${icon('heart')}</button></div>`; }).join('')}</div>`
      : emptyState(q ? t('search.none') : t('contacts.emptyTitle'), q ? t('search.noneSub') : t('contacts.emptySub'), !q, 'contact')}</div>`;
}

export { viewContacts, viewItems };
