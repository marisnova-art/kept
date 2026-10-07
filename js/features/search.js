/* Kept — Search and sorting */
import { S, catOf, entryDisplayTitle, live, typeOf } from '../data/store.js';
import { LANG, locale } from '../lib/i18n.js';
import { dayKey, esc } from '../lib/utils.js';

/* ---------- search ---------- */
const hayCache = new Map();
const norm = s => (s || '').toLowerCase().normalize('NFC');
function hayOf(e) {
  const c = catOf(e.category_id); const k = e.updated_at + '|' + (c?.name || '') + '|' + LANG;
  const hit = hayCache.get(e.id); if (hit && hit.k === k) return hit.v;
  const v = norm([e.title, e.text, typeOf(e.type).label, c?.name, e.tags.join(' '), e.tags.map(x => '#' + x).join(' '), ...Object.values(e.meta || {}).filter(x => typeof x === 'string')].join('\n'));
  hayCache.set(e.id, { k, v }); return v;
}
const words = q => norm(q).split(/\s+/).filter(Boolean);
function runSearch(f) {
  const ws = words(f.q); let list = live();
  if (f.scope === 'fav') list = list.filter(e => e.favorite);
  if (f.scope === 'recent') { const lim = Date.now() - 7 * 864e5; list = list.filter(e => new Date(e.updated_at) > lim); }
  if (f.type) list = list.filter(e => e.type === f.type);
  if (f.cat) list = list.filter(e => f.cat === '__none' ? !e.category_id : e.category_id === f.cat);
  if (f.tag) list = list.filter(e => e.tags.includes(f.tag));
  if (f.from) list = list.filter(e => dayKey(new Date(e.updated_at)) >= f.from || dayKey(new Date(e.created_at)) >= f.from);
  if (f.to) list = list.filter(e => dayKey(new Date(e.created_at)) <= f.to);
  if (ws.length) {
    list = list.filter(e => { const h = hayOf(e); return ws.every(w => h.includes(w)); });
    const score = e => { const ti = norm(e.title); return ws.reduce((s, w) => s + (ti.includes(w) ? 3 : 0) + (e.tags.some(x => norm(x).includes(w)) ? 2 : 0), 0); };
    list.sort((a, b) => score(b) - score(a) || b.updated_at.localeCompare(a.updated_at));
  } else list = sortEntries(list);
  return list;
}
/* the day a record belongs to: an event's date, a task's due date, otherwise the day it was written */
const entryDay = e => (e.type === 'event' && e.meta?.date) || (e.type === 'todo' && e.meta?.due) || dayKey(new Date(e.created_at));
const entryWhen = e => entryDay(e) + ' ' + ((e.type === 'event' ? e.meta?.time : e.type === 'todo' ? e.meta?.due_time : '') || '') + '|' + e.created_at;
/* sorts that read by day get a heading per day */
const byDay = (s = S.prefs.sort) => s === 'date' || s === 'oldest';
function sortEntries(list, s = S.prefs.sort) {
  const by = { date: (a, b) => entryWhen(b).localeCompare(entryWhen(a)), updated: (a, b) => b.updated_at.localeCompare(a.updated_at), created: (a, b) => b.created_at.localeCompare(a.created_at),
    oldest: (a, b) => entryWhen(a).localeCompare(entryWhen(b)), title: (a, b) => entryDisplayTitle(a).localeCompare(entryDisplayTitle(b), locale()) }[s] || ((a, b) => b.updated_at.localeCompare(a.updated_at));
  return list.slice().sort((a, b) => (b.pinned - a.pinned) * 0 || by(a, b));
}
function hl(text, ws) {
  if (!ws || !ws.length) return esc(text);
  const re = new RegExp('(' + ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return String(text).split(re).map((p, i) => i % 2 ? `<mark class="hit">${esc(p)}</mark>` : esc(p)).join('');
}
function snippet(e, ws, len = 160) {
  const tx = (e.text || '').replace(/\s+/g, ' ').trim();
  if (e.type === 'item' && e.meta.location) return `→ ${e.meta.location}${tx ? ' · ' + tx : ''}`.slice(0, len);
  if (e.type === 'contact') return [e.meta.phone, e.meta.email, e.meta.org].filter(Boolean).join(' · ') || tx.slice(0, len);
  if (!ws || !ws.length) return tx.slice(0, len);
  const i = norm(tx).indexOf(ws[0]); if (i < 40) return tx.slice(0, len);
  return '… ' + tx.slice(i - 30, i - 30 + len);
}

export { byDay, entryDay, hayOf, hl, norm, runSearch, snippet, sortEntries, words };
