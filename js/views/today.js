/* Kept — Today (home) */
import { S, catOf, entryDisplayTitle, live, newEntry, saveEntry, typeOf } from '../data/store.js';
import { Editor, haptic } from '../editor/editor.js';
import { Aurora } from '../features/aurora.js';
import { avatarHTML } from '../features/avatar.js';
import { installBanner } from '../features/install.js';
import { Prompts } from '../features/prompts.js';
import { snippet, sortEntries } from '../features/search.js';
import { Weather } from '../features/weather.js';
import { LANG, fmtDate, fmtTime, t, tn } from '../lib/i18n.js';
import { Gate, storyHTML } from '../features/story.js';
import { htmlToText, hydrateIcons, sanitizeHTML } from '../lib/sanitize.js';
import { $, addDays, dayKey, esc, icon, ls, pad, parseDay, startOfWeek, todayKey } from '../lib/utils.js';
import { rowS } from '../ui/entries.js';
import { burst, toast } from '../ui/feedback.js';
import { V } from '../ui/router.js';
import { UI } from '../ui/shell.js';

/* ---------- Today ---------- */
const PROMPTS = 8;
function streak() {
  const days = new Set(live().map(e => dayKey(new Date(e.created_at)))); [...S.entries.values()].forEach(e => days.add(dayKey(new Date(e.updated_at))));
  let d = new Date(), n = 0; if (!days.has(dayKey(d))) d = addDays(d, -1);
  while (days.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}
function dayAgenda(k) {
  const ev = live().filter(e => isEventOn(e, k)).sort((a, b) => (a.meta.time || '').localeCompare(b.meta.time || ''));
  const td = live().filter(e => e.type === 'todo' && e.meta.due === k).sort((a, b) => (a.meta.done - b.meta.done) || (a.meta.due_time || '99').localeCompare(b.meta.due_time || '99'));
  return { ev, td };
}
/* recurring schedules: an event repeats from its date — weekly, monthly (same day, clamped to month end) or yearly — optionally until a date */
const REPEATS = ['', 'weekly', 'monthly', 'yearly'];
function occursOn(e, dk) {
  const m = e.meta || {}; const base = m.date; if (!base || !dk) return false;
  if (base === dk) return true;
  const r = m.repeat; if (!r || dk < base || (m.repeat_until && dk > m.repeat_until)) return false;
  const b = parseDay(base), d = parseDay(dk); const lastDay = (y, mo) => new Date(y, mo + 1, 0).getDate();
  if (r === 'weekly') return Math.round((d - b) / 864e5) % 7 === 0;
  const bd = Math.min(b.getDate(), lastDay(d.getFullYear(), d.getMonth()));
  if (r === 'monthly') return d.getDate() === bd;
  if (r === 'yearly') return d.getMonth() === b.getMonth() && d.getDate() === bd;
  return false;
}
const isEventOn = (e, dk) => e.type === 'event' && occursOn(e, dk);
function repeatLabel(m, short) {
  if (!m || !m.repeat || !m.date) return '';
  const b = parseDay(m.date);
  const what = m.repeat === 'weekly' ? t('repeat.weeklyOn', { d: fmtDate(b, { weekday: short ? 'short' : 'long' }) })
    : m.repeat === 'monthly' ? t('repeat.monthlyOn', { n: b.getDate() })
    : t('repeat.yearlyOn', { d: fmtDate(b, { month: 'short', day: 'numeric' }) });
  return short ? what : what + (m.repeat_until ? ' · ' + t('repeat.untilShort', { d: fmtDate(parseDay(m.repeat_until), { month: 'short', day: 'numeric' }) }) : '');
}
function dayItems(dk) { return live().filter(e => isEventOn(e, dk) || (e.type === 'todo' && e.meta.due === dk)); }
function dayDots(dk, max = 3) {
  const l = dayItems(dk); if (!l.length) return '<span class="dots"></span>';
  return `<span class="dots">${l.slice(0, max).map(e => `<i class="${e.type === 'todo' ? (e.meta.done ? 'td done' : 'td') : 'ev'}" style="${catOf(e.category_id) ? `--dc:${esc(catOf(e.category_id).color)}` : ''}"></i>`).join('')}</span>`;
}
function viewToday() {
  const now = new Date(), k = todayKey(); const h = now.getHours();
  const greet = t(h < 5 ? 'today.night' : h < 12 ? 'today.morning' : h < 18 ? 'today.afternoon' : 'today.evening');
  const name = S.prefs.displayName || (S.user?.email ? S.user.email.split('@')[0] : '');
  const { ev, td } = dayAgenda(k); const openTd = td.filter(e => !e.meta.done);
  const ideas = live().filter(e => e.type === 'idea' && dayKey(new Date(e.created_at)) === k).length;
  const parts = [];
  if (ev.length) parts.push(`<span class="ic">${icon('calendar')}</span><b>${esc(tn('today.events', ev.length))}</b>`);
  if (openTd.length) parts.push(`<span class="ic">${icon('check')}</span><b>${esc(tn('today.tasks', openTd.length))}</b>`);
  if (ideas) parts.push(`<span class="ic">${icon('lightbulb')}</span><b>${esc(tn('today.ideas', ideas))}</b>`);
  let tail = '';
  const timed = ev.filter(e => e.meta.time);
  if (timed.length) {
    const ends = timed.map(e => e.meta.end_time || (() => { const [hh, mm] = e.meta.time.split(':').map(Number); return pad(Math.min(23, hh + 1)) + ':' + pad(mm); })()).sort();
    const last = ends[ends.length - 1]; const [lh] = last.split(':').map(Number);
    tail = lh <= h ? ' ' + t('today.freeNow') : ` ${esc(t('today.freeAfter'))} <b>${esc(fmtTime(last))}</b>${esc(t('today.freeAfterEnd'))}`;
  }
  const sentence = parts.length ? `${esc(t('today.youHave'))} ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' ' + esc(t('today.and')) + ' ' + parts[parts.length - 1] : parts[0]}${esc(t('today.youHaveEnd'))}${tail}` : esc(t('today.clear'));
  const total = live().length, places = live().filter(e => e.type === 'item').length;
  const weekDone = live().filter(e => e.type === 'todo' && e.meta.done && e.meta.done_at && new Date(e.meta.done_at) > addDays(now, -7)).length;

  // week strip
  if (!V.weekAnchor) V.weekAnchor = startOfWeek(now, S.prefs.weekStart);
  const days = [...Array(7)].map((_, i) => addDays(V.weekAnchor, i));
  const selD = parseDay(V.selDay);
  const ag = dayAgenda(V.selDay);
  const pinned = sortEntries(live().filter(e => e.pinned)).slice(0, 3);
  const favs = sortEntries(live().filter(e => e.favorite && !e.pinned), 'updated').slice(0, 4);
  const recent = sortEntries(live(), 'updated').slice(0, 6);
  const prompt = t('prompt.' + ((Math.floor(Date.now() / 864e5) + (V.promptShift || 0)) % PROMPTS));
  const capTypes = ['note', 'idea', 'todo', 'event', 'item', 'contact'];
  const tints = ['#ff7a34', '#c2412d', '#d9762b', '#a33a2a'];

  const isThisWeek = V.selDay === k && dayKey(V.weekAnchor) === dayKey(startOfWeek(now, S.prefs.weekStart));
  const agRowsT = ag.ev.map(e => `<div class="ag-row" data-act="open" data-id="${e.id}"><span class="ai" style="color:${e.meta.time ? 'var(--sheet-2)' : 'var(--dot)'}">${icon(e.meta.time ? 'calendar' : 'sparkle')}</span><span class="at">${esc(entryDisplayTitle(e))}</span>${e.meta.repeat ? `<span class="rp" title="${esc(repeatLabel(e.meta))}">${icon('repeat')}</span>` : ''}<span class="tm">${esc(e.meta.time ? fmtTime(e.meta.time) : t('cal.allDay'))}</span></div>`)
    .concat(ag.td.map(e => `<div class="ag-row ${e.meta.done ? 'done' : ''}" data-act="open" data-id="${e.id}"><span class="ai"><button class="ag-chk ${e.meta.done ? 'on' : ''}" data-act="toggleDone" data-id="${e.id}" aria-label="${esc(t('task.toggle'))}">${icon('check')}</button></span><span class="at">${esc(entryDisplayTitle(e))}</span><span class="tm">${esc(e.meta.due_time ? fmtTime(e.meta.due_time) : '')}</span></div>`));
  const wx = Weather.html();

  const capHTML = `      <section class="aurora capture" ${Aurora.attr()} aria-label="${esc(t('cap.label'))}">${Aurora.layers}
        <div class="kicker"><span class="cap-k">${esc(Prompts.kicker())}</span><button class="chip-t" data-act="promptNext" aria-label="${esc(t('cap.another'))}">${icon('refresh-cw')}</button></div>
        <div class="cap-main">
          <h2 class="cap-q" aria-live="polite">${esc(Prompts.current())}</h2>
          <button class="cap-fake" data-act="composer" data-t="${V.capType}"><span>${esc(t('cap.ph.' + V.capType))}</span><span class="send">${icon('arrow-up')}</span></button>
          <div class="cap-row">${capTypes.map(ty => `<button class="chip-t" data-act="composer" data-t="${ty}">${icon(typeOf(ty).icon)}<span>${esc(typeOf(ty).label)}</span></button>`).join('')}</div>
        </div>
      </section>`;
  const planHTML = `      <section class="tg tg-plan" aria-label="${esc(t('today.agenda'))}">
        <div class="tg-h"><h2>${icon('calendar-days')}<span>${esc(t('today.planH'))}</span></h2>
          <span class="tg-act">${isThisWeek ? '' : `<button class="pill-btn today-pill" data-act="weekToday">${icon('rotate-ccw')}<span>${esc(t('date.today'))}</span></button>`}<a class="pill-btn" href="#/calendar">${icon('calendar')}<span>${esc(t('today.openCal'))}</span>${icon('chevron-right')}</a></span></div>
        <div class="week" id="weekStrip"><button class="nav" data-act="wk" data-d="-7" aria-label="${esc(t('common.prev'))}">${icon('chevron-left')}</button>
          <div class="wk-track">${days.map(d => { const dk = dayKey(d); return `<button class="wd ${dk === V.selDay ? 'sel' : ''} ${dk === k ? 'is-today' : ''} ${d.getDay() === 0 ? 'sun' : ''}" data-act="pickDay" data-d="${dk}"><span class="w">${esc(fmtDate(d, { weekday: 'narrow' }))}</span><span class="n">${d.getDate()}</span>${dayDots(dk)}</button>`; }).join('')}</div>
          <button class="nav" data-act="wk" data-d="7" aria-label="${esc(t('common.next'))}">${icon('chevron-right')}</button></div>
        <div class="tg-in sheet">
          <div class="sh-head"><span class="sh-day"><b>${esc(V.selDay === k ? t('today.agendaToday') : fmtDate(selD, { weekday: 'long' }))}</b>${V.selDay === k ? '' : ` · ${esc(fmtDate(selD, { month: 'long', day: 'numeric' }))}`}</span>
            <span class="sh-add"><button class="btn sm" data-act="new" data-type="event" data-date="${V.selDay}">${icon('plus')}${esc(t('today.addEvent'))}</button><button class="btn sm" data-act="new" data-type="todo" data-date="${V.selDay}">${icon('plus')}${esc(t('today.addTask'))}</button></span></div>
          ${agRowsT.length ? agRowsT.join('') : `<div class="ag-empty"><span>${esc(t('today.agendaEmpty'))}</span></div>`}
        </div>
      </section>`;
  const notesHTML = total ? `<section class="tg tg-notes" aria-label="${esc(t('today.notesH'))}">
        <div class="tg-h"><h2>${icon('notebook-pen')}<span>${esc(t('today.notesH'))}</span></h2><a class="pill-btn" href="#/recent"><span>${esc(t('common.viewAll'))}</span>${icon('chevron-right')}</a></div>
        ${pinned.length || favs.length ? `<div class="tg-sub">${esc(t('today.keepH'))}</div>
        <div class="keep-grid">
          ${pinned.map(e => `<section class="st-card" data-act="open" data-id="${e.id}"><div class="lbl">${icon('pin')}${esc(t('today.pinnedLabel', { type: typeOf(e.type).label }))}</div>
            <button class="more" data-act="stMore" data-id="${e.id}" aria-label="${esc(t('common.more'))}">${icon('more-horizontal')}</button>
            <div class="st-body">${e.title ? `<b>${esc(e.title)}</b> ` : ''}${hydrateIcons(Object.assign(document.createElement('div'), { innerHTML: sanitizeHTML(e.content) })).innerHTML}</div></section>`).join('')}
          ${favs.map((e, i) => { const c = catOf(e.category_id); return `<article class="warm" style="--tint:${esc(c?.color || tints[i % 4])}" data-act="open" data-id="${e.id}">
            <div class="top"><span class="tic">${icon(typeOf(e.type).icon)}</span><span>${esc(typeOf(e.type).label)}</span></div>
            <button class="heart on" data-act="fav" data-id="${e.id}" aria-label="${esc(t('ed.favorite'))}">${icon('heart')}</button>
            <h3>${esc(entryDisplayTitle(e))}</h3><p>${esc(snippet(e, null, 140).replace(e.title ? '' : entryDisplayTitle(e), '').trim() || ' ')}</p></article>`; }).join('')}
        </div>` : ''}
        <div class="tg-sub">${esc(t('today.recent'))}</div>
        <div class="list">${recent.map(e => rowS(e)).join('')}</div>
        ${!pinned.length && !favs.length ? `<div class="tg-foot">${icon('info')}<span>${esc(t('today.tipPin'))}</span></div>` : ''}
      </section>` : '';
  if ((S.prefs.homeStyle || 'story') === 'story') return storyHome({ now, k, greet, name, ev, openTd, total, wx, capHTML, planHTML, notesHTML, pinned, days });
  return `<div class="wrap view-enter today-v">
    ${installBanner()}
    <header class="th">
      <div class="th-date">
        <h1 class="day-big">${esc(fmtDate(now, { weekday: 'long' }))}<i></i></h1>
        <div class="th-ymd"><span>${esc(fmtDate(now, { month: 'long', day: 'numeric' }))}</span><span>${esc(String(now.getFullYear()))}</span></div>
      </div>
      <div class="wx-slot" ${wx ? '' : 'hidden'}>${wx}</div>
      <p class="statement">${esc(greet)}${name ? `, ${avatarHTML('face')}<b>${esc(name)}</b>${esc(t('today.nameSuffix'))}.` : '.'} ${sentence}</p>
      <nav class="metrics" aria-label="${esc(t('today.summary'))}">
        <a href="#/recent" class="mt" style="--mc:var(--accent)">${icon('flame')}<span>${esc(tn('today.streak', streak()))}</span>${icon('chevron-right', 'go')}</a>
        <a href="#/all" class="mt" style="--mc:var(--text)">${icon('file-text')}<span>${esc(tn('today.records', total))}</span>${icon('chevron-right', 'go')}</a>
        <a href="#/tasks" data-act="tasksDone" class="mt" style="--mc:var(--ok)">${icon('check-check')}<span>${esc(tn('today.doneWeek', weekDone))}</span>${icon('chevron-right', 'go')}</a>
        <a href="#/items" class="mt" style="--mc:var(--c-blue)">${icon('map-pin')}<span>${esc(tn('today.places', places))}</span>${icon('chevron-right', 'go')}</a>
      </nav>
    </header>
    <div class="today-stack">
${capHTML}

${planHTML}

      ${notesHTML}
    </div></div>`;
}
/* ---------- Story home (감성형): the day told in sentences, groups folded ---------- */
const FOLD_KEY = 'kept.fold';
const foldOpen = id => !!(ls.get(FOLD_KEY, {})[id]);
function storyHome({ now, k, greet, name, ev, openTd, total, wx, capHTML, planHTML, notesHTML, pinned, days }) {
  const L = live(); const by = ty => sortEntries(L.filter(e => e.type === ty), 'updated');
  const noteTypes = new Set(['note', 'reference', 'personal', ...(S.prefs.customTypes || []).map(x => x.id)]);
  const short = e => { const s = entryDisplayTitle(e); return s.length > 26 ? s.slice(0, 25).trimEnd() + '…' : s; };
  const overdue = L.filter(e => e.type === 'todo' && !e.meta.done && e.meta.due && e.meta.due < k).length;
  const featured = sortEntries(L.filter(e => e.pinned), 'updated').slice(0, 5);
  const nameHTML = name ? `${avatarHTML('face')}<b>${esc(name)}</b>${esc(t('today.nameSuffix'))}` : '';
  if (!Gate.ready()) return storyWait({ now, capHTML });
  /* the reveal animation plays once (and on reshuffle); later re-renders swap the text in place */
  const play = !V.storyPlayed || V.storyPlay; V.storyPlayed = true; V.storyPlay = false;
  const story = storyHTML({
    greet, nameHTML, nameText: name ? name + t('today.nameSuffix') : '',
    events: ev, tasksOpen: openTd, overdue, featured, total, streak: streak(),
    ideas: by('idea'), items: by('item'), contacts: by('contact'), notes: sortEntries(L.filter(e => noteTypes.has(e.type)), 'updated'),
    titleOf: short, when: e => e.meta?.time ? fmtTime(e.meta.time) + (LANG === 'ko' ? ' ' : ', ') : ''
  }, V.storyShift || 0);
  const weekItems = days.reduce((n, d) => n + dayItems(dayKey(d)).length, 0);
  const fold = (id, ic, title, sum, body) => `<section class="fold ${foldOpen(id) ? 'open' : ''}" data-fold="${id}">
      <button class="fold-h" data-act="fold" data-id="${id}" aria-expanded="${foldOpen(id)}"><span class="fold-ic">${icon(ic)}</span><span class="fold-t">${esc(title)}</span><span class="fold-sum">${sum}</span>${icon('chevron-down', 'fold-chev')}</button>
      <div class="fold-b"><div class="fold-in">${body}</div></div></section>`;
  const planSum = [ev.length ? `${icon('calendar')}${esc(tn('today.events', ev.length))}` : '', openTd.length ? `${icon('check')}${esc(tn('today.tasks', openTd.length))}` : '', `<span class="muted">${esc(t('story.week', { n: weekItems }))}</span>`].filter(Boolean).join('<i class="dot"></i>');
  const notesSum = [pinned.length ? `${icon('pin')}${esc(t('story.onHome', { n: pinned.length }))}` : '', `${icon('file-text')}${esc(tn('today.records', total))}`].filter(Boolean).join('<i class="dot"></i>');
  return `<div class="wrap view-enter today-v story-v">
    ${installBanner()}
    <header class="th">
      <div class="th-date">
        <h1 class="day-big">${esc(fmtDate(now, { weekday: 'long' }))}<i></i></h1>
        <div class="th-ymd"><span>${esc(fmtDate(now, { month: 'long', day: 'numeric' }))}</span><span>${esc(String(now.getFullYear()))}</span></div>
      </div>
      <div class="wx-slot" ${wx ? '' : 'hidden'}>${wx}</div>
      <div class="story ${play ? 'play' : ''}" aria-live="polite">${story}</div>
    </header>
    <div class="today-stack">
${capHTML}
      ${fold('plan', 'calendar-days', t('today.planH'), planSum, planHTML.replace('<section class="tg tg-plan"', '<section class="tg tg-plan in-fold"'))}
      ${notesHTML ? fold('notes', 'notebook-pen', t('today.notesH'), notesSum, notesHTML.replace('<section class="tg tg-notes"', '<section class="tg tg-notes in-fold"')) : ''}
    </div></div>`;
}
/* while the day's data is still arriving: the date, a breathing shimmer where the story will be, and the capture box */
function storyWait({ now, capHTML }) {
  const bar = (w, i) => `<span class="sk" style="--w:${w}%;--i:${i}"></span>`;
  return `<div class="wrap today-v story-v">
    <header class="th">
      <div class="th-date">
        <h1 class="day-big">${esc(fmtDate(now, { weekday: 'long' }))}<i></i></h1>
        <div class="th-ymd"><span>${esc(fmtDate(now, { month: 'long', day: 'numeric' }))}</span><span>${esc(String(now.getFullYear()))}</span></div>
      </div>
      <div class="story story-wait" role="status" aria-label="${esc(t('story.loading'))}">
        <p class="sk-p">${[94, 81].map(bar).join('')}</p><p class="sk-p">${[88, 97, 46].map((w, i) => bar(w, i + 2)).join('')}</p><p class="sk-p">${[72].map((w, i) => bar(w, i + 5)).join('')}</p>
        <span class="sk-note"><span class="sk-dots"><i></i><i></i><i></i></span>${esc(t('story.loading'))}</span>
      </div>
    </header>
    <div class="today-stack">
${capHTML}
      <div class="sk-fold"></div><div class="sk-fold" style="--i:1"></div>
    </div></div>`;
}
function toggleFold(id) {
  const st = ls.get(FOLD_KEY, {}); st[id] = !st[id]; ls.set(FOLD_KEY, st);
  const sec = $(`.fold[data-fold="${id}"]`); if (!sec) return;
  sec.classList.toggle('open', st[id]); sec.querySelector('.fold-h')?.setAttribute('aria-expanded', String(st[id]));
}
async function captureToEntry(input, ty) {
  const raw = input.trim(); if (!raw) return null;
  const lines = raw.split('\n'); const first = lines[0].trim();
  const para = s => s.split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('');
  const rest = lines.length > 1 ? para(lines.slice(1).join('\n')) : '';
  let e;
  if (ty === 'todo') e = newEntry({ type: 'todo', title: first.slice(0, 300), content: rest, meta: { done: false, priority: 0, due: V.selDay !== todayKey() ? V.selDay : '' } });
  else if (ty === 'event') e = newEntry({ type: 'event', title: first.slice(0, 300), content: rest, meta: { date: V.selDay, time: '' } });
  else if (ty === 'item') { const m = first.match(/^(.+?)\s*(?:[:：=→]|->| - )\s*(.+)$/); e = newEntry({ type: 'item', title: (m ? m[1] : first).slice(0, 300), meta: { location: m ? m[2] : '' }, content: rest }); }
  else if (ty === 'contact') {
    const phone = raw.match(/\+?[\d][\d\s().-]{6,}\d/)?.[0] || ''; const email = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] || '';
    const name = first.replace(phone, '').replace(email, '').replace(/[,;]/g, ' ').trim() || first;
    e = newEntry({ type: 'contact', title: name.slice(0, 300), meta: { phone, email }, content: rest });
  } else e = newEntry({ type: ty, content: para(raw) });
  e.text = htmlToText(e.content);
  await saveEntry(e);
  return e;
}
async function quickCapture() {
  const ta = $('#capIn'); if (!ta || !ta.value.trim()) { ta?.focus(); return; }
  const box = ta.closest('.cap-box'); const send = box.querySelector('.send');
  box.classList.add('sent'); burst(send, 10); haptic(15);
  const ty = V.capType; const e = await captureToEntry(ta.value, ty);
  setTimeout(() => { ta.value = ''; ta.style.height = ''; box.classList.remove('sent'); }, 380);
  if (!e) return; UI.flash(e.id);
  toast(t('cap.saved', { type: typeOf(ty).label }), { action: t('common.open'), onAction: () => Editor.open(e.id) });
}

export { REPEATS, dayAgenda, dayDots, dayItems, isEventOn, occursOn, quickCapture, repeatLabel, toggleFold, viewToday };
