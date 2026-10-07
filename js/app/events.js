/* Kept — Global events and swipe gestures */
import { ACT, CHG } from './actions.js';
import { showShortcuts, toggleSidebar } from './menus.js';
import { S, applyPrefs, newEntry, onChange, restoreEntries, saveCategory, saveEntry, trashEntries } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { Editor, haptic, isTouch } from '../editor/editor.js';
import { Weather } from '../features/weather.js';
import { t } from '../lib/i18n.js';
import { $, debounce, esc, icon, nowISO } from '../lib/utils.js';
import { fmtDue } from '../ui/entries.js';
import { burst, closeLayers, toast } from '../ui/feedback.js';
import { V, route } from '../ui/router.js';
import { InstallPrompt, render, renderBell, renderView, rerender, syncLabel } from '../ui/shell.js';

/* ---------- Global events ---------- */
function bindGlobal() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.closest('#editor') && !['restoreOne'].includes(el.dataset.act)) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A' && el.dataset.act !== 'setJump') return fn(el, e);
    fn(el, e);
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest?.('[data-act="open"],[data-act="calDay"]'); if (el && (e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); el.click(); }
  });
  document.addEventListener('change', e => { const k = e.target.dataset?.chg; if (k && CHG[k]) CHG[k](e.target.value); });
  document.addEventListener('focusout', async e => {
    const id = e.target.dataset?.catName; if (!id) return; const c = S.categories.get(id); const v = e.target.value.trim().slice(0, 60);
    if (c && v && v !== c.name) { c.name = v; await saveCategory(c); toast(t('cat.renamed')); } else if (c && !v) e.target.value = c.name;
  });
  document.addEventListener('keydown', e => { if (e.target.dataset?.catName && e.key === 'Enter') e.target.blur(); });
  document.addEventListener('change', e => { if (e.target.id !== 'taskDue') return; const l = $('#taskDueLbl'), v = e.target.value; if (l) { l.textContent = v ? fmtDue(v) : t('f.due'); l.closest('.qa-date')?.classList.toggle('set', !!v); } });
  document.addEventListener('click', e => { const i = e.target.closest('.qa-date')?.querySelector('input'); if (i && e.target !== i) { e.preventDefault(); try { i.showPicker(); } catch { i.focus(); } } else if (i) { try { i.showPicker(); } catch {} } });
  document.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id === 'taskAdd') { const tt = $('#taskTitle').value.trim(); if (!tt) return $('#taskTitle').focus();
      const en = newEntry({ type: 'todo', title: tt.slice(0, 300), meta: { due: $('#taskDue').value, done: false, priority: +$('#taskPrio').value } }); await saveEntry(en); toast(t('task.added')); setTimeout(() => $('#taskTitle')?.focus(), 80); }
    if (e.target.id === 'itemAdd') { const n = $('#itemName').value.trim(), l = $('#itemLoc').value.trim(); if (!n) return $('#itemName').focus();
      const en = newEntry({ type: 'item', title: n.slice(0, 300), meta: { location: l.slice(0, 200) } }); await saveEntry(en); toast(t('items.added')); setTimeout(() => $('#itemName')?.focus(), 80); }
  });
  document.addEventListener('input', debounce(e => { if (e.target.id === 'itemQ') { V.itemQ = e.target.value; renderView(); } if (e.target.id === 'contactQ') { V.contactQ = e.target.value; renderView(); } if (e.target.id === 'faqQ') { V.faqQ = e.target.value; renderView(); } }, 120));
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if ($('.menu,.dialog,.cal-pop')) { closeLayers(); return; }
      if (Editor.e && Editor.panel) { Editor.closePanel(); Editor.updateToolState(); return; }
      if (Editor.e && Editor.drawerOpen) { Editor.toggleDrawer(false); return; }
      if (Editor.e) { Editor.close(); return; }
      if ($('#sidebar.open')) { toggleSidebar(false); return; }
      if (S.selecting) { ACT.selCancel(); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (Editor.e) Editor.close(); $('#q')?.focus(); $('#q')?.select(); return; }
    if (e.altKey && e.code === 'KeyN') { e.preventDefault(); ACT.new({ dataset: {} }); return; }
    if (typing || Editor.e || e.metaKey || e.ctrlKey || e.altKey || $('.dialog')) return;
    if (e.key === '/') { e.preventDefault(); $('#q')?.focus(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); ACT.new({ dataset: {} }); }
    else if (e.key === '?') { e.preventDefault(); showShortcuts(); }
  });
  bindSwipe(); bindKeyboardChrome(); bindPager();
  onChange(w => { if (w !== 'weather') return; const sl = $('.wx-slot'); if (sl) { sl.innerHTML = Weather.html(); sl.hidden = !sl.innerHTML; } });
  addEventListener('hashchange', () => { if (Editor.e) Editor.close(true); closeLayers(); render(); $('#view')?.focus({ preventScroll: true }); });
  addEventListener('online', () => { S.online = true; netbar(false); Sync.run(); });
  addEventListener('offline', () => { S.online = false; netbar(true); if (S.mode === 'cloud') Sync.set('offline'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sync.schedule(300); renderBell(); } else Editor.commit?.flush?.(); });
  addEventListener('pagehide', () => Editor.commit?.flush?.());
  addEventListener('beforeunload', e => { if (Editor.dirty) { Editor.commit.flush(); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyPrefs());
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); InstallPrompt.event = e; if (['settings', 'today'].includes(route().name)) renderView(); });
  addEventListener('appinstalled', () => { InstallPrompt.event = null; toast(t('set.installed')); renderView(); });
  setInterval(() => { if (!document.hidden) { Sync.schedule(0); renderBell(); } }, 60000);
  onChange(w => { if (w === 'entries' || w === 'categories' || w === 'prefs' || w === 'share' || w === 'billing') rerender(); if (w === 'sync') { const c = $('#syncChip'); if (c) { c.dataset.s = S.sync; c.lastElementChild.textContent = syncLabel(); } } });
}
/* ---------- swipe rows (phones): right = done / favourite, left = trash ---------- */
function bindSwipe() {
  let sw = null, lastSwipe = 0;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || S.selecting) return; const w = e.target.closest('.sw-wrap'); if (!w) return;
    sw = { w, el: w.lastElementChild, x0: e.clientX, y0: e.clientY, dx: 0, on: false };
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (!sw) return; const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
    if (!sw.on) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) { sw.on = true; sw.w.classList.add('swiping'); } else if (Math.abs(dy) > 10) { sw = null; return; } else return; }
    sw.dx = dx; const d = Math.sign(dx) * Math.min(Math.abs(dx), 160) + (Math.abs(dx) > 160 ? (dx - Math.sign(dx) * 160) * .25 : 0);
    sw.el.style.transform = `translateX(${d}px)`; sw.w.dataset.dir = dx > 0 ? 'l' : 'r';
    const armed = Math.abs(dx) > 90; if (armed !== sw.w.classList.contains('armed')) { sw.w.classList.toggle('armed', armed); if (armed) haptic(8); }
  }, { passive: true });
  const end = async () => {
    if (!sw) return; const { w, el, dx, on } = sw; sw = null; if (!on) return;
    lastSwipe = Date.now(); w.classList.remove('swiping', 'armed'); el.style.transition = 'transform .28s var(--ease)';
    const id = w.dataset.sw, kind = w.dataset.kind; const e = S.entries.get(id);
    if (Math.abs(dx) <= 90 || !e) { el.style.transform = ''; setTimeout(() => el.style.transition = '', 300); return; }
    if (dx < 0) {
      el.style.transform = 'translateX(-110%)'; w.style.height = w.offsetHeight + 'px'; requestAnimationFrame(() => { w.classList.add('collapse'); });
      setTimeout(async () => { await trashEntries([id]); toast(t('trash.moved'), { action: t('common.undo'), onAction: () => restoreEntries([id]) }); }, 280);
    } else if (kind === 'task') {
      el.style.transform = ''; e.meta.done = !e.meta.done; e.meta.done_at = e.meta.done ? nowISO() : null; el.classList.toggle('done', e.meta.done); el.querySelector('.chk')?.classList.toggle('on', e.meta.done);
      if (e.meta.done) burst(el.querySelector('.chk'), 10); haptic(15); await saveEntry(e, { silent: true }); setTimeout(rerender, 420);
    } else { el.style.transform = ''; e.favorite = !e.favorite; const h = el.querySelector('.heart'); h?.classList.toggle('on', e.favorite); if (e.favorite) burst(h, 8, ['var(--dot)', '#ff86c8']); haptic(10); await saveEntry(e, { silent: true }); setTimeout(rerender, 350); }
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', () => { if (sw) { sw.el.style.transform = ''; sw.w.classList.remove('swiping', 'armed'); sw = null; } });
  document.addEventListener('click', e => { if (Date.now() - lastSwipe < 400 && e.target.closest('.sw-wrap')) { e.stopPropagation(); e.preventDefault(); } }, true);
}
/* horizontal swipe to move weeks (Today) and months/weeks (Calendar) — touch and mouse */
function bindPager() {
  let p = null, lastPage = 0;
  document.addEventListener('pointerdown', e => {
    const host = e.target.closest('#weekStrip, #calGrid'); if (!host || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const track = host.id === 'weekStrip' ? host.querySelector('.wk-track') : host.firstElementChild?.classList.contains('cal-head') ? host.querySelector('.cal-grid') : host.firstElementChild;
    p = { host, track, x0: e.clientX, y0: e.clientY, dx: 0, on: false };
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (!p) return; const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
    if (!p.on) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) p.on = true; else if (Math.abs(dy) > 12) { p = null; return; } else return; }
    p.dx = dx; p.track.style.transition = 'none'; p.track.style.transform = `translateX(${dx * .55}px)`; p.track.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 500));
  }, { passive: true });
  const end = () => {
    if (!p) return; const { host, track, dx, on } = p; p = null; if (!on) return;
    lastPage = Date.now(); track.style.transition = 'transform .22s var(--ease), opacity .22s'; 
    if (Math.abs(dx) < 50) { track.style.transform = ''; track.style.opacity = ''; return; }
    const dir = dx < 0 ? 1 : -1; track.style.transform = `translateX(${-dir * 40}%)`; track.style.opacity = '0'; haptic(6);
    setTimeout(() => { if (host.id === 'weekStrip') ACT.wk({ dataset: { d: String(dir * 7) } }); else ACT.calNav({ dataset: { d: String(dir) } }); }, 140);
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', () => { if (p) { p.track.style.transform = ''; p.track.style.opacity = ''; p = null; } });
  document.addEventListener('click', e => { if (Date.now() - lastPage < 350 && e.target.closest('#weekStrip, #calGrid')) { e.stopPropagation(); e.preventDefault(); } }, true);
}
/* hide the floating dock while the keyboard is up, so it never sits on top of what you type */
function bindKeyboardChrome() {
  const editable = n => n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) && !['checkbox', 'radio', 'button', 'color', 'date', 'time'].includes(n.type);
  document.addEventListener('focusin', e => { if (isTouch() && editable(e.target)) document.documentElement.classList.add('typing-any'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!editable(document.activeElement)) document.documentElement.classList.remove('typing-any'); }, 60));
}
function netbar(show) { const n = $('#netbar'); n.innerHTML = `${icon('wifi-off')}<span>${esc(t('net.offline'))}</span>`; n.classList.toggle('show', show); }

export { bindGlobal, netbar };
