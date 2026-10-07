/* Kept — Paragraph spacing: five steps. v1 had three (compact / normal / relaxed); v2 makes the old
   "compact" look the default "base", so stored values are mapped to the step that looks the same. */
const SPACINGS = ['xtight', 'tight', 'base', 'loose', 'xloose'];
const LEGACY_ENTRY = { compact: 'base', normal: 'loose', relaxed: 'xloose' };   // per-record choice: keep its look
const LEGACY_PREF = { compact: 'base', normal: 'base', relaxed: 'xloose' };     // app default: old default becomes the new one
const prefSpacing = v => SPACINGS.includes(v) ? v : (LEGACY_PREF[v] || 'base');
const entrySpacing = (e, prefs) => { const v = e?.meta?.spacing; return SPACINGS.includes(v) ? v : (LEGACY_ENTRY[v] || prefSpacing(prefs?.spacing)); };

export { SPACINGS, entrySpacing, prefSpacing };
