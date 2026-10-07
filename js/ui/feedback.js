/* Kept — Micro-interactions, toasts, dialogs, menus */
import { t } from '../lib/i18n.js';
import { $, $$, esc, icon } from '../lib/utils.js';

/* ---------- Micro-interactions ---------- */
function burst(el, n = 8, colors) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(); if (!r.width) return; const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cs = colors || ['var(--accent)', 'var(--dot)', '#ffd166', '#5ee29a', '#6fa8ff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); d.className = 'burst'; const a = (Math.PI * 2 * i) / n + Math.random() * .5; const dist = 16 + Math.random() * 18;
    d.style.cssText = `left:${cx}px;top:${cy}px;background:${cs[i % cs.length]};--dx:${(Math.cos(a) * dist).toFixed(1)}px;--dy:${(Math.sin(a) * dist).toFixed(1)}px`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }
}

/* ---------- Toasts / dialogs / menus ---------- */
function toast(msg, opts = {}) {
  const box = $('#toasts'); const n = document.createElement('div'); n.className = 'toast'; n.setAttribute('role', 'status');
  n.innerHTML = `<span class="tick ${opts.error ? 'e' : ''}">${icon(opts.error ? 'x' : 'check')}</span><span>${esc(msg)}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ''}`;
  if (opts.action) n.querySelector('button').onclick = () => { opts.onAction?.(); close(); };
  [...box.children].forEach(c => { if (c.querySelector('span:nth-child(2)')?.textContent === msg) c.remove(); });
  box.appendChild(n);
  const close = () => { n.classList.add('out'); setTimeout(() => n.remove(), 260); };
  setTimeout(close, opts.ms || (opts.action ? 5200 : 2400));
  while (box.children.length > 2) box.firstChild.remove();
}
let openLayer = null;
function closeLayers() { $$('.menu,.dialog,.scrim.layer,.cal-pop').forEach(n => n.remove()); $$('.popped').forEach(n => n.classList.remove('popped')); openLayer = null; }
function dialog({ title, body = '', html = '', actions = [], wide = false, onMount, dismiss = true }) {
  closeLayers();
  return new Promise(resolve => {
    const scrim = document.createElement('div'); scrim.className = 'scrim layer';
    const d = document.createElement('div'); d.className = 'dialog' + (wide ? ' wide' : ''); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${html}<div class="acts">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>`;
    document.body.append(scrim, d); requestAnimationFrame(() => scrim.classList.add('show'));
    const done = v => { scrim.remove(); d.remove(); openLayer = null; resolve(v); };
    if (dismiss) scrim.onclick = () => done(null);
    d.querySelectorAll('.acts button').forEach(b => b.onclick = async () => { const a = actions[+b.dataset.i]; if (a.run) { const r = await a.run(d); if (r === false) return; done(r === undefined ? a.value : r); } else done(a.value); });
    openLayer = { close: () => done(null) };
    onMount?.(d, done);
    setTimeout(() => (d.querySelector('input,textarea,select') || d.querySelector('.acts .primary,.acts .accent,.acts .danger') || d.querySelector('.acts button'))?.focus(), 30);
  });
}
const confirmDlg = (title, body, okLabel = t('common.confirm'), danger = false) =>
  dialog({ title, body, actions: [{ label: t('common.cancel'), value: false, cls: 'ghost' }, { label: okLabel, value: true, cls: danger ? 'danger solid' : 'primary' }] });
async function promptDlg(title, value = '', ph = '', body = '') {
  const r = await dialog({ title, body, html: `<input class="input" id="dlgIn" maxlength="120" value="${esc(value)}" placeholder="${esc(ph)}">`,
    actions: [{ label: t('common.cancel'), value: null, cls: 'ghost' }, { label: t('common.save'), cls: 'primary', run: d => d.querySelector('#dlgIn').value.trim() || false }],
    onMount: (d, done) => d.querySelector('#dlgIn').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) done(e.target.value.trim()); }) });
  return r;
}
function menu(anchor, items, opts = {}) {
  closeLayers();
  const m = document.createElement('div'); m.className = 'menu' + (opts.cls ? ' ' + opts.cls : ''); m.setAttribute('role', 'menu');
  const render = () => {
    m.innerHTML = (opts.html || '') + items.map((it, i) => it === '-' ? '<hr>' : it.header ? `<div class="mh">${esc(it.header)}</div>` :
      `<button class="mi ${it.danger ? 'danger' : ''}" role="menuitem" data-i="${i}">${it.icon ? icon(it.icon) : ''}${it.sw ? `<span class="sw" style="background:${esc(it.sw)}"></span>` : ''}<span>${esc(it.label)}</span>${it.checked ? `<span class="chkm">${icon('check')}</span>` : ''}</button>`).join('');
  };
  render();
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = opts.alignRight ? r.right - mw : r.left, y = r.bottom + 6;
  if (x + mw > innerWidth - 8) x = innerWidth - mw - 8; if (x < 8) x = 8;
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('.mi'); if (!b) return; const it = items[+b.dataset.i]; closeLayers(); it.run?.(); });
  const off = e => { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains?.(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
  openLayer = { close: () => m.remove() };
  opts.onMount?.(m);
  return m;
}
function download(name, data, type) {
  const blob = new Blob([data], { type }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export { burst, closeLayers, confirmDlg, dialog, download, menu, promptDlg, toast };
