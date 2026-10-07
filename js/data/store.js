/* Kept — App state, entries, categories, preferences */
import { Sync } from './sync.js';
import { Reminders } from '../features/reminders.js';
import { LIMITS } from '../lib/config.js';
import { setLang, t } from '../lib/i18n.js';
import { $, ls, nowISO, uid } from '../lib/utils.js';
import { toast } from '../ui/feedback.js';

/* ---------- State ---------- */
const BUILTIN_TYPES = [
  { id: 'note', icon: 'file-text' }, { id: 'idea', icon: 'lightbulb' }, { id: 'todo', icon: 'check-square' }, { id: 'event', icon: 'calendar' },
  { id: 'item', icon: 'map-pin' }, { id: 'contact', icon: 'contact' }, { id: 'reference', icon: 'bookmark' }, { id: 'personal', icon: 'feather' }
];
const CAT_COLORS = ['#ff6a2b', '#ff3b30', '#ffb020', '#3ccf7a', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#8b8b93', '#a16207', '#0ea5e9'];
const ACCENTS = ['#ff6a2b', '#ff3b30', '#f5b301', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#e5e5e5'];
const DEFAULT_PREFS = { lang: null, theme: 'system', accent: '#ff6a2b', defaultType: 'note', sort: 'updated', view: 'grid', typeLabels: {}, customTypes: [], notify: false, weekStart: 0, wsV2: 1, spacing: 'base' };
/* v2: weeks start on Sunday, like Google Calendar. Prefs saved before v2 (here, in IndexedDB or in the cloud) carry v1's Monday default, so it is reset once wherever they are read. */
const migratePrefs = p => p && !p.wsV2 ? { ...p, weekStart: 0, wsV2: 1 } : p;

const S = {
  ns: null, user: null, db: null, mode: 'local', // 'local' | 'cloud'
  entries: new Map(), categories: new Map(), prefs: Object.assign({}, DEFAULT_PREFS, migratePrefs(ls.get('kept.prefs', {}))),
  online: navigator.onLine, sync: 'local', selected: new Set(), selecting: false, lastSyncAt: null
};
const listeners = new Set();
const emit = (what) => listeners.forEach(f => f(what));
const onChange = f => listeners.add(f);

function typeList() {
  const b = BUILTIN_TYPES.map(x => ({ ...x, builtin: true, label: S.prefs.typeLabels[x.id] || t('type.' + x.id) }));
  return b.concat((S.prefs.customTypes || []).map(x => ({ ...x, builtin: false })));
}
const typeOf = id => typeList().find(x => x.id === id) || { id, icon: 'file-text', label: t('type.note'), builtin: false };
const catOf = id => id ? S.categories.get(id) : null;

/* ---------- Entry helpers ---------- */
function newEntry(fields = {}) {
  const n = nowISO();
  return Object.assign({ id: uid(), type: S.prefs.defaultType || 'note', title: '', content: '', text: '', category_id: null, folder_id: null, tags: [], favorite: false, pinned: false,
    meta: {}, created_at: n, updated_at: n, deleted_at: null, _sv: null, _dirty: true }, fields);
}
function isEmptyEntry(e) { return !e.title.trim() && !e.text.trim() && !Object.values(e.meta || {}).some(v => v && v !== 'normal') && !e.tags.length; }
function entryDisplayTitle(e) {
  if (e.title.trim()) return e.title.trim();
  const first = (e.text || '').split('\n').find(l => l.trim());
  return first ? first.slice(0, 80) : t('common.untitled');
}
const live = () => [...S.entries.values()].filter(e => !e.deleted_at);

async function saveEntry(e, { silent = false } = {}) {
  e.updated_at = nowISO(); e._dirty = true;
  if (e.tags.length > LIMITS.tagsPerEntry) e.tags = e.tags.slice(0, LIMITS.tagsPerEntry);
  S.entries.set(e.id, e);
  try { await S.db.put('entries', e); } catch (err) { console.error(err); toast(t('err.localSave'), { error: true }); throw err; }
  Sync.schedule();
  if (!silent) emit('entries');
  Reminders.reschedule();
  return e;
}
async function saveEntries(list) {
  const n = nowISO(); list.forEach(e => { e.updated_at = n; e._dirty = true; S.entries.set(e.id, e); });
  await S.db.putMany('entries', list); Sync.schedule(); emit('entries'); Reminders.reschedule();
}
async function trashEntries(ids) {
  const list = ids.map(id => S.entries.get(id)).filter(Boolean); const n = nowISO();
  list.forEach(e => e.deleted_at = n); await saveEntries(list);
  return list;
}
async function restoreEntries(ids) { const list = ids.map(id => S.entries.get(id)).filter(Boolean); list.forEach(e => e.deleted_at = null); await saveEntries(list); }
async function purgeEntries(ids) {
  const pend = await S.db.get('pendingDeletes', []);
  // someone else's shared record can only be removed from this device; the server copy is theirs
  ids.forEach(id => { const e = S.entries.get(id); if (e && e._sv != null && (!e.owner || e.owner === S.user?.id)) pend.push({ table: 'entries', id }); S.entries.delete(id); });
  await S.db.delMany('entries', ids); await S.db.set('pendingDeletes', pend); Sync.schedule(); emit('entries');
}
async function saveCategory(c) {
  c.updated_at = nowISO(); c._dirty = true; S.categories.set(c.id, c); await S.db.put('categories', c); Sync.schedule(); emit('categories');
}
async function deleteCategory(id) {
  const affected = live().concat([...S.entries.values()].filter(e => e.deleted_at)).filter(e => e.category_id === id);
  affected.forEach(e => e.category_id = null);
  if (affected.length) await saveEntries(affected);
  const c = S.categories.get(id); const pend = await S.db.get('pendingDeletes', []);
  if (c && c._sv != null) pend.push({ table: 'categories', id });
  S.categories.delete(id); await S.db.del('categories', id); await S.db.set('pendingDeletes', pend); Sync.schedule(); emit('categories');
}

/* ---------- Preferences ---------- */
function savePrefs(patch = {}) {
  Object.assign(S.prefs, patch); ls.set('kept.prefs', S.prefs); applyPrefs();
  if (S.db) S.db.set('prefs', S.prefs);
  Sync.schedulePrefs();
}
function applyPrefs() {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const th = S.prefs.theme === 'system' ? (sysDark ? 'dark' : 'light') : S.prefs.theme;
  document.documentElement.dataset.theme = th;
  document.documentElement.dataset.fs = S.prefs.textSize || 'm';
  document.documentElement.style.setProperty('--accent', S.prefs.accent);
  const light = ['#e5e5e5', '#f5b301'].includes(S.prefs.accent);
  document.documentElement.style.setProperty('--accent-ink', light ? '#111' : '#fff');
  $('meta[name="theme-color"]')?.setAttribute('content', th === 'dark' ? '#0a0a0b' : '#f2f1ee');
  setLang(S.prefs.lang || ((navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en'));
}

export { ACCENTS, CAT_COLORS, DEFAULT_PREFS, S, applyPrefs, catOf, deleteCategory, emit, entryDisplayTitle, isEmptyEntry, live, newEntry, onChange, purgeEntries, restoreEntries, saveCategory, saveEntries, saveEntry, migratePrefs, savePrefs, trashEntries, typeList, typeOf };
