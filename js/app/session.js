/* Kept — Local and cloud sessions */
import { showAuth } from './auth-screen.js';
import { netbar } from './events.js';
import { LocalDB } from '../data/local-db.js';
import { S, applyPrefs, emit, migratePrefs, purgeEntries } from '../data/store.js';
import { getSupabase } from '../data/supabase.js';
import { Sync } from '../data/sync.js';
import { Editor } from '../editor/editor.js';
import { Billing } from '../features/billing.js';
import { Gate } from '../features/story.js';
import { Reminders } from '../features/reminders.js';
import { Share } from '../features/share.js';
import { Weather } from '../features/weather.js';
import { applyI18n, t, tn } from '../lib/i18n.js';
import { $, ls, uid } from '../lib/utils.js';
import { confirmDlg, toast } from '../ui/feedback.js';
import { render, shell } from '../ui/shell.js';

/* ---------- Session start ---------- */
async function loadNamespace(ns) {
  S.ns = ns; S.db = await new LocalDB(ns).open(); S.volatile = !!S.db.volatile;
  const [ents, cats] = await Promise.all([S.db.all('entries'), S.db.all('categories')]);
  S.entries = new Map(ents.map(e => [e.id, e])); S.categories = new Map(cats.map(c => [c.id, c]));
  const p = migratePrefs(await S.db.get('prefs', null)); if (p) { Object.assign(S.prefs, p, { lang: S.prefs.lang || p.lang }); applyPrefs(); }
  S.lastSyncAt = await S.db.get('lastSyncAt', null);
  await Share.restore();
  // auto-purge trash older than 30 days
  const lim = Date.now() - 30 * 864e5; const old = [...S.entries.values()].filter(e => e.deleted_at && new Date(e.deleted_at) < lim).map(e => e.id);
  if (old.length) await purgeEntries(old);
}
async function startLocal() {
  S.mode = 'local'; S.user = null; await loadNamespace('local'); S.sync = 'local';
  enterApp();
  if (S.volatile) toast(t('err.noStorage'), { error: true, ms: 7000 });
}
async function startCloud(user, { offline = false } = {}) {
  S.mode = 'cloud'; S.user = { id: user.id, email: user.email }; await loadNamespace(user.id); Sync.set(navigator.onLine && !offline ? 'syncing' : 'offline');
  ls.set('kept.lastUser', S.user); ls.del('kept.mode'); enterApp();
  if (offline) { reconnectLater(); return; }
  Gate.hold(Sync.pullPrefs().then(() => render()));
  await Gate.hold(Sync.run());
  Billing.refresh().catch(() => {});
  // offer to move device-only records into the account
  try { const loc = await new LocalDB('local').open(); const n = (await loc.all('entries')).length; if (n) { const ok = await confirmDlg(t('mig.title'), tn('mig.body', n), t('mig.go')); if (ok) await migrateLocal(loc); } } catch {}
}
async function migrateLocal(loc) {
  loc = loc || await new LocalDB('local').open();
  const [ents, cats] = await Promise.all([loc.all('entries'), loc.all('categories')]);
  cats.forEach(c => { c._dirty = true; c._sv = null; if (!S.categories.has(c.id)) S.categories.set(c.id, c); });
  ents.forEach(e => { e._dirty = true; e._sv = null; if (S.entries.has(e.id)) e.id = uid(); S.entries.set(e.id, e); });
  await S.db.putMany('categories', cats); await S.db.putMany('entries', ents); await loc.destroy();
  emit('entries'); Sync.run(); toast(tn('mig.done', ents.length));
}
/* Signed-in user, but the sync library/server is unreachable (e.g. offline cold start): keep working locally and reconnect. */
let reconnecting = false;
function reconnectLater() {
  if (reconnecting) return; reconnecting = true;
  const attempt = async () => {
    if (!navigator.onLine) return;
    try {
      const sb = await getSupabase(); const { data: { session } } = await sb.auth.getSession();
      clearInterval(timer); removeEventListener('online', attempt); reconnecting = false;
      if (session?.user?.id === S.user.id) { Sync.pullPrefs().catch(() => {}); Sync.run(); }
      else showAuth('signin', true, t('auth.sessionExpired'));
    } catch { Sync.sb = null; }
  };
  const timer = setInterval(attempt, 30000); addEventListener('online', attempt); setTimeout(attempt, 1500);
}
function enterApp() {
  $('#auth').hidden = true; applyPrefs(); shell(); applyI18n(); Editor.init(); render();
  Reminders.reschedule(); $('#boot').classList.add('gone'); Weather.auto();
  if (!navigator.onLine) netbar(true);
}

export { migrateLocal, startCloud, startLocal };
