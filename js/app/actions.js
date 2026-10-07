/* Kept — Click actions and settings changes */
import { showAuth } from './auth-screen.js';
import { bellMenu, pickIconDialog, pwProblem, showShortcuts, toggleSidebar, typedConfirm, userMenu } from './menus.js';
import { migrateLocal } from './session.js';
import { cityLookup } from '../data/cities.js';
import { CAT_COLORS, S, applyPrefs, catOf, deleteCategory, emit, live, purgeEntries, restoreEntries, saveCategory, saveEntries, saveEntry, savePrefs, trashEntries, typeList, typeOf } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { Composer } from '../editor/composer.js';
import { Editor, haptic } from '../editor/editor.js';
import { Aurora } from '../features/aurora.js';
import { Billing } from '../features/billing.js';
import { pickAvatar } from '../features/avatar.js';
import { Data } from '../features/data-io.js';
import { installGuide } from '../features/install.js';
import { promoDialog } from '../features/promo.js';
import { Prompts } from '../features/prompts.js';
import { Reminders } from '../features/reminders.js';
import { runSearch } from '../features/search.js';
import { Weather } from '../features/weather.js';
import { LIMITS } from '../lib/config.js';
import { applyI18n, t, tn } from '../lib/i18n.js';
import { $, $$, addDays, esc, ls, nowISO, startOfWeek, todayKey, uid } from '../lib/utils.js';
import { burst, closeLayers, confirmDlg, dialog, menu, promptDlg, toast } from '../ui/feedback.js';
import { V, go, route } from '../ui/router.js';
import { InstallPrompt, UI, render, renderView, rerender, shell } from '../ui/shell.js';
import { Share } from '../features/share.js';
import { dayPop, popMode } from '../views/calendar.js';
import { acceptInvite, declineInvite, manageFolder, newFolder } from '../views/folders.js';
import { quickCapture, toggleFold } from '../views/today.js';

/* =====================================================================
   APP — actions, auth screens, boot
   ===================================================================== */
const ACT = {
  new: el => { const ty = el.dataset.type || (route().name === 'type' ? route().arg : route().name === 'tasks' ? 'todo' : route().name === 'items' ? 'item' : route().name === 'contacts' ? 'contact' : undefined);
    const preset = {}; if (ty) preset.type = ty;
    if (route().name === 'category' && catOf(route().arg)) preset.category_id = route().arg;
    if (route().name === 'tag') preset.tags = [route().arg];
    const fid = el.dataset.folder || (route().name === 'folder' ? route().arg : null); if (fid && Share.writable().some(f => f.id === fid)) preset.folder_id = fid;
    if (route().name === 'favorites') preset.favorite = true;
    const d = el.dataset.date; if (ty === 'event') preset.meta = { date: d || V.selDay || todayKey(), time: '' }; if (ty === 'todo') preset.meta = { due: d || '', done: false, priority: 0 };
    Editor.open(null, preset); },
  open: (el, ev) => {
    if (ev.target.closest('a[data-stop]')) return;
    if (S.selecting && el.closest('#entryList')) { const id = el.dataset.id; S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); renderView(); return; }
    Editor.open(el.dataset.id, route().name === 'search' && V.search.q ? { __q: V.search.q } : {});
  },
  fav: async (el, ev) => { ev.stopPropagation(); const e = S.entries.get(el.dataset.id); if (!e) return; e.favorite = !e.favorite; el.classList.toggle('on', e.favorite); if (e.favorite) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); burst(el, 8, ['var(--dot)', '#ff86c8', '#ff9a4d']); haptic(10); } await saveEntry(e, { silent: true }); setTimeout(rerender, 350); },
  toggleDone: async (el, ev) => { ev.stopPropagation(); const e = S.entries.get(el.dataset.id); if (!e) return; e.meta.done = !e.meta.done; e.meta.done_at = e.meta.done ? nowISO() : null; el.classList.toggle('on', e.meta.done);
    el.closest('.task,.ag-row,.ch')?.classList.toggle('done', e.meta.done); if (e.meta.done) { burst(el, 10); haptic(15); } await saveEntry(e, { silent: true });
    if (e.meta.done) toast(t('task.completedToast'), { action: t('common.undo'), onAction: async () => { e.meta.done = false; e.meta.done_at = null; await saveEntry(e); } });
    setTimeout(rerender, 420); },
  star: async (el, ev) => { ev.stopPropagation(); const e = S.entries.get(el.dataset.id); if (!e) return; e.meta.important = !e.meta.important; await saveEntry(e); },
  view: el => { savePrefs({ view: el.dataset.v }); renderView(); },
  more: () => { V.listLimit += 60; renderView(); },
  select: () => { S.selecting = !S.selecting; S.selected.clear(); renderView(); },
  selCancel: () => { S.selecting = false; S.selected.clear(); renderView(); },
  selAll: () => { $$('#entryList [data-act="open"]').forEach(n => S.selected.add(n.dataset.id)); const r = route(); /* include not-yet-rendered */ currentList().forEach(e => S.selected.add(e.id)); renderView(); },
  bulkCat: el => { const ids = [...S.selected]; const cats = [...S.categories.values()].sort((a, b) => a.name.localeCompare(b.name));
    const apply = async cid => { const l = ids.map(i => S.entries.get(i)).filter(Boolean); l.forEach(e => e.category_id = cid); await saveEntries(l); toast(tn('bulk.done', l.length)); S.selecting = false; S.selected.clear(); render(); };
    menu(el, [{ label: t('ed.noCategory'), icon: 'inbox', run: () => apply(null) }, '-', ...cats.map(c => ({ label: c.name, sw: c.color, run: () => apply(c.id) })), '-', { label: t('cat.new'), icon: 'plus', run: async () => { const c = await UI.createCategory(); if (c) apply(c.id); } }]); },
  bulkTag: async () => { const ids = [...S.selected]; const v = await promptDlg(t('bulk.tagTitle'), '', t('bulk.tagPh')); if (!v) return;
    const tags = v.split(',').map(s => s.trim().replace(/^#/, '').slice(0, LIMITS.tagLen)).filter(Boolean); const l = ids.map(i => S.entries.get(i)).filter(Boolean);
    l.forEach(e => tags.forEach(g => { if (!e.tags.includes(g) && e.tags.length < LIMITS.tagsPerEntry) e.tags.push(g); })); await saveEntries(l); toast(tn('bulk.done', l.length)); S.selecting = false; S.selected.clear(); render(); },
  bulkType: el => { const ids = [...S.selected]; menu(el, typeList().map(x => ({ label: x.label, icon: x.icon, run: async () => { const l = ids.map(i => S.entries.get(i)).filter(Boolean); l.forEach(e => e.type = x.id); await saveEntries(l); toast(tn('bulk.done', l.length)); S.selecting = false; S.selected.clear(); render(); } }))); },
  bulkFav: async () => { const l = [...S.selected].map(i => S.entries.get(i)).filter(Boolean); const v = !l.every(e => e.favorite); l.forEach(e => e.favorite = v); await saveEntries(l); toast(tn('bulk.done', l.length)); renderView(); },
  bulkTrash: async () => { const ids = [...S.selected]; await trashEntries(ids); S.selecting = false; S.selected.clear(); render(); toast(tn('bulk.trashed', ids.length), { action: t('common.undo'), onAction: () => restoreEntries(ids) }); },
  bulkRestore: async () => { const ids = [...S.selected]; await restoreEntries(ids); S.selecting = false; S.selected.clear(); render(); toast(t('trash.restored')); },
  bulkPurge: async () => { const ids = [...S.selected]; if (!await confirmDlg(t('trash.purgeTitle'), tn('trash.purgeBody', ids.length), t('trash.purge'), true)) return; await purgeEntries(ids); S.selecting = false; S.selected.clear(); render(); },
  restoreOne: async el => { await restoreEntries([el.dataset.id]); toast(t('trash.restored')); if (Editor.e?.id === el.dataset.id) Editor.open(el.dataset.id); },
  emptyTrash: async () => { const ids = [...S.entries.values()].filter(e => e.deleted_at).map(e => e.id); if (!ids.length) return; if (!await confirmDlg(t('trash.purgeTitle'), tn('trash.purgeBody', ids.length), t('trash.empty'), true)) return; await purgeEntries(ids); render(); toast(t('trash.emptied')); },
  wk: el => { const d = +el.dataset.d; V.weekAnchor = addDays(V.weekAnchor, d); V.slideIn = { sel: '#weekStrip .wk-track', dir: d > 0 ? 'r' : 'l' }; renderView(); },
  pickDay: el => { V.selDay = el.dataset.d; renderView(); },
  capType: el => { V.capType = el.dataset.t; const ta = $('#capIn'); const val = ta?.value; renderView(); const n = $('#capIn'); if (n) { n.value = val || ''; n.focus(); } },
  capSend: () => quickCapture(),
  promptNext: el => { const card = el.closest('.aurora'); Aurora.apply(card, Aurora.next()); Prompts.advance(); Prompts.swap(); haptic(5); el.classList.remove('spin'); void el.offsetWidth; el.classList.add('spin'); },
  wxLoad: () => { Weather.load(); },
  wxStyle: () => { V.wxStyle = V.wxStyle === 'icon' ? 'text' : 'icon'; const sl = $('.wx-slot'); if (sl) sl.innerHTML = Weather.html(); haptic(5); },
  setAurora: el => { Aurora.card = null; savePrefs({ aurora: el.dataset.v }); renderView(); },
  weekToday: () => { V.weekAnchor = startOfWeek(new Date(), S.prefs.weekStart); V.selDay = todayKey(); haptic(5); renderView(); },
  tasksDone: () => { V.taskFilter = 'done'; },
  stMore: (el, ev) => { ev.stopPropagation(); const e = S.entries.get(el.dataset.id); menu(el, [{ label: t('common.open'), icon: 'pencil', run: () => Editor.open(e.id) }, { label: t('ed.unpin'), icon: 'pin-off', run: async () => { e.pinned = false; await saveEntry(e); } }], { alignRight: true }); },
  taskFilter: el => { V.taskFilter = el.dataset.v; renderView(); },
  calMode: el => { V.cal.mode = el.dataset.v; if (V.cal.sel) { const [y, m, d] = V.cal.sel.split('-').map(Number); V.cal.anchor = new Date(y, m - 1, d); } renderView(); },
  calNav: el => { const d = +el.dataset.d; if (d) V.slideIn = { sel: '#calGrid', dir: d > 0 ? 'r' : 'l' }; const a = V.cal.anchor; if (!d) { V.cal.anchor = new Date(); V.cal.sel = todayKey(); } else if (V.cal.mode === 'month') V.cal.anchor = new Date(a.getFullYear(), a.getMonth() + d, 1); else V.cal.anchor = addDays(a, d * 7); renderView(); },
  calDay: el => { if (popMode()) { V.cal.sel = el.dataset.d; $$('.cal .cd.sel').forEach(n => n.classList.remove('sel')); el.classList.add('sel'); dayPop(el.dataset.d, el); return; } if (V.cal.sel === el.dataset.d && matchMedia('(hover:hover)').matches) { Editor.open(null, { type: 'event', meta: { date: el.dataset.d, time: '' } }); return; } V.cal.sel = el.dataset.d; renderView(); if (matchMedia('(max-width:1100px)').matches) $('.cal-wrap aside')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
  calMore: (el, ev) => { ev.stopPropagation(); const cd = el.closest('.cd'); V.cal.sel = el.dataset.d; $$('.cal .cd.sel').forEach(n => n.classList.remove('sel')); cd?.classList.add('sel'); dayPop(el.dataset.d, cd || el); },
  calPopClose: () => closeLayers(),
  folderNew: () => newFolder(),
  folderManage: el => manageFolder(el.dataset.id),
  folderAccept: el => acceptInvite(el.dataset.id, el.dataset.name),
  folderDecline: el => declineInvite(el.dataset.id),
  sScope: el => { V.search.scope = el.dataset.v; renderView(); },
  clearFilters: () => { Object.assign(V.search, { scope: 'all', type: '', cat: '', tag: '', from: '', to: '' }); renderView(); },
  catNew: async () => { const c = await UI.createCategory(); if (c && route().name !== 'categories') go('category/' + c.id); },
  catDel: async el => { const c = S.categories.get(el.dataset.id); const n = live().filter(e => e.category_id === c.id).length; if (!await confirmDlg(t('cat.delTitle', { name: c.name }), tn('cat.delBody', n), t('common.delete'), true)) return; await deleteCategory(c.id); toast(t('cat.deleted')); if (route().name === 'category') go('categories'); },
  catColor: el => { const c = S.categories.get(el.dataset.id); menu(el, [], { cls: 'picker', html: `<div class="swatches" style="padding:8px">${CAT_COLORS.map(x => `<button class="swatch ${c.color === x ? 'on' : ''}" style="--s:${x}" data-c="${x}"></button>`).join('')}</div>`, onMount: m => m.addEventListener('click', async e => { const b = e.target.closest('[data-c]'); if (b) { closeLayers(); c.color = b.dataset.c; await saveCategory(c); } }) }); },
  tagOpen: (el, ev) => { if (ev.target.closest('[data-act="tagMenu"]')) return; go('tag/' + encodeURIComponent(el.dataset.tag)); },
  tagMenu: (el, ev) => { ev.stopPropagation(); const g = el.dataset.tag;
    menu(el, [{ label: t('common.rename'), icon: 'pencil', run: async () => { const v = await promptDlg(t('tags.rename'), g); if (!v || v === g) return; const nv = v.replace(/^#/, '').slice(0, LIMITS.tagLen); const l = [...S.entries.values()].filter(e => e.tags.includes(g)); l.forEach(e => { e.tags = [...new Set(e.tags.map(x => x === g ? nv : x))]; }); await saveEntries(l); toast(tn('bulk.done', l.length)); } },
      { label: t('common.delete'), icon: 'trash-2', danger: true, run: async () => { const l = [...S.entries.values()].filter(e => e.tags.includes(g)); if (!await confirmDlg(t('tags.delTitle', { tag: g }), tn('tags.delBody', l.length), t('common.delete'), true)) return; l.forEach(e => e.tags = e.tags.filter(x => x !== g)); await saveEntries(l); } }], { alignRight: true }); },
  typeNew: async () => { const v = await promptDlg(t('set.newType'), '', t('set.typePh')); if (!v) return; const ic = await pickIconDialog(); const id = 'c_' + uid().slice(0, 8); savePrefs({ customTypes: [...(S.prefs.customTypes || []), { id, label: v.slice(0, 40), icon: ic || 'file-text' }] }); render(); },
  typeRename: async el => { const ty = typeOf(el.dataset.id); const v = await promptDlg(t('common.rename'), ty.label); if (!v) return;
    if (ty.builtin) savePrefs({ typeLabels: { ...S.prefs.typeLabels, [ty.id]: v.slice(0, 40) } }); else savePrefs({ customTypes: S.prefs.customTypes.map(x => x.id === ty.id ? { ...x, label: v.slice(0, 40) } : x) }); render(); },
  typeReset: el => { const tl = { ...S.prefs.typeLabels }; delete tl[el.dataset.id]; savePrefs({ typeLabels: tl }); render(); },
  typeDel: async el => { const ty = typeOf(el.dataset.id); const l = [...S.entries.values()].filter(e => e.type === ty.id);
    if (!await confirmDlg(t('set.delType', { name: ty.label }), tn('set.delTypeBody', l.length), t('common.delete'), true)) return;
    l.forEach(e => e.type = 'note'); if (l.length) await saveEntries(l); savePrefs({ customTypes: S.prefs.customTypes.filter(x => x.id !== ty.id), defaultType: S.prefs.defaultType === ty.id ? 'note' : S.prefs.defaultType }); render(); },
  setLang: el => { savePrefs({ lang: el.dataset.v }); shell(); applyI18n(); Editor.init(); render(); },
  setTheme: el => { savePrefs({ theme: el.dataset.v }); renderView(); },
  setHome: el => { savePrefs({ homeStyle: el.dataset.v }); renderView(); },
  fold: el => { toggleFold(el.dataset.id); haptic(5); },
  storyShuffle: el => { V.storyShift = (V.storyShift || 0) + 1; const st = document.querySelector('.story'); if (st) { st.classList.add('out'); setTimeout(renderView, 180); } else renderView(); haptic(5); el.classList.remove('spin'); void el.offsetWidth; el.classList.add('spin'); },
  setFs: el => { savePrefs({ textSize: el.dataset.v }); applyPrefs(); renderView(); },
  setAccent: el => { savePrefs({ accent: el.dataset.v }); renderView(); },
  setJump: (el, ev) => { ev.preventDefault(); $('#set-' + el.dataset.id)?.scrollIntoView({ behavior: 'smooth' }); },
  notifyReq: async () => { const p = await Reminders.request(); toast(t('notif.perm.' + p)); renderView(); },
  notifyToggle: () => { savePrefs({ notify: !S.prefs.notify }); Reminders.reschedule(); renderView(); },
  notifyTest: () => Reminders.fire({ id: 'test', title: t('notif.testTitle'), text: '', type: 'note' }, Date.now()),
  exportJson: () => Data.json(), exportCsv: () => Data.csv(), importJson: () => Data.pick(),
  deleteAll: async () => {
    const ok = await typedConfirm(t('set.deleteAll'), t('set.deleteAllConfirm'), t('set.typeDelete')); if (!ok) return;
    if (S.mode === 'cloud') { const sb = Sync.sb; const r1 = await sb.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000'); const r2 = await sb.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (r1.error || r2.error) { toast(t('err.server', { m: (r1.error || r2.error).message }), { error: true }); return; } }
    await S.db.delMany('entries', [...S.entries.keys()]); await S.db.delMany('categories', [...S.categories.keys()]); await S.db.set('pendingDeletes', []);
    S.entries.clear(); S.categories.clear(); render(); toast(t('set.deletedAll'));
  },
  deleteAccount: async () => {
    const ok = await typedConfirm(t('set.deleteAcc'), t('set.deleteAccConfirm'), t('set.typeDelete')); if (!ok) return;
    const { error } = await Sync.sb.rpc('delete_my_account');
    if (error) { toast(t('err.server', { m: error.message }), { error: true }); return; }
    await S.db.destroy(); await Sync.sb.auth.signOut().catch(() => {}); ls.del('kept.mode'); ls.del('kept.lastUser'); toast(t('set.accDeleted')); setTimeout(() => location.replace(location.pathname), 900);
  },
  changePw: async () => {
    const pw = await dialog({ title: t('set.changePw'), html: `<div class="field"><label>${esc(t('auth.newPw'))}</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8"></div><div class="field"><label>${esc(t('auth.confirmPw'))}</label><input class="input" id="pw2" type="password" autocomplete="new-password"></div><div class="note" id="pwErr" hidden></div>`,
      actions: [{ label: t('common.cancel'), cls: 'ghost', value: null }, { label: t('common.save'), cls: 'primary', run: d => { const a = d.querySelector('#pw1').value, b = d.querySelector('#pw2').value; const er = d.querySelector('#pwErr'); const m = pwProblem(a, b); if (m) { er.hidden = false; er.className = 'note err'; er.textContent = m; return false; } return a; } }] });
    if (!pw) return; const { error } = await Sync.sb.auth.updateUser({ password: pw }); toast(error ? t('err.server', { m: error.message }) : t('auth.pwChanged'), { error: !!error });
  },
  signOut: async () => {
    const dirty = [...S.entries.values()].filter(e => e._dirty).length;
    if (dirty && !await confirmDlg(t('auth.signOutDirty'), tn('auth.signOutDirtyBody', dirty), t('set.signOut'), true)) return;
    if (!dirty && !await confirmDlg(t('set.signOut'), t('auth.signOutBody'), t('set.signOut'))) return;
    await Sync.sb?.auth.signOut().catch(() => {}); await S.db.destroy(); ls.del('kept.mode'); ls.del('kept.lastUser'); location.replace(location.pathname);
  },
  signIn: () => { ls.del('kept.mode'); showAuth('signin', true); },
  syncNow: () => { Sync.run(); toast(t('sync.syncing')); },
  syncChip: () => { if (S.mode === 'cloud') Sync.run(); else go('settings#connection'); },
  connSave: async () => { const url = $('#connUrl').value.trim().replace(/\/+$/, ''), key = $('#connKey').value.trim();
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(url) || key.length < 20) { toast(t('conn.invalid'), { error: true }); return; }
    ls.set('kept.conn', { url, key }); toast(t('conn.saved')); setTimeout(() => location.reload(), 600); },
  connClear: async () => { if (!await confirmDlg(t('conn.clear'), t('conn.clearBody'))) return; ls.del('kept.conn'); location.reload(); },
  install: async () => { if (!InstallPrompt.event) return; InstallPrompt.event.prompt(); await InstallPrompt.event.userChoice; InstallPrompt.event = null; renderView(); },
  shortcuts: () => showShortcuts(),
  planGo: el => Billing.checkout(el.dataset.v),
  promo: () => promoDialog(),
  sidebar: () => toggleSidebar(),
  bell: el => bellMenu(el),
  user: el => userMenu(el),
  migrateLocal: () => migrateLocal(),
  composer: el => { V.capType = el.dataset.t || V.capType; Composer.open(V.capType); },
  searchOpen: () => { $('#topbar').classList.add('searching'); const q = $('#q'); q.focus(); },
  searchClose: () => { const q = $('#q'); q.value = ''; V.search.q = ''; $('#topbar').classList.remove('searching'); q.blur(); if (route().name === 'search') history.back(); },
  installGuide: () => installGuide(),
  avatarPick: () => pickAvatar(),
  avatarDel: () => { savePrefs({ avatar: null }); shell(); applyI18n(); render(); },
  filtToggle: () => { V.filtOpen = !V.filtOpen; renderView(); },
  instHintOff: el => { ls.set('kept.instHint', 'off'); const b = el.closest('.inst-banner'); b.classList.add('out'); setTimeout(() => b.remove(), 300); }
};
function currentList() {
  const r = route(); if (r.name === 'search') return runSearch(V.search); if (r.name === 'trash') return [...S.entries.values()].filter(e => e.deleted_at);
  const L = live(); return { all: L, recent: L.filter(e => new Date(e.updated_at) > Date.now() - 14 * 864e5), favorites: L.filter(e => e.favorite), type: L.filter(e => e.type === r.arg), category: L.filter(e => e.category_id === r.arg), uncategorized: L.filter(e => !e.category_id), tag: L.filter(e => e.tags.includes(r.arg)) }[r.name] || [];
}
const CHG = {
  sort: v => { savePrefs({ sort: v }); renderView(); }, defaultType: v => savePrefs({ defaultType: v }), spacing: v => savePrefs({ spacing: v }), weekStart: v => { savePrefs({ weekStart: +v }); V.weekAnchor = null; },
  accent: v => { savePrefs({ accent: v }); }, displayName: v => { savePrefs({ displayName: v.trim().slice(0, 40) }); },
  wxCountry: v => { V.wxCountry = v; if (!v) { savePrefs({ wxCity: null }); Weather.data = null; ls.del('kept.weather'); emit('weather'); } renderView(); },
  wxCity: v => { V.wxCountry = undefined; savePrefs({ wxCity: v || null }); if (v) { Weather.load(); toast(t('wx.set', { city: cityLookup(v).name })); } renderView(); },
  sType: v => { V.search.type = v; renderView(); }, sCat: v => { V.search.cat = v; renderView(); }, sTag: v => { V.search.tag = v; renderView(); }, sFrom: v => { V.search.from = v; renderView(); }, sTo: v => { V.search.to = v; renderView(); }
};

export { ACT, CHG };
