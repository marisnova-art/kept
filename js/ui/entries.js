/* Kept — Entry cards and rows */
import { S, catOf, entryDisplayTitle, typeOf } from '../data/store.js';
import { entryDay, hl, snippet } from '../features/search.js';
import { fmtDate, fmtNum, fmtRel, fmtTime, t, tn } from '../lib/i18n.js';
import { addDays, dayKey, esc, icon, parseDay, todayKey } from '../lib/utils.js';
import { V } from './router.js';
import { Share } from '../features/share.js';
import { repeatLabel } from '../views/today.js';

/* ---------- entry renderers ---------- */
function metaBadge(e) {
  if (e.type === 'todo' && e.meta.due) { const k = todayKey(); const cls = !e.meta.done && e.meta.due < k ? 'over' : e.meta.due === k ? 'today' : ''; return `<span class="due ${cls}">${esc(fmtDue(e.meta.due, e.meta.due_time))}</span>`; }
  if (e.type === 'event' && e.meta.date) return `<span class="due">${e.meta.repeat ? icon('repeat') : ''}${esc(e.meta.repeat ? repeatLabel(e.meta, true) + (e.meta.time ? ' · ' + fmtTime(e.meta.time) : '') : fmtDue(e.meta.date, e.meta.time))}</span>`;
  return '';
}
function fmtDue(d, tm) {
  const k = todayKey(); const tmw = addDays(new Date(), 1);
  const lbl = d === k ? t('date.today') : d === dayKey(tmw) ? t('date.tomorrow') : d === dayKey(addDays(new Date(), -1)) ? t('date.yesterday') : fmtDate(parseDay(d), { month: 'short', day: 'numeric', weekday: 'short' });
  return tm ? `${lbl} ${fmtTime(tm)}` : lbl;
}
/* shared records carry their folder's name; someone else's record also says who wrote it */
function shareBadge(e) {
  const f = e.folder_id && Share.folder(e.folder_id); if (!f) return '';
  const by = Share.authorOf(e);
  return `<span class="shr" title="${esc(f.name + (by ? ' · ' + t('share.by', { who: by }) : ''))}" style="${f.color ? `--fc:${esc(f.color)}` : ''}">${icon('users')}<span>${esc(f.name)}</span></span>`;
}
function card(e, ws) {
  const ty = typeOf(e.type), c = catOf(e.category_id); const sel = S.selected.has(e.id);
  return `<article class="card ${sel ? 'sel' : ''} ${e.type === 'todo' && e.meta.done ? 'done' : ''}" data-act="open" data-id="${e.id}" tabindex="0">
    <span class="selbox">${sel ? icon('check') : ''}</span>
    <div class="k">${icon(ty.icon)}<span>${esc(ty.label)}</span>${e.pinned ? icon('pin') : ''}${shareBadge(e)}</div>
    ${!e.deleted_at ? `<button class="heart ${e.favorite ? 'on' : ''}" data-act="fav" data-id="${e.id}" aria-label="${esc(t('ed.favorite'))}">${icon('heart')}</button>` : ''}
    <h3>${hl(entryDisplayTitle(e), ws)}</h3>
    ${e.title.trim() || e.type === 'item' || e.type === 'contact' ? `<div class="sn">${hl(snippet(e, ws), ws)}</div>` : `<div class="sn">${hl(snippet(e, ws).slice(entryDisplayTitle(e).length).trim(), ws)}</div>`}
    <div class="ft">${metaBadge(e)}${c ? `<span class="cat" style="--cc:${esc(c.color)}"><i></i>${esc(c.name)}</span>` : ''}${e.tags.slice(0, 3).map(g => `<span class="tg">#${hl(g, ws)}</span>`).join('')}<span class="dtm">${esc(e.deleted_at ? t('trash.deletedAgo', { t: fmtRel(e.deleted_at) }) : fmtRel(e.updated_at))}</span></div>
  </article>`;
}
function swipeWrap(e, inner, kind) {
  if (e.deleted_at || S.selecting) return inner;
  const left = kind === 'task' ? (e.meta.done ? ['rotate-ccw', t('task.reopen')] : ['check', t('task.done')]) : ['heart', e.favorite ? t('ed.unfavShort') : t('ed.favorite')];
  return `<div class="sw-wrap" data-sw="${e.id}" data-kind="${kind}"><div class="sw-bg" aria-hidden="true"><span class="sw-l">${icon(left[0])}${esc(left[1])}</span><span class="sw-r">${esc(t('bulk.trash'))}${icon('trash-2')}</span></div>${inner}</div>`;
}
function row(e, ws) {
  const ty = typeOf(e.type), c = catOf(e.category_id); const sel = S.selected.has(e.id);
  return `<div class="row ${sel ? 'sel' : ''}" data-act="open" data-id="${e.id}" tabindex="0"><span class="selbox">${sel ? icon('check') : ''}</span>
    <span class="ti">${icon(ty.icon)}</span>
    <div class="mid"><span class="rt">${hl(entryDisplayTitle(e), ws)}</span><span class="rs">${hl(snippet(e, ws, 120), ws)}</span></div>
    <div class="rm">${shareBadge(e)}${metaBadge(e)}${c ? `<span class="cat" style="--cc:${esc(c.color)}"><i></i>${esc(c.name)}</span>` : ''}<span>${esc(fmtRel(e.updated_at))}</span>
    ${!e.deleted_at ? `<button class="heart ${e.favorite ? 'on' : ''}" data-act="fav" data-id="${e.id}" aria-label="${esc(t('ed.favorite'))}">${icon('heart')}</button>` : ''}</div></div>`;
}
const rowS = (e, ws) => swipeWrap(e, row(e, ws), 'row');
const SORTS = ['updated', 'created', 'date', 'oldest', 'title'];
/* "Today", "Yesterday", or "Wed, October 14" (with the year when it is not this year) */
function dayLabel(k) {
  const d = parseDay(k), n = new Date(); const diff = Math.round((d - parseDay(todayKey())) / 864e5);
  if (diff === 0) return t('date.today'); if (diff === -1) return t('date.yesterday'); if (diff === 1) return t('date.tomorrow');
  return fmtDate(d, { weekday: 'short', month: 'long', day: 'numeric', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) });
}
function entryList(list, { ws, trash = false, empty, grouped = false } = {}) {
  if (!list.length) return empty || emptyState(t('empty.title'), t('empty.sub'), true);
  const shown = list.slice(0, V.listLimit);
  const block = l => S.prefs.view === 'list' ? `<div class="list">${l.map(e => rowS(e, ws)).join('')}</div>` : `<div class="grid-cards">${l.map(e => card(e, ws)).join('')}</div>`;
  let body;
  if (grouped) { // date sort: a small heading for each day
    const groups = []; for (const e of shown) { const k = entryDay(e); if (groups.at(-1)?.k !== k) groups.push({ k, l: [] }); groups.at(-1).l.push(e); }
    body = groups.map((g, i) => `<h3 class="dgrp" style="--i:${Math.min(i, 8)}">${esc(dayLabel(g.k))}<span class="c">${fmtNum(g.l.length)}</span></h3>${block(g.l)}`).join('');
  } else body = block(shown);
  return `<div class="${S.selecting ? 'selecting' : ''}" id="entryList">${bulkBar(list, trash)}${body}${list.length > V.listLimit ? `<div class="more-load"><button class="btn" data-act="more" id="loadMore">${esc(t('list.more', { n: fmtNum(list.length - V.listLimit) }))}</button></div>` : ''}</div>`;
}
function bulkBar(list, trash) {
  if (!S.selecting) return '';
  const n = S.selected.size;
  const b = (act, ic, label, cls = '') => `<button class="btn sm ${cls}" data-act="${act}" ${n ? '' : 'disabled'}>${icon(ic)}<span>${esc(label)}</span></button>`;
  return `<div class="bulkbar"><span class="n">${esc(tn('bulk.selected', n))}</span>
    <button class="btn sm ghost" data-act="selAll">${esc(t('bulk.all'))}</button>
    ${trash ? b('bulkRestore', 'rotate-ccw', t('trash.restore')) + b('bulkPurge', 'trash-2', t('trash.purge'), 'danger') :
      b('bulkCat', 'folder', t('bulk.move')) + b('bulkTag', 'tag', t('bulk.tag')) + b('bulkType', 'layers', t('bulk.type')) + b('bulkFav', 'heart', t('bulk.fav')) + b('bulkTrash', 'trash-2', t('bulk.trash'), 'danger')}
    <button class="btn sm primary" data-act="selCancel">${esc(t('common.done'))}</button></div>`;
}
function listControls({ select = true } = {}) {
  return `<div class="ph-actions">
    <select class="select" data-chg="sort" aria-label="${esc(t('sort.label'))}">${SORTS.map(s => `<option value="${s}" ${S.prefs.sort === s ? 'selected' : ''}>${esc(t('sort.' + s))}</option>`).join('')}</select>
    <div class="seg" role="group"><button class="${S.prefs.view === 'grid' ? 'on' : ''}" data-act="view" data-v="grid" aria-label="${esc(t('view.grid'))}">${icon('layout-grid')}</button><button class="${S.prefs.view === 'list' ? 'on' : ''}" data-act="view" data-v="list" aria-label="${esc(t('view.list'))}">${icon('list')}</button></div>
    ${select ? `<button class="btn sm ${S.selecting ? 'primary' : ''}" data-act="select">${icon('check-check')}<span>${esc(t('bulk.select'))}</span></button>` : ''}
  </div>`;
}
function emptyState(title, sub, withNew, type) {
  return `<div class="empty"><div class="orb"></div><div class="big">${esc(title)}</div><div>${esc(sub)}</div>${withNew ? `<div style="margin-top:20px"><button class="btn primary" data-act="new" ${type ? `data-type="${type}"` : ''}>${icon('plus')}<span>${esc(t('common.newRecord'))}</span></button></div>` : ''}</div>`;
}
const header = (title, sub, actions = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${actions}</div>`;

export { card, emptyState, entryList, fmtDue, header, listControls, metaBadge, rowS, swipeWrap };
