/* Kept — Boot */
import './lib/icons.js';
import './lib/config.js';
import './lib/utils.js';
import './lib/i18n.js';
import './lib/sanitize.js';
import './data/local-db.js';
import './ui/feedback.js';
import './data/store.js';
import './data/sync.js';
import './data/supabase.js';
import './features/reminders.js';
import './editor/rich.js';
import './editor/editor.js';
import './data/cities.js';
import './features/aurora.js';
import './features/prompts.js';
import './features/weather.js';
import './ui/router.js';
import './features/search.js';
import './ui/entries.js';
import './views/today.js';
import './views/lists.js';
import './views/tasks.js';
import './views/calendar.js';
import './views/items.js';
import './views/organize.js';
import './views/settings.js';
import './views/pages.js';
import './features/avatar.js';
import './ui/shell.js';
import './features/data-io.js';
import './features/install.js';
import './editor/composer.js';
import './app/actions.js';
import './app/menus.js';
import './app/events.js';
import './app/auth-screen.js';
import './app/session.js';
import { showAuth } from './app/auth-screen.js';
import { bindGlobal } from './app/events.js';
import { startCloud, startLocal } from './app/session.js';
import { S, applyPrefs } from './data/store.js';
import { Conn, getSupabase } from './data/supabase.js';
import { Sync } from './data/sync.js';
import { Editor } from './editor/editor.js';
import { APP_VERSION } from './lib/config.js';
import { applyI18n, t } from './lib/i18n.js';
import { $, ls } from './lib/utils.js';

/* ---------- Boot ---------- */
async function boot() {
  applyPrefs(); applyI18n(); bindGlobal();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(APP_VERSION)).catch(() => {});
  navigator.serviceWorker?.addEventListener?.('message', e => { if (e.data?.open) { Editor.open(e.data.open); } });
  if (Conn.configured()) {
    try {
      const sb = await getSupabase();
      let recovery = /type=recovery/.test(location.hash);
      sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { recovery = true; $('#boot').classList.add('gone'); showAuth('newpw'); }
        if (ev === 'SIGNED_OUT' && S.mode === 'cloud') { S.mode = 'local'; }
        if (ev === 'TOKEN_REFRESHED' && S.mode === 'cloud') Sync.schedule(100);
      });
      const { data: { session } } = await sb.auth.getSession();
      if (/access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/today');
      if (recovery) { $('#boot').classList.add('gone'); showAuth('newpw'); return; }
      if (session?.user) return startCloud(session.user);
    } catch (err) {
      console.warn(err);
      const lu = ls.get('kept.lastUser'); if (lu?.id) return startCloud(lu, { offline: true });
      if (ls.get('kept.mode') !== 'local') { $('#boot').classList.add('gone'); showAuth('signin', false, t('err.connFail')); return; }
    }
    if (ls.get('kept.mode') !== 'local') { $('#boot').classList.add('gone'); showAuth('signin'); return; }
  }
  return startLocal();
}
boot();
