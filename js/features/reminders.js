/* Kept — In-app reminders via the Notification API */
import { S, entryDisplayTitle, live, savePrefs } from '../data/store.js';
import { fmtDate } from '../lib/i18n.js';
import { addDays, dayKey, debounce, ls } from '../lib/utils.js';
import { toast } from '../ui/feedback.js';
import { occursOn } from '../views/today.js';

/* ---------- Reminders (honest: only while the app is open, via Notification API) ---------- */
const Reminders = {
  timers: [],
  supported: () => 'Notification' in window,
  permission: () => ('Notification' in window ? Notification.permission : 'unsupported'),
  async request() { if (!this.supported()) return 'unsupported'; const p = await Notification.requestPermission(); savePrefs({ notify: p === 'granted' }); this.reschedule(); return p; },
  upcoming(hours = 24) {
    const now = Date.now(), lim = now + hours * 3600e3, out = [];
    live().forEach(e => {
      let at = null, when = null;
      if (e.type === 'event' && e.meta.date && e.meta.remind != null && e.meta.remind !== '') {
        const tm = e.meta.time || '09:00'; const span = Math.ceil(hours / 24) + 2;
        const dks = e.meta.repeat ? [...Array(span)].map((_, i) => dayKey(addDays(new Date(), i))).filter(dk => occursOn(e, dk)) : [e.meta.date];
        dks.forEach(dk => { const w = new Date(`${dk}T${tm}`).getTime(), a = w - Number(e.meta.remind) * 60e3; if (a > now - 1000 && a < lim) out.push({ e, at: a, when: w }); });
        return;
      } else if (e.type === 'todo' && !e.meta.done && e.meta.due && e.meta.remind != null && e.meta.remind !== '') {
        const tm = e.meta.due_time || '09:00'; when = new Date(`${e.meta.due}T${tm}`).getTime(); at = when - Number(e.meta.remind) * 60e3;
      }
      if (at && at > now - 1000 && at < lim) out.push({ e, at, when });
    });
    return out.sort((a, b) => a.at - b.at);
  },
  reschedule: debounce(function () {
    Reminders.timers.forEach(clearTimeout); Reminders.timers = [];
    if (!S.prefs.notify || Reminders.permission() !== 'granted') return;
    Reminders.upcoming(24).forEach(({ e, at, when }) => {
      const key = `kept.fired.${e.id}.${at}`;
      if (ls.get(key)) return;
      Reminders.timers.push(setTimeout(() => { ls.set(key, 1); Reminders.fire(e, when); }, Math.max(0, at - Date.now())));
    });
  }, 500),
  async fire(e, when) {
    const body = `${fmtDate(new Date(when), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
    const opts = { body, tag: e.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { id: e.id } };
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) reg.showNotification(entryDisplayTitle(e), opts); else new Notification(entryDisplayTitle(e), opts);
    } catch { toast(entryDisplayTitle(e) + ' · ' + body); }
  }
};

export { Reminders };
