/* Kept — Translation and locale formatting runtime */
import { I18N } from './strings.js';
import { $$ } from './utils.js';

/* ---------- i18n runtime ---------- */
let LANG = 'en';
function setLang(l) { LANG = l; }
function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return s;
}
function tn(key, n, vars = {}) { // plural helper: key.one / key.other
  const k = n === 1 && I18N[LANG][key + '.one'] ? key + '.one' : key + '.other';
  return t(k, Object.assign({ n: fmtNum(n) }, vars));
}
const safeLocale = tag => { try { return Intl.getCanonicalLocales(String(tag).split('@')[0].replace('_', '-'))[0] || 'en-US'; } catch { return 'en-US'; } };
const locale = () => LANG === 'ko' ? 'ko-KR' : (navigator.language && navigator.language.startsWith('en') ? safeLocale(navigator.language) : 'en-US');
const fmtNum = n => new Intl.NumberFormat(locale()).format(n);
const fmtDate = (d, o) => new Intl.DateTimeFormat(locale(), o).format(typeof d === 'string' ? new Date(d) : d);
const fmtTime = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return fmtDate(new Date(2000, 0, 1, h, m), { hour: 'numeric', minute: '2-digit' }); };
function fmtRel(iso) {
  const d = new Date(iso), diff = (Date.now() - d) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (diff < 45) return t('time.justNow');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 6) return rtf.format(-Math.round(diff / 86400), 'day');
  return fmtDate(d, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
function applyI18n(root = document) {
  $$('[data-i18n]', root).forEach(n => n.textContent = t(n.dataset.i18n));
  $$('[data-i18n-ph]', root).forEach(n => n.placeholder = t(n.dataset.i18nPh));
  $$('[data-i18n-title]', root).forEach(n => { n.title = t(n.dataset.i18nTitle); n.setAttribute('aria-label', n.title); });
  document.documentElement.lang = LANG;
}

export { LANG, applyI18n, fmtDate, fmtNum, fmtRel, fmtTime, locale, setLang, t, tn };
