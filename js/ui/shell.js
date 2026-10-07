/* Kept — App shell, sidebar, dock, render loop */
import { CAT_COLORS, S, live, saveCategory, typeOf } from '../data/store.js';
import { Editor } from '../editor/editor.js';
import { watchAuroras } from '../features/aurora.js';
import { avatarHTML } from '../features/avatar.js';
import { Prompts } from '../features/prompts.js';
import { Billing } from '../features/billing.js';
import { Share } from '../features/share.js';
import { LIMITS } from '../lib/config.js';
import { fmtNum, t, tn } from '../lib/i18n.js';
import { $, $$, debounce, esc, icon, nowISO, pad, todayKey, uid } from '../lib/utils.js';
import { promptDlg, toast } from './feedback.js';
import { V, go, route } from './router.js';
import { fitMonth, viewCalendar } from '../views/calendar.js';
import { viewFolder, viewFolders } from '../views/folders.js';
import { viewContacts, viewItems } from '../views/items.js';
import { viewList, viewSearch } from '../views/lists.js';
import { allTags, viewCategories, viewTags, viewTrash } from '../views/organize.js';
import { viewAbout, viewFaq, viewLegal, viewSupport } from '../views/pages.js';
import { viewSettings } from '../views/settings.js';
import { viewTasks } from '../views/tasks.js';
import { isEventOn, quickCapture, viewToday } from '../views/today.js';

/* ---------- Shell ---------- */
const InstallPrompt = { event: null };
/* shared folders: shown once signed in; invites waiting show as a count on the label */
function shareGroup(isA, cnt) {
  if (S.mode !== 'cloud') return '';
  const inv = Share.invites.length;
  return `<div class="sb-group"><div class="sb-label"><a href="#/folders" style="text-decoration:none;color:inherit">${esc(t('nav.shared'))}${inv ? ` <span class="sb-new">${esc(tn('share.invitesN', inv))}</span>` : ''}</a>${Share.available() ? `<button data-act="folderNew" aria-label="${esc(t('share.new'))}">${icon('plus')}</button>` : ''}</div>
    ${Share.folders.map(f => `<a class="nav-item ${isA('folder', f.id)}" href="#/folder/${f.id}"><span class="sb-fi" style="${f.color ? `color:${esc(f.color)}` : ''}">${icon('users')}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span><span class="cnt">${cnt(e => e.folder_id === f.id)}</span></a>`).join('')}
    ${Share.folders.length ? '' : `<a class="nav-item ${isA('folders')}" href="#/folders">${icon('users')}<span>${esc(t('share.sbEmpty'))}</span></a>`}</div>`;
}
function sidebarHTML() {
  const r = route(); const isA = (n, a) => r.name === n && (a == null || r.arg === a) ? 'active' : '';
  const L = live(); const cnt = f => fmtNum(L.filter(f).length);
  const cats = [...S.categories.values()].sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
  const tags = allTags().slice(0, 8);
  const a = (href, ic, label, active, c = '') => `<a class="nav-item ${active}" href="#/${href}">${icon(ic)}<span>${esc(label)}</span>${c !== '' ? `<span class="cnt">${c}</span>` : ''}</a>`;
  const custom = (S.prefs.customTypes || []);
  return `<div class="sb-head"><a href="#/today" class="wordmark" style="text-decoration:none">kept<i></i></a></div>
  <nav class="sb-nav scroll" aria-label="${esc(t('nav.main'))}">
    ${a('today', 'home', t('nav.home'), isA('today'))}
    ${a('all', 'inbox', t('nav.all'), isA('all'), cnt(() => true))}
    ${a('recent', 'clock', t('nav.recent'), isA('recent'))}
    ${a('favorites', 'heart', t('nav.favorites'), isA('favorites'), cnt(e => e.favorite))}
    <div class="sb-group"><div class="sb-label">${esc(t('nav.collections'))}</div>
    ${a('tasks', 'check-square', t('nav.tasks'), isA('tasks'), cnt(e => e.type === 'todo' && !e.meta.done))}
    ${a('calendar', 'calendar', t('nav.calendar'), isA('calendar'))}
    ${a('type/idea', 'lightbulb', typeOf('idea').label, isA('type', 'idea'), cnt(e => e.type === 'idea'))}
    ${a('items', 'map-pin', t('nav.items'), isA('items'), cnt(e => e.type === 'item'))}
    ${a('contacts', 'contact', t('nav.contacts'), isA('contacts'), cnt(e => e.type === 'contact'))}
    ${['note', 'reference', 'personal'].map(id => a('type/' + id, typeOf(id).icon, typeOf(id).label, isA('type', id), cnt(e => e.type === id))).join('')}
    ${custom.map(x => a('type/' + x.id, x.icon, x.label, isA('type', x.id), cnt(e => e.type === x.id))).join('')}</div>
    <div class="sb-group"><div class="sb-label"><a href="#/categories" style="text-decoration:none;color:inherit">${esc(t('nav.categories'))}</a><button data-act="catNew" aria-label="${esc(t('cat.new'))}">${icon('plus')}</button></div>
      ${cats.map(c => `<a class="nav-item ${isA('category', c.id)}" href="#/category/${c.id}"><span class="sw" style="background:${esc(c.color)}"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><span class="cnt">${cnt(e => e.category_id === c.id)}</span></a>`).join('')}
      ${a('uncategorized', 'folder', t('nav.uncategorized'), isA('uncategorized'), cnt(e => !e.category_id))}</div>
    ${shareGroup(isA, cnt)}
    <div class="sb-group"><div class="sb-label"><a href="#/tags" style="text-decoration:none;color:inherit">${esc(t('nav.tags'))}</a></div>
      ${tags.map(([g, n]) => `<a class="nav-item ${isA('tag', g)}" href="#/tag/${encodeURIComponent(g)}">${icon('hash')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g)}</span><span class="cnt">${fmtNum(n)}</span></a>`).join('')}
      ${a('tags', 'tag', t('tags.all'), isA('tags'))}</div>
    <div class="sb-group">${a('trash', 'trash-2', t('nav.trash'), isA('trash'), fmtNum([...S.entries.values()].filter(e => e.deleted_at).length))}
    ${a('settings', 'settings', t('nav.settings'), isA('settings'))}
    ${a('support', Billing.isSubscriber() ? 'gem' : 'hand-heart', t('nav.support'), isA('support'))}</div>
  </nav>
  <div class="sb-foot"><button class="sync-chip" data-s="${S.sync}" data-act="syncChip" id="syncChip"><span class="led"></span><span>${esc(syncLabel())}</span></button></div>`;
}
function syncLabel() { return { local: S.volatile ? t('sync.memory') : t('sync.local'), synced: t('sync.synced'), syncing: t('sync.syncing'), offline: t('sync.offline'), error: t('sync.error') }[S.sync] || ''; }
function shell() {
  $('#app').innerHTML = `<aside id="sidebar"></aside>
  <div id="main">
    <header id="topbar">
      <button class="icon-btn" data-act="sidebar" id="menuBtn" aria-label="${esc(t('nav.menu'))}" style="display:none">${icon('menu')}</button>
      <a href="#/today" class="tb-logo wordmark" style="text-decoration:none">kept<i></i></a>
      <div class="search" role="search">${icon('search')}<input id="q" type="search" autocomplete="off" placeholder="${esc(t('search.ph'))}" aria-label="${esc(t('search.ph'))}"><kbd>⌘K</kbd></div>
      <button class="btn ghost sm search-cancel" data-act="searchClose">${esc(t('common.cancel'))}</button>
      <span class="tb-spacer"></span>
      <button class="icon-btn search-open" data-act="searchOpen" aria-label="${esc(t('common.search'))}">${icon('search')}</button>
      <button class="btn primary new-btn" data-act="new">${icon('plus')}<span>${esc(t('common.new'))}</span></button>
      <button class="icon-btn" data-act="bell" id="bellBtn" aria-label="${esc(t('notif.title'))}">${icon('bell')}<span class="badge" id="bellBadge" hidden></span></button>
      <button class="icon-btn avatar-btn" data-act="user" aria-label="${esc(t('nav.account'))}">${avatarHTML()}</button>
    </header>
    <main id="view" tabindex="-1"></main>
  </div>`;
  $('#dock').innerHTML = `<button class="dock-tg" data-act="dockToggle" aria-expanded="false" aria-controls="dockNav" aria-label="${esc(t('dock.menu'))}"><span class="dt-ic">${icon('home')}</span>${icon('x', 'dt-x')}</button>
    <nav class="dock-seg" id="dockNav" aria-label="${esc(t('nav.main'))}">
    <a href="#/today" data-r="today" aria-label="${esc(t('nav.home'))}">${icon('home')}<span>${esc(t('nav.home'))}</span></a><a href="#/all" data-r="all" aria-label="${esc(t('nav.all'))}">${icon('inbox')}<span>${esc(t('dock.all'))}</span></a>
    <a href="#/tasks" data-r="tasks" aria-label="${esc(t('nav.tasks'))}">${icon('check-square')}<span>${esc(t('nav.tasks'))}</span></a><a href="#/calendar" data-r="calendar" aria-label="${esc(t('nav.calendar'))}">${icon('calendar')}<span>${esc(t('nav.calendar'))}</span></a></nav>
    <button class="dock-new" data-act="new" aria-label="${esc(t('common.newRecord'))}">${icon('plus')}</button>`;
  dockOpen(false);
  const mq = matchMedia('(max-width:900px)'); const fixMenu = () => $('#menuBtn').style.display = mq.matches ? '' : 'none'; mq.addEventListener('change', fixMenu); fixMenu();
  const q = $('#q');
  q.addEventListener('input', debounce(() => { V.search.q = q.value; V.listLimit = 60; if (route().name !== 'search') { if (q.value.trim()) go('search'); } else renderView(); }, 90));
  q.addEventListener('keydown', e => { if (e.key === 'Escape') { q.value = ''; V.search.q = ''; q.blur(); if (route().name === 'search') history.back(); } if (e.key === 'Enter') { const f = $('#view [data-act="open"]'); if (f && q.value.trim()) Editor.open(f.dataset.id, { __q: q.value }); } });
}
function renderSidebar() { const sb = $('#sidebar'); if (!sb) return; const st = sb.querySelector('.sb-nav')?.scrollTop || 0; sb.innerHTML = sidebarHTML(); sb.querySelector('.sb-nav').scrollTop = st; }
function renderBell() {
  const k = todayKey(); const L = live();
  const n = L.filter(e => e.type === 'todo' && !e.meta.done && e.meta.due && e.meta.due <= k).length + L.filter(e => isEventOn(e, k) && (!e.meta.time || e.meta.time >= `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`)).length;
  const b = $('#bellBadge'); if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  // the same count on the installed app's icon (Badging API: installed PWAs on desktop, Android, iOS 16.4+)
  try { if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch {}
}
const VIEWS = { today: viewToday, all: () => viewList('all'), recent: () => viewList('recent'), favorites: () => viewList('favorites'), type: a => viewList('type', a), category: a => viewList('category', a),
  uncategorized: () => viewList('uncategorized'), tag: a => viewList('tag', a), search: viewSearch, tasks: viewTasks, calendar: viewCalendar, items: viewItems, contacts: viewContacts,
  categories: viewCategories, folders: viewFolders, folder: viewFolder, tags: viewTags, trash: viewTrash, settings: viewSettings, support: viewSupport, privacy: () => viewLegal('privacy'), terms: () => viewLegal('terms'), about: viewAbout, faq: viewFaq };
let lastRoute = '';
const DOCK_IC = { today: 'home', all: 'inbox', tasks: 'check-square', calendar: 'calendar' };
/* phones: the tab bar stays folded behind one button (showing where you are); the write button is always out */
function dockOpen(open = !$('#dock')?.classList.contains('open')) {
  const d = $('#dock'); if (!d) return; d.classList.toggle('open', open);
  d.querySelector('.dock-tg')?.setAttribute('aria-expanded', String(open)); d.querySelector('.dock-seg').inert = !open;
}
function renderView(keepScroll = true) {
  const r = route(); const fn = VIEWS[r.name] || viewToday; const v = $('#view'); if (!v) return;
  const key = r.name + '/' + r.arg; const same = key === lastRoute; const st = v.scrollTop;
  const focusId = document.activeElement?.id; const caret = document.activeElement?.selectionStart;
  v.innerHTML = fn(r.arg);
  if (same && keepScroll) { v.scrollTop = st; $$('.view-enter', v).forEach(n => n.classList.remove('view-enter')); }
  else { v.scrollTop = 0; S.selecting = false; S.selected.clear(); V.listLimit = 60; if (r.name !== 'search') { V.search.q = ''; const q = $('#q'); if (q) q.value = ''; } }
  lastRoute = key;
  if (focusId && same) { const f = document.getElementById(focusId); if (f && f !== document.body) { f.focus(); try { if (caret != null) f.setSelectionRange(caret, caret); } catch {} } }
  $$('#dock a').forEach(a => a.classList.toggle('on', a.dataset.r === r.name));
  const dti = $('#dock .dt-ic'); if (dti) dti.innerHTML = icon(DOCK_IC[r.name] || 'layout-grid');
  if (!same) $$('#view .card, #view .sw-wrap, #view .task, #view .item-card, #view .contact-row, #view .warm, #view .st-card').slice(0, 30).forEach((n, i) => { n.classList.add('rise'); n.style.setProperty('--i', i); });
  if (V.flash && Date.now() - V.flash.at < 4000) $$(`#view [data-act="open"][data-id="${V.flash.id}"]`).forEach(n => { n.classList.remove('just-saved'); void n.offsetWidth; n.classList.add('just-saved'); });
  const ld = $('#loadMore'); if (ld && 'IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); V.listLimit += 60; renderView(); } }, { root: v, rootMargin: '400px' }); io.observe(ld); }
  if (r.name === 'support' && !same) Billing.refresh().catch(() => {});
  watchAuroras(v); if (r.name === 'today') Prompts.start(); else Prompts.stop();
  if (r.name === 'calendar') fitMonth(); else $('.cal-pop')?.remove();
  if (V.slideIn) { const tr = $(V.slideIn.sel); if (tr) { tr.classList.add('slide-in-' + V.slideIn.dir); } V.slideIn = null; }
  if (r.name === 'settings' && location.hash.includes('#', 2)) { const id = location.hash.split('#')[2]; setTimeout(() => $('#set-' + id)?.scrollIntoView({ behavior: 'smooth' }), 50); }
  const ct = $('#capIn'); if (ct) { ct.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); quickCapture(); } }); ct.addEventListener('input', () => { ct.style.height = 'auto'; ct.style.height = Math.min(200, ct.scrollHeight) + 'px'; }); }
}
function render() { renderSidebar(); renderView(); renderBell(); $('#sidebar')?.classList.remove('open'); $('.scrim.sb')?.remove(); }
const rerender = debounce(() => { renderSidebar(); if (!document.activeElement?.closest?.('.quick-add, #capIn, .cat-row')) renderView(); renderBell(); }, 60);

/* ---------- Category helpers ---------- */
const UI = {
  flash(id) { V.flash = { id, at: Date.now() }; },
  async createCategory() {
    if (S.categories.size >= LIMITS.categories) { toast(t('err.catLimit'), { error: true }); return null; }
    const name = await promptDlg(t('cat.new'), '', t('cat.namePh')); if (!name) return null;
    const c = { id: uid(), name: name.slice(0, 60), color: CAT_COLORS[S.categories.size % CAT_COLORS.length], sort: S.categories.size, created_at: nowISO(), updated_at: nowISO(), _sv: null, _dirty: true };
    await saveCategory(c); toast(t('cat.created')); return c;
  }
};

export { InstallPrompt, UI, dockOpen, render, renderBell, renderView, rerender, shell, syncLabel };
