/* Kept — Weather (Open-Meteo) */
import { cityLookup } from '../data/cities.js';
import { S, emit } from '../data/store.js';
import { t } from '../lib/i18n.js';
import { esc, icon, ls } from '../lib/utils.js';
import { V } from '../ui/router.js';

/* ---------- Weather ---------- */
const WMO = c => c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'cloudy' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'rain' : c <= 86 ? 'snow' : 'thunder';
const Weather = {
  data: ls.get('kept.weather', null),
  busy: false,
  city() { return cityLookup(S.prefs.wxCity); },
  enabled() { return !!this.city(); },
  fresh(ms = 50 * 60e3) { return !!(this.data && this.data.city === S.prefs.wxCity && Date.now() - this.data.at < ms); },
  kind(w = this.data) { return w ? WMO(w.code) : null; },
  icon(w = this.data) {
    const k = this.kind(w), day = w?.isDay !== 0;
    return { clear: day ? 'sun' : 'moon', partly: day ? 'cloud-sun' : 'cloud-moon', cloudy: 'cloud', fog: 'cloud-fog', drizzle: 'cloud-drizzle', rain: 'cloud-rain', snow: 'cloud-snow', thunder: 'cloud-lightning' }[k] || 'cloud';
  },
  palette(w) {
    const k = this.kind(w), day = w.isDay !== 0;
    if (!day && (k === 'clear' || k === 'partly')) return 'night';
    return { clear: new Date().getHours() >= 16 ? 'sunset' : 'rose', partly: 'ocean', cloudy: 'dusk', fog: 'dusk', drizzle: 'storm', rain: 'storm', snow: 'snow', thunder: 'night' }[k] || 'ocean';
  },
  tempWord(tC) { return t(tC < 0 ? 'tw.freezing' : tC < 8 ? 'tw.cold' : tC < 16 ? 'tw.cool' : tC < 24 ? 'tw.mild' : tC < 29 ? 'tw.warm' : 'tw.hot'); },
  /* the city chosen in Settings is the only input — no device location, no permission prompts */
  auto() { if (this.enabled() && !this.fresh()) this.load(); },
  async load() {
    const c = this.city(); if (!c || this.busy) return;
    this.busy = true; emit('weather');
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
      if (!r.ok) throw new Error('weather ' + r.status);
      const j = await r.json();
      this.data = { city: c.id, at: Date.now(), temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, isDay: j.current.is_day, max: Math.round(j.daily.temperature_2m_max[0]), min: Math.round(j.daily.temperature_2m_min[0]) };
      ls.set('kept.weather', this.data);
    } catch (e) { console.warn(e); }
    finally { this.busy = false; emit('weather'); }
  },
  html() {
    const c = this.city(); if (!c) return '';
    const w = this.data && this.data.city === c.id && Date.now() - this.data.at < 6 * 3600e3 ? this.data : null;
    if (!w) return this.busy ? `<span class="wx wx-wait">${icon('loader')}<span>${esc(c.name)}</span></span>` : '';
    const k = this.kind(w); const label = t('wx.' + k);
    if (!V.wxStyle) V.wxStyle = 'icon';
    if (V.wxStyle === 'icon') return `<button class="wx wx-icon" data-act="wxStyle" title="${esc(c.country + ' · ' + c.name)}"><span class="wx-ic">${icon(this.icon(w))}</span><b>${w.temp}°</b><span class="wx-meta"><em>${esc(label)}</em><small>${esc(c.name)} · ↑${w.max}° ↓${w.min}°</small></span></button>`;
    return `<button class="wx wx-text" data-act="wxStyle" title="${esc(c.country)}">${esc(c.name)}, ${esc(t('wd.' + k, { tw: this.tempWord(w.temp) }))} <b>${w.temp}°</b></button>`;
  }
};

export { Weather };
