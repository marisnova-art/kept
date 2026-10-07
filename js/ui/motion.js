/* Kept — Small interaction animations used instead of toasts where a movement says enough. */
import { $ } from '../lib/utils.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/* restart a one-shot CSS animation class on an element */
function pop(el, cls = 'mo-pop') {
  if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}
/* a small chip flies from a point on screen into a target and the target answers with a pop */
function land(html, from, target) {
  if (!target) return;
  const tr = target.getBoundingClientRect(); if (!tr.width) return;
  if (reduced()) { pop(target, 'mo-land'); return; }
  const chip = document.createElement('div'); chip.className = 'mo-chip'; chip.innerHTML = html; document.body.appendChild(chip);
  const cr = chip.getBoundingClientRect();
  const x0 = (from?.x ?? innerWidth / 2) - cr.width / 2, y0 = (from?.y ?? innerHeight / 2) - cr.height / 2;
  const x1 = tr.left + tr.width / 2 - cr.width / 2, y1 = tr.top + tr.height / 2 - cr.height / 2;
  const a = chip.animate([
    { transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${x0}px,${y0 - 14}px) scale(1)`, opacity: 1, offset: .28 },
    { transform: `translate(${x0}px,${y0 - 14}px) scale(1)`, opacity: 1, offset: .5 },
    { transform: `translate(${x1}px,${y1}px) scale(.35)`, opacity: .2 }
  ], { duration: 900, easing: 'cubic-bezier(.5,0,.2,1)' });
  a.onfinish = () => { chip.remove(); pop(target, 'mo-land'); };
}
/* where a just-saved record "goes": its card if visible, otherwise the records entry in the dock or sidebar */
function saveTarget(id) {
  const card = document.querySelector(`#view [data-act="open"][data-id="${id}"]`);
  if (card) { const r = card.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) return card; }
  const dock = $('#dock a[data-r="all"]'); if (dock && dock.offsetParent) return dock;
  return $('#sidebar a[href="#/all"]');
}

export { land, pop, reduced, saveTarget };
