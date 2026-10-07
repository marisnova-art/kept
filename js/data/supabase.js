/* Kept — Supabase connection */
import { Sync } from './sync.js';
import { CFG } from '../lib/config.js';
import { ls } from '../lib/utils.js';

/* =====================================================================
   AUTH (Supabase)
   ===================================================================== */
const Conn = {
  get() { const o = ls.get('kept.conn', {}); return { url: (CFG.SUPABASE_URL || o.url || '').trim(), key: (CFG.SUPABASE_ANON_KEY || o.key || '').trim(), fromFile: !!CFG.SUPABASE_URL } },
  configured() { const c = this.get(); return /^https:\/\/.+/.test(c.url) && c.key.length > 20; }
};
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
async function getSupabase() {
  if (Sync.sb) return Sync.sb;
  if (!Conn.configured()) return null;
  if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
  const c = Conn.get();
  Sync.sb = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kept.auth' } });
  return Sync.sb;
}

export { Conn, getSupabase };
