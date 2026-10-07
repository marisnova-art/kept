/* Kept — IndexedDB store with in-memory fallback */
/* ---------- Local database (IndexedDB with in-memory fallback) ---------- */
class LocalDB {
  constructor(ns) { this.ns = ns; this.name = 'kept-' + ns; this.mem = null; }
  async open() {
    try {
      if (!('indexedDB' in window)) throw new Error('no idb');
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open(this.name, 1);
        r.onupgradeneeded = () => { const db = r.result; ['entries', 'categories', 'kv'].forEach(s => db.objectStoreNames.contains(s) || db.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' })); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
      });
    } catch (e) { console.warn('IndexedDB unavailable, using memory store', e); this.mem = { entries: new Map(), categories: new Map(), kv: new Map() }; this.volatile = true; }
    return this;
  }
  _tx(store, mode, fn) {
    if (this.mem) return Promise.resolve(fn(null));
    return new Promise((res, rej) => { const tx = this.db.transaction(store, mode); const st = tx.objectStore(store); let out; Promise.resolve(fn(st)).then(v => out = v); tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  }
  async all(store) {
    if (this.mem) return [...this.mem[store].values()].map(x => structuredClone(x));
    return this._tx(store, 'readonly', st => new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result); }));
  }
  async putMany(store, items) {
    if (!items.length) return;
    if (this.mem) { items.forEach(i => this.mem[store].set(i.id ?? i.k, structuredClone(i))); return; }
    return this._tx(store, 'readwrite', st => { items.forEach(i => st.put(i)); });
  }
  put(store, item) { return this.putMany(store, [item]); }
  async del(store, id) { if (this.mem) { this.mem[store].delete(id); return; } return this._tx(store, 'readwrite', st => st.delete(id)); }
  async delMany(store, ids) { if (this.mem) { ids.forEach(i => this.mem[store].delete(i)); return; } return this._tx(store, 'readwrite', st => ids.forEach(i => st.delete(i))); }
  async get(k, d) { if (this.mem) return this.mem.kv.has(k) ? this.mem.kv.get(k).v : d; const r = await this._tx('kv', 'readonly', st => new Promise(r => { const q = st.get(k); q.onsuccess = () => r(q.result); })); return r ? r.v : d; }
  async set(k, v) { if (this.mem) { this.mem.kv.set(k, { k, v }); return; } return this._tx('kv', 'readwrite', st => st.put({ k, v })); }
  async destroy() { if (this.mem) { this.mem = { entries: new Map(), categories: new Map(), kv: new Map() }; return; } this.db.close(); await new Promise(r => { const q = indexedDB.deleteDatabase(this.name); q.onsuccess = q.onerror = q.onblocked = () => r(); }); }
}

export { LocalDB };
