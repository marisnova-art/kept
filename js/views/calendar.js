/* Kept — Calendar */
import { S, catOf, entryDisplayTitle } from '../data/store.js';
import { Reminders } from '../features/reminders.js';
import { LANG, fmtDate, fmtTime, t } from '../lib/i18n.js';
import { $, addDays, dayKey, debounce, esc, icon, parseDay, startOfWeek, todayKey } from '../lib/utils.js';
import { closeLayers } from '../ui/feedback.js';
import { header } from '../ui/entries.js';
import { V } from '../ui/router.js';
import { dayAgenda, dayDots, dayItems, repeatLabel } from './today.js';

/* ---------- Calendar ---------- */
const sortDay = l => l.sort((x, y) => (x.type === 'todo') - (y.type === 'todo') || (x.meta.time || x.meta.due_time || '').localeCompare(y.meta.time || y.meta.due_time || ''));
/* short time like Google Calendar: "오후 3시", "3:30pm" */
function shortTime(hm) {
  const [h, m] = hm.split(':').map(Number); const h12 = h % 12 || 12;
  return LANG === 'ko' ? `${h < 12 ? '오전' : '오후'} ${h12}${m ? ':' + String(m).padStart(2, '0') : '시'}` : `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
}
/* one line per record inside a month cell or the day popover; tapping it opens the record */
function chip(e, { full = false } = {}) {
  const c = catOf(e.category_id)?.color; const st = c ? ` style="--evc:${esc(c)}"` : ''; const ttl = esc(entryDisplayTitle(e));
  const base = `role="button" tabindex="0" data-act="open" data-id="${e.id}" title="${ttl}"${st}`;
  if (e.type === 'todo') return `<div class="ch td ${e.meta.done ? 'done' : ''}" ${base}>${full ? `<button class="bx" data-act="toggleDone" data-id="${e.id}" aria-label="${esc(t('task.toggle'))}">${icon('check')}</button>` : '<i class="bx"></i>'}${full && e.meta.due_time ? `<span class="t">${esc(fmtTime(e.meta.due_time))}</span>` : ''}<span class="x">${ttl}</span></div>`;
  if (!e.meta.time) return `<div class="ch allday" ${base}>${e.meta.repeat ? icon('repeat') : ''}<span class="x">${ttl}</span></div>`;
  return `<div class="ch timed" ${base}><i class="dt"></i><span class="t">${esc(full ? fmtTime(e.meta.time) + (e.meta.end_time ? ' – ' + fmtTime(e.meta.end_time) : '') : shortTime(e.meta.time))}</span><span class="x">${ttl}</span></div>`;
}
function viewCalendar() {
  const c = V.cal; const a = c.anchor; const k = todayKey(); const ws = S.prefs.weekStart;
  const dayCache = new Map();
  const byDay = { get: dk => { if (!dayCache.has(dk)) dayCache.set(dk, sortDay(dayItems(dk))); return dayCache.get(dk); } };
  const col = e => catOf(e.category_id)?.color;
  const pill = e => e.type === 'event'
    ? `<div class="ev" data-act="open" data-id="${e.id}" style="${col(e) ? `--evc:${esc(col(e))}` : ''}">${e.meta.repeat ? `<span class="rp">${icon('repeat')}</span>` : ''}${e.meta.time ? `<span class="t">${esc(fmtTime(e.meta.time))}</span>` : ''}<span class="x">${esc(entryDisplayTitle(e))}</span></div>`
    : `<div class="ev task ${e.meta.done ? 'done' : ''}" data-act="open" data-id="${e.id}" style="${col(e) ? `--evc:${esc(col(e))}` : ''}"><span class="x">${esc(entryDisplayTitle(e))}</span></div>`;
  const heads = [...Array(7)].map((_, i) => fmtDate(addDays(startOfWeek(new Date(2024, 0, 10), ws), i), { weekday: 'short' }));
  let grid, title, calSub = '';
  if (c.mode === 'month') {
    const first = new Date(a.getFullYear(), a.getMonth(), 1); const start = startOfWeek(first, ws);
    title = fmtDate(first, { month: 'long', year: 'numeric' });
    const cells = [...Array(42)].map((_, i) => addDays(start, i));
    const trimmed = cells[35].getMonth() !== a.getMonth() ? cells.slice(0, 35) : cells;
    grid = `<div class="cal-head">${heads.map((h, i) => `<span class="${(ws + i) % 7 === 0 ? 'sun' : (ws + i) % 7 === 6 ? 'sat' : ''}">${esc(h)}</span>`).join('')}</div><div class="cal-grid">${trimmed.map(d => { const dk = dayKey(d); const l = byDay.get(dk) || [];
      return `<div class="cd ${d.getMonth() !== a.getMonth() ? 'out' : ''} ${dk === k ? 'today' : ''} ${dk === c.sel ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : ''} ${l.length ? 'has' : ''}" data-act="calDay" data-d="${dk}" tabindex="0"><span class="dn">${d.getDate()}</span><div class="evs">${l.map(e => chip(e)).join('')}</div><button class="cmore" data-act="calMore" data-d="${dk}" hidden></button>${dayDots(dk)}</div>`; }).join('')}</div>`;
  } else {
    const start = startOfWeek(a, ws); const end = addDays(start, 6);
    title = `${fmtDate(start, { month: 'short', day: 'numeric' })} – ${fmtDate(end, start.getMonth() === end.getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
    calSub = fmtDate(end, { year: 'numeric' });
    grid = `<div class="week-cols">${[...Array(7)].map((_, i) => { const d = addDays(start, i), dk = dayKey(d); const l = byDay.get(dk) || [];
      return `<div class="wcol ${dk === k ? 'today' : ''} ${dk === c.sel ? 'sel' : ''} ${l.length ? '' : 'empty'}" data-act="calDay" data-d="${dk}"><div class="wh"><b>${d.getDate()}</b><span>${esc(fmtDate(d, { weekday: 'short' }))}</span></div><div class="evs">${l.length ? l.map(pill).join('') : `<span class="none">${esc(t('cal.free'))}</span>`}</div></div>`; }).join('')}</div>`;
  }
  const ag = dayAgenda(c.sel);
  const selD = parseDay(c.sel);
  const rows = ag.ev.map(e => `<div class="ag-row ag-ev" data-act="open" data-id="${e.id}" style="${catOf(e.category_id) ? `--evc:${esc(catOf(e.category_id).color)}` : ''}"><span class="ag-time">${e.meta.time ? `<b>${esc(fmtTime(e.meta.time))}</b>${e.meta.end_time ? `<small>${esc(fmtTime(e.meta.end_time))}</small>` : ''}` : `<b>${esc(t('cal.allDay'))}</b>`}</span><span class="ag-bar"></span><span class="at">${esc(entryDisplayTitle(e))}${e.meta.repeat ? `<small class="ag-rp">${icon('repeat')}${esc(repeatLabel(e.meta, true))}</small>` : ''}</span></div>`)
    .concat(ag.td.map(e => `<div class="ag-row ag-td ${e.meta.done ? 'done' : ''}" data-act="open" data-id="${e.id}"><span class="ag-time"><b>${esc(e.meta.due_time ? fmtTime(e.meta.due_time) : t('type.todo'))}</b></span><button class="ag-chk ${e.meta.done ? 'on' : ''}" data-act="toggleDone" data-id="${e.id}" aria-label="${esc(t('task.toggle'))}">${icon('check')}</button><span class="at">${esc(entryDisplayTitle(e))}</span></div>`));
  return `<div class="wrap view-enter cal-page m-${c.mode}">${header(`<span class="nowrap">${esc(title)}</span>`, esc(calSub), `<div class="ph-actions"><div class="seg">${['month', 'week'].map(m => `<button class="${c.mode === m ? 'on' : ''}" data-act="calMode" data-v="${m}">${esc(t('cal.' + m))}</button>`).join('')}</div>
      <button class="btn sm" data-act="calNav" data-d="0">${esc(t('date.today'))}</button><button class="icon-btn" data-act="calNav" data-d="-1" aria-label="${esc(t('common.prev'))}">${icon('chevron-left')}</button><button class="icon-btn" data-act="calNav" data-d="1" aria-label="${esc(t('common.next'))}">${icon('chevron-right')}</button></div>`)}
    <div class="cal-wrap"><div class="cal ${c.mode}" id="calGrid">${grid}</div>
      <aside class="sheet"><div class="sh-head"><span>${esc(fmtDate(selD, { weekday: 'long', month: 'long', day: 'numeric' }))}</span></div>
        ${rows.length ? rows.join('') : `<div class="ag-empty"><span>${esc(t('today.agendaEmpty'))}</span></div>`}
        <div style="display:flex;gap:6px;padding:10px 0 12px"><button class="btn sm" data-act="new" data-type="event" data-date="${c.sel}">${icon('plus')}${esc(t('cal.addEvent'))}</button><button class="btn sm" data-act="new" data-type="todo" data-date="${c.sel}">${icon('plus')}${esc(t('cal.addTask'))}</button></div>
      </aside></div>
    ${Reminders.permission() !== 'granted' ? `<div class="note" style="margin-top:18px">${icon('bell')}<span style="flex:1">${esc(t('notif.hint'))}</span><a class="btn sm" href="#/settings#notifications">${esc(t('nav.settings'))}</a></div>` : ''}</div>`;
}

/* Month cells show as many lines as fit and fold the rest into "+N more", like Google Calendar.
   Runs after each render and on resize; phones keep the dot view, so nothing to fit there. */
function fitMonth() {
  const g = $('.cal.month .cal-grid'); if (!g) return;
  for (const cd of g.children) {
    const box = cd.querySelector('.evs'), more = cd.querySelector('.cmore'); if (!box || !more) continue;
    const chips = [...box.children]; chips.forEach(n => { n.hidden = false; }); more.hidden = true;
    if (!chips.length || getComputedStyle(box).display === 'none' || box.scrollHeight <= box.clientHeight + 1) continue;
    more.hidden = false;
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0; const h = chips[0].offsetHeight + gap;
    const fit = Math.max(0, Math.floor((box.clientHeight + gap) / h));
    chips.forEach((n, i) => { n.hidden = i >= fit; });
    more.textContent = t('cal.more', { n: chips.length - fit });
  }
}
addEventListener('resize', debounce(fitMonth, 120));

/* Day popover: the records of one day over the grid, with quick add */
function dayPop(dk, anchor) {
  closeLayers();
  const d = parseDay(dk); const l = sortDay(dayItems(dk));
  const p = document.createElement('div'); p.className = 'cal-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }));
  p.innerHTML = `<div class="cp-h"><span class="wd">${esc(fmtDate(d, { weekday: 'short' }))}</span><b class="${dk === todayKey() ? 'today' : ''}">${d.getDate()}</b><button class="icon-btn cp-x" data-act="calPopClose" aria-label="${esc(t('common.close'))}">${icon('x')}</button></div>
    <div class="cp-l">${l.length ? l.map(e => chip(e, { full: true })).join('') : `<div class="cp-empty">${esc(t('today.agendaEmpty'))}</div>`}</div>
    <div class="cp-a"><button class="btn sm" data-act="new" data-type="event" data-date="${dk}">${icon('plus')}${esc(t('cal.addEvent'))}</button><button class="btn sm" data-act="new" data-type="todo" data-date="${dk}">${icon('plus')}${esc(t('cal.addTask'))}</button></div>`;
  document.body.append(p); anchor.classList.add('popped');
  const close = () => { p.remove(); anchor.classList.remove('popped'); };
  const r = anchor.getBoundingClientRect(); const W = p.offsetWidth, H = p.offsetHeight;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - W / 2), innerWidth - W - 12);
  const top = Math.min(Math.max(12, r.top - 6), innerHeight - H - 12);
  p.style.left = left + 'px'; p.style.top = top + 'px'; p.style.setProperty('--ox', (r.left + r.width / 2 - left) + 'px');
  p.addEventListener('click', e => { if (e.target.closest('[data-act="open"]:not(.bx),[data-act="new"]') && !e.target.closest('.bx')) setTimeout(close, 0); });
  const off = e => { if (!p.isConnected) return removeEventListener('pointerdown', off, true); if (!p.contains(e.target) && !e.target.closest?.('.cmore,.cd')) { close(); removeEventListener('pointerdown', off, true); } };
  addEventListener('pointerdown', off, true);
  p.querySelector('.cp-l [tabindex], .cp-a button')?.focus({ preventScroll: true });
}
/* the month grid on a wide screen answers a click with the popover; phones and the week view use the agenda below */
const popMode = () => V.cal.mode === 'month' && matchMedia('(min-width:901px)').matches;

export { dayPop, fitMonth, popMode, viewCalendar };
