/* Kept — Rotating writing questions */
import { Editor } from '../editor/editor.js';
import { t } from '../lib/i18n.js';
import { $ } from '../lib/utils.js';

/* ---------- Questions: rotate quietly while the card is visible ---------- */
const PROMPT_COUNT = 48;
const Prompts = {
  order: null, i: 0, timer: null,
  shuffle() { const a = [...Array(PROMPT_COUNT).keys()]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } this.order = a; this.i = 0; },
  current() { if (!this.order) this.shuffle(); return t('prompt.' + this.order[this.i % PROMPT_COUNT]); },
  kicker() { return t('cap.k' + (this.order ? this.order[this.i % PROMPT_COUNT] % 6 : 0)); },
  advance() { if (!this.order) this.shuffle(); this.i++; if (this.i >= PROMPT_COUNT) this.shuffle(); },
  start() {
    this.stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      const h = $('.capture .cap-q'); if (!h || document.hidden || Editor.e) return;
      if (h.closest('.capture')?.matches(':hover')) return;
      this.advance(); Prompts.swap();
    }, 9000);
  },
  swap() {
    const h = $('.capture .cap-q'), k = $('.capture .cap-k'); if (!h) return;
    h.classList.add('out'); k?.classList.add('out');
    setTimeout(() => { h.textContent = this.current(); if (k) k.textContent = this.kicker(); h.classList.remove('out'); k?.classList.remove('out'); }, 380);
  },
  stop() { clearInterval(this.timer); this.timer = null; }
};

export { Prompts };
