/* Kept — Runtime config (from config.js), limits and version */
const CFG = Object.assign({ SUPABASE_URL:'', SUPABASE_ANON_KEY:'', SUBSCRIBE:{}, SITE_URL:'', PRIVACY_CONTACT:'', OPERATOR:'' }, window.KEPT_CONFIG || {});
const LIMITS = { entries: 20000, entryChars: 200000, categories: 200, tagsPerEntry: 30, tagLen: 40 };
const APP_VERSION = '2.0.0-alpha.1';

export { APP_VERSION, CFG, LIMITS };
