/* Kept — Export / import */
import { CAT_COLORS, S, catOf, emit, entryDisplayTitle, newEntry, savePrefs, typeList, typeOf } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { LIMITS } from '../lib/config.js';
import { fmtNum, t } from '../lib/i18n.js';
import { ICONS } from '../lib/icons.js';
import { htmlToText, sanitizeHTML } from '../lib/sanitize.js';
import { nowISO, todayKey, uid } from '../lib/utils.js';
import { confirmDlg, download, toast } from '../ui/feedback.js';

/* ---------- Data (export / import) ---------- */
const Data = {
  exportShape(entries, cats = []) { const strip = o => { const x = { ...o }; delete x._sv; delete x._dirty; return x; }; return { app: 'kept', format: 1, exported_at: nowISO(), entries: entries.map(strip), categories: cats.map(strip), prefs: { customTypes: S.prefs.customTypes, typeLabels: S.prefs.typeLabels } }; },
  json() { download(`kept-backup-${todayKey()}.json`, JSON.stringify(this.exportShape([...S.entries.values()], [...S.categories.values()]), null, 2), 'application/json'); toast(t('data.exported')); },
  csv() {
    const cols = ['id', 'type', 'title', 'text', 'category', 'tags', 'favorite', 'pinned', 'created_at', 'updated_at', 'deleted_at', 'due', 'done', 'priority', 'date', 'time', 'location', 'phone', 'email', 'address'];
    const q = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; // also guards CSV formula injection
    const rows = [...S.entries.values()].map(e => [e.id, typeOf(e.type).label, e.title, e.text, catOf(e.category_id)?.name, e.tags.join('; '), e.favorite, e.pinned, e.created_at, e.updated_at, e.deleted_at, e.meta.due, e.meta.done, e.meta.priority, e.meta.date, e.meta.time, e.meta.location, e.meta.phone, e.meta.email, e.meta.address].map(q).join(','));
    download(`kept-${todayKey()}.csv`, '﻿' + cols.join(',') + '\n' + rows.join('\n'), 'text/csv'); toast(t('data.exported'));
  },
  pick() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; if (f.size > 50e6) { toast(t('data.tooBig'), { error: true }); return; } try { this.import(JSON.parse(await f.text())); } catch { toast(t('data.invalid'), { error: true }); } };
    inp.click();
  },
  async import(obj) {
    if (!obj || obj.app !== 'kept' || !Array.isArray(obj.entries)) { toast(t('data.invalid'), { error: true }); return; }
    const catMap = new Map(); const newCats = [];
    (obj.categories || []).forEach(c => {
      if (!c || typeof c.name !== 'string') return;
      const byName = [...S.categories.values()].find(x => x.name.toLowerCase() === c.name.toLowerCase());
      if (S.categories.has(c.id)) catMap.set(c.id, c.id); else if (byName) catMap.set(c.id, byName.id);
      else { const id = /^[0-9a-f-]{36}$/i.test(c.id) ? c.id : uid(); newCats.push({ id, name: c.name.slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : CAT_COLORS[0], sort: 0, created_at: c.created_at || nowISO(), updated_at: nowISO(), _sv: null, _dirty: true }); catMap.set(c.id, id); }
    });
    let added = 0, skipped = 0, copies = 0; const out = [];
    const validType = id => typeList().some(x => x.id === id) || (obj.prefs?.customTypes || []).some(x => x.id === id);
    for (const r of obj.entries) {
      if (!r || typeof r !== 'object') continue;
      const clean = { type: validType(r.type) ? String(r.type) : 'note', title: String(r.title || '').slice(0, 300), content: sanitizeHTML(String(r.content || '')), category_id: catMap.get(r.category_id) || null,
        tags: Array.isArray(r.tags) ? r.tags.map(x => String(x).slice(0, LIMITS.tagLen)).slice(0, LIMITS.tagsPerEntry) : [], favorite: !!r.favorite, pinned: !!r.pinned,
        meta: r.meta && typeof r.meta === 'object' ? JSON.parse(JSON.stringify(r.meta)) : {}, created_at: r.created_at || nowISO(), deleted_at: r.deleted_at || null };
      clean.text = htmlToText(clean.content);
      const ex = S.entries.get(r.id);
      if (ex) { if (ex.content === clean.content && ex.title === clean.title) { skipped++; continue; } copies++; out.push(newEntry({ ...clean, title: (clean.title || entryDisplayTitle({ ...clean, title: '' })) + ' ' + t('data.importedSuffix') })); continue; }
      out.push(newEntry({ ...clean, id: /^[0-9a-f-]{36}$/i.test(r.id) ? r.id : uid(), updated_at: r.updated_at || nowISO() })); added++;
    }
    if (S.entries.size + out.length > LIMITS.entries) { toast(t('err.quota'), { error: true }); return; }
    const ok = await confirmDlg(t('data.importTitle'), t('data.importSum', { a: fmtNum(added), c: fmtNum(copies), s: fmtNum(skipped), k: fmtNum(newCats.length) }), t('data.importBtn'));
    if (!ok) return;
    for (const c of newCats) { S.categories.set(c.id, c); } await S.db.putMany('categories', newCats);
    if (obj.prefs?.customTypes) { const have = new Set((S.prefs.customTypes || []).map(x => x.id)); const add = obj.prefs.customTypes.filter(x => x && x.id && !have.has(x.id)).map(x => ({ id: String(x.id).slice(0, 40), label: String(x.label || 'Type').slice(0, 40), icon: ICONS[x.icon] ? x.icon : 'file-text' })); if (add.length) savePrefs({ customTypes: [...(S.prefs.customTypes || []), ...add] }); }
    out.forEach(e => { e._dirty = true; e._sv = null; S.entries.set(e.id, e); }); await S.db.putMany('entries', out); Sync.schedule(200); emit('entries'); emit('categories');
    toast(t('data.imported', { n: fmtNum(out.length) }));
  }
};

export { Data };
