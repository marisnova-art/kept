/* Kept — Sign in / sign up / reset */
import { pwProblem } from './menus.js';
import { startCloud, startLocal } from './session.js';
import { S, savePrefs } from '../data/store.js';
import { Conn, getSupabase } from '../data/supabase.js';
import { Aurora } from '../features/aurora.js';
import { LANG, t } from '../lib/i18n.js';
import { $, esc, icon, ls } from '../lib/utils.js';
import { dialog, toast } from '../ui/feedback.js';
import { viewLegal } from '../views/pages.js';

/* ---------- Auth ---------- */
function showAuth(mode = 'signin', allowBack = false, msg = '') {
  const a = $('#auth'); a.hidden = false;
  const titles = { signin: t('auth.welcome'), signup: t('auth.create'), reset: t('auth.resetTitle'), newpw: t('auth.newPwTitle') };
  const subs = { signin: t('auth.signinSub'), signup: t('auth.signupSub'), reset: t('auth.resetSub'), newpw: t('auth.newPwSub') };
  a.innerHTML = `<div class="aurora auth-art" ${Aurora.attr()}>${Aurora.layers}<div class="auth-top"><span class="wordmark">kept<i></i></span>
      <button class="chip-t" data-auth-lang>${icon('globe')}<span>${LANG === 'ko' ? 'English' : '한국어'}</span></button></div>
      <div class="auth-hero"><div class="cap kick">${esc(t('auth.kicker'))}</div><h1>${esc(t('auth.hero'))}</h1><div class="cap free">${esc(t('auth.free'))}</div></div></div>
    <div class="auth-form"><form id="authForm" class="auth-${mode}" novalidate>
      <h2>${esc(titles[mode])}</h2><p class="sub">${esc(subs[mode])}</p>
      ${mode !== 'newpw' ? `<div class="field"><label for="aEmail">${esc(t('auth.email'))}</label><input class="input" id="aEmail" type="email" autocomplete="email" required maxlength="200"></div>` : ''}
      ${mode === 'signin' || mode === 'signup' || mode === 'newpw' ? `<div class="field"><label for="aPw">${esc(mode === 'newpw' ? t('auth.newPw') : t('auth.password'))}</label><input class="input" id="aPw" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required minlength="8" maxlength="200"></div>` : ''}
      ${mode === 'signup' || mode === 'newpw' ? `<div class="field"><label for="aPw2">${esc(t('auth.confirmPw'))}</label><input class="input" id="aPw2" type="password" autocomplete="new-password" required></div>` : ''}
      ${mode === 'signup' ? `<p style="font-size:var(--t-sub);color:var(--text-2);margin:4px 0 14px">${t('auth.agree', { p: `<a href="#/privacy" data-auth-doc="privacy">${esc(t('legal.privacy'))}</a>`, t: `<a href="#/terms" data-auth-doc="terms">${esc(t('legal.terms'))}</a>` })}</p>` : ''}
      <div id="aMsg" class="note" ${msg ? '' : 'hidden'} style="margin-bottom:12px">${esc(msg)}</div>
      <button class="btn primary" type="submit" id="aSubmit">${esc({ signin: t('auth.signIn'), signup: t('auth.signUp'), reset: t('auth.sendLink'), newpw: t('auth.setPw') }[mode])}</button>
      <div class="auth-links">${mode === 'signin' ? `<button type="button" data-auth="signup">${esc(t('auth.toSignup'))}</button><button type="button" data-auth="reset">${esc(t('auth.forgot'))}</button>` : mode !== 'newpw' ? `<button type="button" data-auth="signin">${esc(t('auth.toSignin'))}</button>` : ''}</div>
      ${mode !== 'newpw' ? `<div class="divider">${esc(t('auth.or'))}</div><button type="button" class="btn" data-auth="local">${icon('smartphone')}${esc(allowBack && S.db ? t('auth.back') : t('auth.local'))}</button><p class="auth-note">${esc(t('auth.localNote'))}</p>` : ''}
    </form></div>`;
  const say = (m, kind = 'err') => { const n = $('#aMsg'); n.hidden = false; n.className = 'note ' + kind; n.textContent = m; };
  a.onclick = e => {
    const b = e.target.closest('[data-auth]'); const d = e.target.closest('[data-auth-doc]'); const lg = e.target.closest('[data-auth-lang]');
    if (lg) { savePrefs({ lang: LANG === 'ko' ? 'en' : 'ko' }); showAuth(mode, allowBack); return; }
    if (d) { e.preventDefault(); dialog({ title: t(d.dataset.authDoc === 'privacy' ? 'legal.privacy' : 'legal.terms'), wide: true, html: `<div class="doc" style="max-height:60vh;overflow:auto">${viewLegal(d.dataset.authDoc).replace(/<div class="ph">[\s\S]*?<\/div><\/div>/, '')}</div>`, actions: [{ label: t('common.close'), cls: 'primary' }] }); return; }
    if (!b) return; const m = b.dataset.auth;
    if (m === 'local') { if (allowBack && S.db) { a.hidden = true; return; } ls.set('kept.mode', 'local'); a.hidden = true; startLocal(); return; }
    showAuth(m, allowBack);
  };
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#aEmail')?.value.trim(); const pw = $('#aPw')?.value || ''; const pw2 = $('#aPw2')?.value;
    if (mode !== 'newpw' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say(t('err.email')); return; }
    if (mode === 'signup' || mode === 'newpw') { const p = pwProblem(pw, pw2); if (p) { say(p); return; } }
    if (!navigator.onLine) { say(t('net.offline')); return; }
    const sb = await getSupabase().catch(() => null); if (!sb) { say(Conn.configured() ? t('err.connFail') : t('conn.missing')); return; }
    const btn = $('#aSubmit'); btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${icon('loader')}`;
    try {
      if (mode === 'signin') { const { data, error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error; a.hidden = true; await startCloud(data.user); }
      else if (mode === 'signup') { const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } }); if (error) throw error;
        if (data.session) { a.hidden = true; await startCloud(data.user); } else say(t('auth.checkEmail', { email }), 'ok'); }
      else if (mode === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; say(t('auth.resetSent'), 'ok'); }
      else if (mode === 'newpw') { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; toast(t('auth.pwChanged')); a.hidden = true; const { data } = await sb.auth.getUser(); if (data.user && S.mode !== 'cloud') await startCloud(data.user); }
    } catch (err) {
      const m = String(err.message || err); say(/invalid login/i.test(m) ? t('auth.badLogin') : /not confirmed/i.test(m) ? t('auth.notConfirmed') : /already registered/i.test(m) ? t('auth.exists') : /rate limit/i.test(m) ? t('auth.rate') : t('err.server', { m }));
    } finally { btn.disabled = false; btn.innerHTML = old; }
  };
  setTimeout(() => $('#aEmail, #aPw')?.focus(), 50);
}

export { showAuth };
