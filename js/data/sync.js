/* Kept — Local-first sync with Supabase (versions, conflicts, tombstones) */
import { DEFAULT_PREFS, S, applyPrefs, emit, entryDisplayTitle, migratePrefs } from './store.js';
import { Editor } from '../editor/editor.js';
import { Reminders } from '../features/reminders.js';
import { Share } from '../features/share.js';
import { t } from '../lib/i18n.js';
import { sanitizeHTML } from '../lib/sanitize.js';
import { ls, nowISO, uid } from '../lib/utils.js';
import { toast } from '../ui/feedback.js';

/* =====================================================================
   SYNC — local-first with version-checked writes & tombstones
   ===================================================================== */
const BASE_COLS = 'id,type,title,content,content_text,category_id,tags,favorite,pinned,meta,created_at,client_updated_at,deleted_at,version,updated_at';
// with shared folders on the server, rows also say who owns them and which folder they are shared in
const cols = () => BASE_COLS + (Share.supported ? ',user_id,folder_id' : '');
/* On someone else's shared record, favorite / pin / category are yours alone: they stay on this device and are never sent. */
const toRow = e => {
  const r = { id: e.id, type: e.type, title: e.title, content: e.content, content_text: e.text, category_id: e.category_id, tags: e.tags, favorite: e.favorite,
    pinned: e.pinned, meta: e.meta, created_at: e.created_at, client_updated_at: e.updated_at, deleted_at: e.deleted_at };
  if (Share.supported) r.folder_id = e.folder_id || null;
  if (!Share.isMine(e)) { delete r.favorite; delete r.pinned; delete r.category_id; }
  return r;
};
const fromRow = (r, prev) => {
  const e = { id: r.id, type: r.type, title: r.title || '', content: sanitizeHTML(r.content || ''), text: r.content_text || '', category_id: r.category_id, tags: r.tags || [],
    favorite: !!r.favorite, pinned: !!r.pinned, meta: r.meta || {}, created_at: r.created_at, updated_at: r.client_updated_at || r.updated_at, deleted_at: r.deleted_at, _sv: r.version, _dirty: false,
    owner: r.user_id ?? prev?.owner ?? null, folder_id: r.folder_id !== undefined ? r.folder_id : prev?.folder_id ?? null };
  if (!Share.isMine(e)) Object.assign(e, { favorite: !!prev?.favorite, pinned: !!prev?.pinned, category_id: prev?.category_id && S.categories.has(prev.category_id) ? prev.category_id : null });
  return e;
};
const catToRow = c => ({ id: c.id, name: c.name, color: c.color, sort: c.sort || 0, created_at: c.created_at, client_updated_at: c.updated_at });
const catFromRow = r => ({ id: r.id, name: r.name, color: r.color, sort: r.sort, created_at: r.created_at, updated_at: r.client_updated_at || r.updated_at, _sv: r.version, _dirty: false });

const Sync = {
  sb: null, timer: null, prefsTimer: null, running: false, again: false,
  set(state) { S.sync = state; emit('sync'); },
  schedule(ms = 1200) { if (S.mode !== 'cloud') return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
  schedulePrefs() { if (S.mode !== 'cloud') return; clearTimeout(this.prefsTimer); this.prefsTimer = setTimeout(() => this.pushPrefs(), 1500); },
  async run() {
    if (S.mode !== 'cloud') return;
    if (!this.sb) { this.set('offline'); return; }
    if (!navigator.onLine) { this.set('offline'); return; }
    if (this.running) { this.again = true; return; }
    this.running = true; this.set('syncing');
    try {
      const added = await Share.load(this.sb);
      await this.pushDeletes();
      await this.pushCategories();
      await this.pushEntries();
      await this.pull();
      if (Share.supported) { await this.pullFolders(added); await this.reconcile(); }
      Share.known = Share.folders.map(f => f.id); await Share.persist(); if (Share.changed) { Share.changed = false; emit('share'); }
      S.lastSyncAt = nowISO(); await S.db.set('lastSyncAt', S.lastSyncAt);
      this.set([...S.entries.values()].some(e => e._dirty) ? 'error' : 'synced');
    } catch (err) {
      console.warn('sync failed', err);
      this.set(navigator.onLine ? 'error' : 'offline');
      this.lastError = err?.message || String(err);
      if (/JWT|token|auth/i.test(this.lastError)) { await this.sb.auth.refreshSession().catch(() => {}); }
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.schedule(400); }
    }
  },
  async pushDeletes() {
    const pend = await S.db.get('pendingDeletes', []); if (!pend.length) return;
    for (const table of ['entries', 'categories']) {
      const ids = pend.filter(p => p.table === table).map(p => p.id); if (!ids.length) continue;
      for (let i = 0; i < ids.length; i += 200) { const { error } = await this.sb.from(table).delete().in('id', ids.slice(i, i + 200)); if (error) throw error; }
    }
    await S.db.set('pendingDeletes', []);
  },
  async pushCategories() {
    const dirty = [...S.categories.values()].filter(c => c._dirty);
    for (const c of dirty) {
      if (c._sv == null) {
        const { data, error } = await this.sb.from('categories').upsert(catToRow(c), { onConflict: 'id', ignoreDuplicates: false }).select('version').single();
        if (error) throw error; c._sv = data.version;
      } else {
        const { data, error } = await this.sb.from('categories').update(catToRow(c)).eq('id', c.id).select('version');
        if (error) throw error; c._sv = data[0]?.version ?? c._sv; // categories: last-write-wins (names/colors)
      }
      c._dirty = false; await S.db.put('categories', c);
    }
  },
  async pushEntries() {
    let dirty = [...S.entries.values()].filter(e => e._dirty);
    // a viewer's own touches (favorite, pin, category) on a shared record stay local
    const local = dirty.filter(e => !Share.isMine(e) && !Share.canEdit(e));
    if (local.length) { local.forEach(e => { e._dirty = false; }); await S.db.putMany('entries', local); dirty = dirty.filter(e => e._dirty); }
    const fresh = dirty.filter(e => e._sv == null), upd = dirty.filter(e => e._sv != null);
    for (let i = 0; i < fresh.length; i += 100) {
      const chunk = fresh.slice(i, i + 100); const stamps = new Map(chunk.map(e => [e.id, e.updated_at]));
      const { data, error } = await this.sb.from('entries').insert(chunk.map(toRow)).select('id,version');
      if (error) {
        if (error.code === '23505') { for (const e of chunk) await this.pushOne(e); continue; }
        if (/limit/i.test(error.message)) toast(t('err.quota'), { error: true });
        throw error;
      }
      const vm = new Map(data.map(r => [r.id, r.version]));
      chunk.forEach(e => { if (vm.has(e.id)) { e._sv = vm.get(e.id); if (S.entries.get(e.id) === e && e.updated_at === stamps.get(e.id)) e._dirty = false; } });
      await S.db.putMany('entries', chunk);
    }
    for (const e of upd) await this.pushOne(e);
  },
  async pushOne(e) {
    const snapshotUpdated = e.updated_at;
    if (e._sv == null) {
      const { data: ex } = await this.sb.from('entries').select(cols()).eq('id', e.id).maybeSingle();
      if (ex) { await this.conflict(e, ex); return; }
      const { data, error } = await this.sb.from('entries').insert(toRow(e)).select('version').single();
      if (error) throw error; e._sv = data.version;
    } else {
      const { data, error } = await this.sb.from('entries').update(toRow(e)).eq('id', e.id).eq('version', e._sv).select('version');
      if (error) throw error;
      if (!data.length) {
        const { data: ex, error: e2 } = await this.sb.from('entries').select(cols()).eq('id', e.id).maybeSingle();
        if (e2) throw e2;
        if (!ex) { e._sv = null; return this.pushOne(e); } // deleted remotely → recreate local work
        await this.conflict(e, ex); return;
      }
      e._sv = data[0].version;
    }
    if (e.updated_at === snapshotUpdated) e._dirty = false;
    await S.db.put('entries', e);
  },
  /* Never silently overwrite: server copy wins the original id, local edits are kept as a separate copy. */
  async conflict(local, serverRow) {
    const server = fromRow(serverRow, local);
    const sameContent = server.title === local.title && server.content === local.content && JSON.stringify(server.meta) === JSON.stringify(local.meta);
    if (sameContent) { local._sv = server._sv; local._dirty = false; await S.db.put('entries', local); return; }
    const copy = Object.assign(structuredClone(local), { id: uid(), _sv: null, _dirty: true, owner: S.user?.id || null, folder_id: Share.writable().some(f => f.id === local.folder_id) ? local.folder_id : null, title: (local.title || entryDisplayTitle(local)) + ' ' + t('sync.conflictSuffix'), created_at: nowISO() });
    S.entries.set(server.id, server); S.entries.set(copy.id, copy);
    await S.db.putMany('entries', [server, copy]);
    Editor.onExternalChange(server.id);
    this.again = true; // push the conflict copy in the next pass
    toast(t('sync.conflict'), { action: t('common.open'), onAction: () => Editor.open(copy.id), ms: 8000 });
    emit('entries');
  },
  async pull() {
    let cursor = await S.db.get('pullCursor', '1970-01-01T00:00:00Z');
    // categories (small)
    const { data: cats, error: ce } = await this.sb.from('categories').select('id,name,color,sort,created_at,client_updated_at,updated_at,version').gt('updated_at', cursor);
    if (ce) throw ce;
    const catPut = [];
    cats.forEach(r => { const l = S.categories.get(r.id); if (l && l._dirty) return; const c = catFromRow(r); S.categories.set(c.id, c); catPut.push(c); });
    await S.db.putMany('categories', catPut);
    let maxCur = cursor; cats.forEach(r => { if (r.updated_at > maxCur) maxCur = r.updated_at; });
    // entries, paginated
    let changed = catPut.length > 0;
    // small overlap guards against rows committed slightly out of order; re-reading a row is harmless
    let since = new Date(new Date(cursor).getTime() - 10000).toISOString();
    for (let page = 0; page < 200; page++) {
      const { data, error } = await this.sb.from('entries').select(cols()).gt('updated_at', since).order('updated_at', { ascending: true }).limit(500);
      if (error) throw error;
      if (!data.length) break;
      const put = [];
      for (const r of data) {
        const l = S.entries.get(r.id);
        if (l && l._dirty) { if (l._sv !== r.version) await this.conflict(l, r); continue; }
        if (l && l._sv === r.version) continue;
        const e = fromRow(r, l); S.entries.set(e.id, e); put.push(e); Editor.onExternalChange(e.id);
      }
      await S.db.putMany('entries', put); changed = changed || put.length > 0;
      cursor = since = data[data.length - 1].updated_at; if (cursor > maxCur) maxCur = cursor;
      if (data.length < 500) break;
    }
    // tombstones
    const tombSince = await S.db.get('tombCursor', '1970-01-01T00:00:00Z');
    const { data: tomb, error: te } = await this.sb.from('deleted_records').select('record_id,table_name,deleted_at').gt('deleted_at', tombSince).order('deleted_at').limit(5000);
    if (te) throw te;
    if (tomb.length) {
      const eIds = tomb.filter(x => x.table_name === 'entries').map(x => x.record_id).filter(id => S.entries.has(id) && !S.entries.get(id)._dirty);
      const cIds = tomb.filter(x => x.table_name === 'categories').map(x => x.record_id).filter(id => S.categories.has(id));
      eIds.forEach(id => S.entries.delete(id)); cIds.forEach(id => S.categories.delete(id));
      await S.db.delMany('entries', eIds); await S.db.delMany('categories', cIds);
      await S.db.set('tombCursor', tomb[tomb.length - 1].deleted_at); changed = changed || eIds.length || cIds.length;
    }
    await S.db.set('pullCursor', maxCur > cursor ? maxCur : cursor);
    if (changed) { emit('entries'); emit('categories'); Reminders.reschedule(); }
  },
  /* a folder that is new to this device (just joined, or first sync here): fetch all its records, whatever their age */
  async pullFolders(ids) {
    let changed = false;
    for (const fid of ids) {
      for (let from = 0; from < 100000; from += 500) {
        const { data, error } = await this.sb.from('entries').select(cols()).eq('folder_id', fid).order('id').range(from, from + 499);
        if (error) throw error;
        const put = [];
        for (const r of data) { const l = S.entries.get(r.id); if ((l && l._dirty) || (l && l._sv === r.version)) continue; const e = fromRow(r, l); S.entries.set(e.id, e); put.push(e); }
        await S.db.putMany('entries', put); changed = changed || put.length > 0;
        if (data.length < 500) break;
      }
    }
    if (changed) { emit('entries'); Reminders.reschedule(); }
  },
  /* Records leave a member's view without a tombstone (removed from the folder, moved out, deleted by the owner),
     so ask which of the others' records are still visible and drop the rest. My own records in a folder
     I no longer belong to go back to private. */
  async reconcile() {
    const me = S.user?.id; if (!me) return;
    const others = [...S.entries.values()].filter(e => e.owner && e.owner !== me && !e._dirty).map(e => e.id);
    const gone = [];
    for (let i = 0; i < others.length; i += 150) {
      const chunk = others.slice(i, i + 150);
      const { data, error } = await this.sb.from('entries').select('id').in('id', chunk);
      if (error) throw error;
      const seen = new Set(data.map(r => r.id)); chunk.forEach(id => { if (!seen.has(id)) gone.push(id); });
    }
    if (gone.length) { gone.forEach(id => S.entries.delete(id)); await S.db.delMany('entries', gone); }
    const mine = new Set(Share.folders.map(f => f.id));
    const orphans = [...S.entries.values()].filter(e => e.folder_id && !mine.has(e.folder_id) && Share.isMine(e));
    if (orphans.length) { orphans.forEach(e => { e.folder_id = null; e._dirty = true; }); await S.db.putMany('entries', orphans); this.again = true; }
    if (gone.length || orphans.length) { emit('entries'); Reminders.reschedule(); }
  },
  async pullPrefs() {
    const { data, error } = await this.sb.from('user_settings').select('prefs,updated_at').maybeSingle();
    if (error || !data) return;
    const localAt = await S.db.get('prefsAt', '1970');
    if (data.updated_at > localAt && data.prefs) { const keep = { lang: S.prefs.lang }; Object.assign(S.prefs, DEFAULT_PREFS, migratePrefs(data.prefs)); if (!data.prefs.lang) S.prefs.lang = keep.lang; ls.set('kept.prefs', S.prefs); applyPrefs(); emit('prefs'); }
  },
  async pushPrefs() {
    if (S.mode !== 'cloud' || !this.sb || !navigator.onLine) return;
    const at = nowISO(); await S.db.set('prefsAt', at);
    const { error } = await this.sb.from('user_settings').upsert({ user_id: S.user.id, prefs: S.prefs, updated_at: at }, { onConflict: 'user_id' });
    if (error) console.warn('prefs sync', error);
  }
};

export { Sync };
