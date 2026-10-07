/* Kept — Aurora gradient palettes */
import { S } from '../data/store.js';
import { ls } from '../lib/utils.js';

/* =====================================================================
   EXTRAS — weather (Open-Meteo, no key, cached), aurora palettes,
   rotating prompts. Everything here is client-side; the only network
   call is one tiny weather request per hour, and only after the user
   allows location.
   ===================================================================== */

/* ---------- Aurora: still, layered colour light (no motion — writing needs calm).
   Curated palettes [hot, warm, mid, deep, base]; every new look gets a different palette AND a clearly different direction. ---------- */
const PALS = {
  ember: ['#ff4b1f', '#f2a05a', '#1d4a4b', '#13292c', '#1a1c21'], saffron: ['#ff8a2a', '#ffc76a', '#22385a', '#152238', '#111520'],
  roseink: ['#ff5f7e', '#f6b99a', '#3a2a55', '#1e1934', '#141419'], cobalt: ['#2f6bff', '#8fd3ff', '#1b2d63', '#111a3b', '#0e1119'],
  jade: ['#2fbf8f', '#d8f08a', '#1d4a44', '#122c2a', '#111716'], aubergine: ['#ff9a6b', '#ff5f8f', '#4a2347', '#28142c', '#141017'],
  coral: ['#ff6f5b', '#ffcfa0', '#2f4459', '#1c2836', '#13171d'], lilac: ['#a98bff', '#ffb6d9', '#2d3f5c', '#1a2338', '#121520'],
  magenta: ['#e0408f', '#ff9f6b', '#0e4a5a', '#0a2b36', '#0d1418'], copper: ['#d4773f', '#f0c088', '#0f5a5a', '#0b3739', '#0f1617'],
  oxblood: ['#c2304a', '#f39c7a', '#3b1d2c', '#22121b', '#140d11'], mint: ['#3fd0b0', '#a8b8ff', '#26305e', '#171c3c', '#0f111d'],
  citrus: ['#f0b429', '#ff7a3d', '#1c4636', '#122b22', '#0f1613'], opal: ['#ff8fc8', '#8fe1ff', '#3a3870', '#21203f', '#111120'],
  slate: ['#7fa6d1', '#e6c9a8', '#2c3a4a', '#1b2430', '#13171d'], ice: ['#7fc4ff', '#c6b5ff', '#28325e', '#181d3b', '#0f111c'],
  terracotta: ['#e0643a', '#f4b183', '#52342a', '#2c1d18', '#171210'], peacock: ['#00a3a3', '#f2c14e', '#123f55', '#0c2736', '#0c1218']
};
const AURORAS = ['sunset', 'ocean', 'forest', 'dusk', 'rose', 'storm', 'snow', 'night']; // fixed choices in Settings
const AU_MAP = { sunset: 'ember', ocean: 'cobalt', forest: 'jade', dusk: 'lilac', rose: 'roseink', storm: 'slate', snow: 'ice', night: 'opal' };
const Aurora = {
  card: null, last: ls.get('kept.au.last', null),
  rnd: (a, b) => a + Math.random() * (b - a),
  /* the light always enters from the top half (95°–265°), so the question and the input stay legible */
  make(avoid) {
    const pref = S.prefs.aurora || 'auto'; const keys = Object.keys(PALS);
    const prev = [avoid?.key, this.last?.key].filter(Boolean); const prevAng = [avoid?.ang, this.last?.ang].filter(x => x != null);
    let key = AU_MAP[pref] || null;
    if (!key) { const pool = keys.filter(k => !prev.includes(k)); key = pool[Math.floor(Math.random() * pool.length)]; }
    let ang, n = 0; const far = x => prevAng.every(p => Math.abs(x - p) >= 45);
    do { ang = Math.round(this.rnd(95, 265)); } while (!far(ang) && ++n < 40);
    const g = { key, ang, p1: Math.round(this.rnd(9, 20)), p2: Math.round(this.rnd(30, 46)), p3: Math.round(this.rnd(58, 74)) };
    const at = (a, d) => { const r = a * Math.PI / 180; return [Math.round(50 - d * Math.sin(r)), Math.round(50 + d * Math.cos(r))]; };
    const side = Math.random() < .5 ? -1 : 1;
    [g.gx, g.gy] = at(ang, 52);                                   // main light where it enters
    [g.hx, g.hy] = at(ang + side * this.rnd(38, 58), 46);         // second colour, beside it
    [g.kx, g.ky] = at(ang + 180 + side * this.rnd(-30, 30), 40);  // faint echo on the far side
    this.last = { key, ang }; ls.set('kept.au.last', this.last);
    return g;
  },
  vars(g) { const c = PALS[g.key] || PALS.ember; return { '--ga': g.ang + 'deg', '--g1': c[0], '--g2': c[1], '--g3': c[2], '--g4': c[3], '--g5': c[4], '--gp1': g.p1 + '%', '--gp2': g.p2 + '%', '--gp3': g.p3 + '%', '--gx': g.gx + '%', '--gy': g.gy + '%', '--hx': (g.hx ?? 70) + '%', '--hy': (g.hy ?? 10) + '%', '--kx': (g.kx ?? 70) + '%', '--ky': (g.ky ?? 100) + '%' }; },
  style(g) { return Object.entries(this.vars(g)).map(([k, v]) => `${k}:${v}`).join(';'); },
  apply(el, g) { if (!el) return; el.dataset.au = g.key; Object.entries(this.vars(g)).forEach(([k, v]) => el.style.setProperty(k, v)); },
  fixed(name) { return { key: AU_MAP[name] || name, ang: 160, p1: 14, p2: 38, p3: 66, gx: 30, gy: 0 }; },
  next() { this.card = this.make(this.card); return this.card; },
  name() { if (!this.card) this.card = this.make(); return this.card.key; },
  attr() { if (!this.card) this.card = this.make(); return `data-au="${this.card.key}" style="${this.style(this.card)}"`; },
  layers: ''
};
function watchAuroras() {}
const AuroraFX = { scan() {}, kick() {} };

export { AURORAS, Aurora, AuroraFX, watchAuroras };
