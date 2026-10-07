/* Kept — Settings */
import { CITIES, cityLookup } from '../data/cities.js';
import { ACCENTS, S, typeList } from '../data/store.js';
import { Conn } from '../data/supabase.js';
import { AURORAS, Aurora } from '../features/aurora.js';
import { avatarHTML, validAvatar } from '../features/avatar.js';
import { Platform } from '../features/install.js';
import { Billing } from '../features/billing.js';
import { Reminders } from '../features/reminders.js';
import { APP_VERSION, LIMITS } from '../lib/config.js';
import { LANG, fmtDate, fmtNum, fmtRel, locale, t } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { header } from '../ui/entries.js';
import { V } from '../ui/router.js';
import { InstallPrompt } from '../ui/shell.js';
import { SPACINGS, prefSpacing } from '../editor/spacing.js';

/* ---------- Settings ---------- */
/* the account's plan, signed-in only */
function planRow(rowH) {
  if (S.mode !== 'cloud') return '';
  const s = Billing.sub; const on = Billing.isSubscriber();
  const sub = on ? t('plan.yours', { p: t('plan.' + Billing.plan()) }) + (s?.current_period_end && !s.cancel_at ? ' · ' + t('plan.renewsOn', { d: fmtDate(s.current_period_end, { dateStyle: 'medium' }) }) : s?.cancel_at ? ' · ' + t('plan.endsOn', { d: fmtDate(s.cancel_at, { dateStyle: 'medium' }) }) : '') : t('set.planFree');
  return rowH(esc(t('set.plan')) + (on ? ` <span class="pl-chip">${icon('gem')}${esc(t('plan.badge'))}</span>` : ''), esc(sub), `<a class="btn sm ${on ? '' : 'accent'}" href="#/support">${esc(on ? t('common.view') : t('nav.support'))}</a>`);
}
function viewSettings() {
  const conn = Conn.get(); const p = S.prefs; const perm = Reminders.permission();
  const size = new Blob([JSON.stringify([...S.entries.values()])]).size;
  const sec = (id, ic, title, body) => `<section id="set-${id}"><h3 style="font-size:var(--t-sub);color:var(--text-2);font-weight:500;margin:22px 4px 8px;display:flex;gap:8px;align-items:center">${icon(ic)}${esc(title)}</h3><div class="panel">${body}</div></section>`;
  const rowH = (l, s, r) => `<div class="set-row"><div class="l"><b>${l}</b>${s ? `<small>${s}</small>` : ''}</div><div class="r">${r}</div></div>`;
  const account = S.mode === 'cloud'
    ? rowH(esc(S.user.email), esc(t('set.syncedAcc')), `<button class="btn sm" data-act="changePw">${icon('key-round')}${esc(t('set.changePw'))}</button><button class="btn sm" data-act="signOut">${icon('log-out')}${esc(t('set.signOut'))}</button>`) +
      rowH(esc(t('set.lastSync')), esc(S.lastSyncAt ? fmtRel(S.lastSyncAt) : t('set.never')), `<button class="btn sm" data-act="syncNow">${icon('refresh-cw')}${esc(t('set.syncNow'))}</button>`)
    : rowH(esc(t('set.localMode')), esc(Conn.configured() ? t('set.localModeSub') : t('set.localModeNoConn')), Conn.configured() ? `<button class="btn sm primary" data-act="signIn">${icon('user')}${esc(t('auth.signIn'))}</button>` : '');
  return `<div class="wrap view-enter">${header(esc(t('nav.settings')), '')}
  <div class="settings-layout"><nav class="set-nav">${[['account', 'set.account'], ['appearance', 'set.appearance'], ['records', 'set.records'], ['notifications', 'set.notifications'], ['data', 'set.data'], ['connection', 'set.connection'], ['app', 'set.app'], ['about', 'set.about']].map(([id, k]) => `<a href="#/settings#${id}" data-act="setJump" data-id="${id}">${esc(t(k))}</a>`).join('')}</nav>
  <div>
  ${sec('account', 'user', t('set.account'), rowH(esc(t('avatar.title')), esc(t('avatar.sub')), `<span class="avatar-lg">${avatarHTML('avatar')}</span><button class="btn sm" data-act="avatarPick">${icon('camera')}${esc(t('avatar.choose'))}</button>${validAvatar(p.avatar) ? `<button class="btn sm ghost" data-act="avatarDel">${esc(t('common.remove'))}</button>` : ''}`) + account + planRow(rowH) + rowH(esc(t('set.displayName')), esc(t('set.displayNameSub')), `<input class="input" style="width:220px;height:38px" maxlength="40" data-chg="displayName" value="${esc(p.displayName || '')}">`))}
  ${sec('appearance', 'palette', t('set.appearance'),
    rowH(esc(t('set.home')), esc(t('set.homeSub')), `<div class="seg">${[['story', 'feather', 'home.story'], ['board', 'layout-grid', 'home.board']].map(([v, ic, k]) => `<button class="${(p.homeStyle || 'story') === v ? 'on' : ''}" data-act="setHome" data-v="${v}">${icon(ic)}${esc(t(k))}</button>`).join('')}</div>`) +
    rowH(esc(t('set.language')), '', `<div class="seg">${[['ko', '한국어'], ['en', 'English']].map(([v, l]) => `<button class="${LANG === v ? 'on' : ''}" data-act="setLang" data-v="${v}">${l}</button>`).join('')}</div>`) +
    rowH(esc(t('set.textSize')), esc(t('set.textSizeSub')), `<div class="seg">${['m', 'l', 'xl'].map(v => `<button class="${(p.textSize || 'm') === v ? 'on' : ''}" data-act="setFs" data-v="${v}"><span style="font-size:${v === 'm' ? 14 : v === 'l' ? 16 : 18}px;font-weight:600">가</span>${esc(t('fs.' + v))}</button>`).join('')}</div>`) +
    rowH(esc(t('set.theme')), '', `<div class="seg">${[['system', 'monitor'], ['light', 'sun'], ['dark', 'moon']].map(([v, ic]) => `<button class="${p.theme === v ? 'on' : ''}" data-act="setTheme" data-v="${v}">${icon(ic)}${esc(t('theme.' + v))}</button>`).join('')}</div>`) +
    rowH(esc(t('set.accent')), esc(t('set.accentSub')), `<div class="swatches">${ACCENTS.map(c => `<button class="swatch ${p.accent === c ? 'on' : ''}" style="--s:${c}" data-act="setAccent" data-v="${c}" aria-label="${c}"></button>`).join('')}<label class="swatch" style="--s:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);position:relative;overflow:hidden" title="${esc(t('set.custom'))}"><input type="color" data-chg="accent" value="${esc(p.accent)}" style="opacity:0;position:absolute;inset:0;cursor:pointer"></label></div>`) +
    rowH(esc(t('set.aurora')), esc(t('set.auroraSub')), `<div class="au-picks"><button class="au-pick auto ${(p.aurora || 'auto') === 'auto' ? 'on' : ''}" data-act="setAurora" data-v="auto">${esc(t('set.auroraAuto'))}</button>${AURORAS.map(a => `<button class="au-pick aurora ${p.aurora === a ? 'on' : ''}" data-au="${a}" style="${Aurora.style(Aurora.fixed(a))}" data-act="setAurora" data-v="${a}" title="${esc(t('au.' + a))}" aria-label="${esc(t('au.' + a))}"></button>`).join('')}</div>`) +
    rowH(esc(t('set.weather')), esc(t('set.weatherSub')), (() => {
      const cur = cityLookup(p.wxCity); const cc = V.wxCountry ?? cur?.cc ?? '';
      const ctry = Object.entries(CITIES).map(([k, v]) => [k, LANG === 'ko' ? v.ko : v.en]).sort((a, b) => (b[0] === 'KR') - (a[0] === 'KR') || a[1].localeCompare(b[1], locale()));
      const cities = cc && CITIES[cc] ? CITIES[cc].c.map(r => [r[0], LANG === 'ko' ? r[2] : r[1]]) : [];
      return `<div class="wx-pick"><select class="select" data-chg="wxCountry" aria-label="${esc(t('set.wxCountry'))}"><option value="">${esc(t('set.wxNone'))}</option>${ctry.map(([k, n]) => `<option value="${k}" ${cc === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <select class="select" data-chg="wxCity" aria-label="${esc(t('set.wxCity'))}" ${cc ? '' : 'disabled'}><option value="">${esc(t('set.wxCityPh'))}</option>${cities.map(([id, n]) => `<option value="${cc}:${id}" ${p.wxCity === cc + ':' + id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        ${cur ? `<button class="btn sm" data-act="wxLoad">${icon('refresh-cw')}${esc(t('wx.refresh'))}</button>` : ''}</div>`;
    })()) +
    rowH(esc(t('set.spacing')), '', `<select class="select" data-chg="spacing">${SPACINGS.map(v => `<option value="${v}" ${prefSpacing(p.spacing) === v ? 'selected' : ''}>${esc(t('spacing.' + v))}</option>`).join('')}</select>`))}
  ${sec('records', 'layers', t('set.records'),
    rowH(esc(t('set.defType')), '', `<select class="select" data-chg="defaultType">${typeList().map(x => `<option value="${x.id}" ${p.defaultType === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`) +
    rowH(esc(t('set.defSort')), '', `<select class="select" data-chg="sort">${['updated', 'created', 'date', 'oldest', 'title'].map(s => `<option value="${s}" ${p.sort === s ? 'selected' : ''}>${esc(t('sort.' + s))}</option>`).join('')}</select>`) +
    rowH(esc(t('set.weekStart')), '', `<select class="select" data-chg="weekStart">${[[1, 'set.monday'], [0, 'set.sunday']].map(([v, k]) => `<option value="${v}" ${p.weekStart === v ? 'selected' : ''}>${esc(t(k))}</option>`).join('')}</select>`) +
    `<div class="set-row" style="display:block"><div class="l" style="margin-bottom:10px"><b>${esc(t('set.types'))}</b><small>${esc(t('set.typesSub'))}</small></div>
      ${typeList().map(x => `<div class="cat-row">${icon(x.icon)}<span style="flex:1">${esc(x.label)}${x.builtin ? '' : ` <span class="tg">${esc(t('set.custom'))}</span>`}</span>
        <button class="btn sm ghost" data-act="typeRename" data-id="${x.id}">${icon('pencil')}${esc(t('common.rename'))}</button>
        ${x.builtin ? (p.typeLabels[x.id] ? `<button class="btn sm ghost" data-act="typeReset" data-id="${x.id}">${icon('rotate-ccw')}</button>` : '') : `<button class="icon-btn" data-act="typeDel" data-id="${x.id}" aria-label="${esc(t('common.delete'))}">${icon('trash-2')}</button>`}</div>`).join('')}
      <div style="padding-top:10px"><button class="btn sm" data-act="typeNew">${icon('plus')}${esc(t('set.newType'))}</button></div></div>`)}
  ${sec('notifications', 'bell', t('set.notifications'),
    rowH(esc(t('set.notifStatus')), esc(perm === 'unsupported' && Platform.ios() && !Platform.standalone() ? t('notif.iosHint') : t('notif.perm.' + perm)) + '<br>' + esc(t('notif.limits')),
      perm === 'unsupported' ? '' : perm === 'granted' ? `<button class="toggle ${p.notify ? 'on' : ''}" data-act="notifyToggle" aria-label="${esc(t('set.notifications'))}" aria-pressed="${!!p.notify}"></button><button class="btn sm" data-act="notifyTest">${esc(t('set.notifTest'))}</button>` : perm === 'denied' ? '' : `<button class="btn sm primary" data-act="notifyReq">${esc(t('set.notifEnable'))}</button>`))}
  ${sec('data', 'database', t('set.data'),
    rowH(esc(t('set.usage')), esc(t('set.usageSub', { n: fmtNum(S.entries.size), max: fmtNum(LIMITS.entries), kb: fmtNum(Math.round(size / 1024)) })), '') +
    rowH(esc(t('set.export')), esc(t('set.exportSub')), `<button class="btn sm" data-act="exportJson">${icon('download')}JSON</button><button class="btn sm" data-act="exportCsv">${icon('download')}CSV</button>`) +
    rowH(esc(t('set.import')), esc(t('set.importSub')), `<button class="btn sm" data-act="importJson">${icon('upload')}${esc(t('set.importBtn'))}</button>`) +
    rowH(esc(t('set.deleteAll')), esc(t('set.deleteAllSub')), `<button class="btn sm danger" data-act="deleteAll">${esc(t('common.delete'))}</button>`) +
    (S.mode === 'cloud' ? rowH(esc(t('set.deleteAcc')), esc(t('set.deleteAccSub')), `<button class="btn sm danger solid" data-act="deleteAccount">${esc(t('set.deleteAccBtn'))}</button>`) : ''))}
  ${sec('connection', 'cloud', t('set.connection'),
    `<div style="padding:14px 0">${Conn.configured() ? `<div class="note ok">${icon('cloud-check')}<span>${esc(t('conn.ok', { host: conn.url.replace(/^https:\/\//, '') }))}</span></div>` : `<div class="note warn">${icon('cloud-off')}<span>${esc(t('conn.missing'))}</span></div>`}</div>
    ${conn.fromFile ? '' : `<div class="field"><label>Supabase URL</label><input class="input" id="connUrl" placeholder="https://xxxx.supabase.co" value="${esc(conn.url)}" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>${esc(t('conn.anonKey'))}</label><input class="input" id="connKey" placeholder="eyJhbGciOi…" value="${esc(conn.key)}" autocomplete="off" spellcheck="false"></div>
    <div class="note" style="margin-bottom:12px">${icon('shield')}<span>${esc(t('conn.keyNote'))}</span></div>
    <div style="display:flex;gap:8px;padding-bottom:14px"><button class="btn sm primary" data-act="connSave">${esc(t('common.save'))}</button>${Conn.configured() ? `<button class="btn sm ghost" data-act="connClear">${esc(t('conn.clear'))}</button>` : ''}</div>`}`)}
  ${sec('app', 'smartphone', t('set.app'),
    rowH(esc(t('set.install')), esc(installHint()), (InstallPrompt.event ? `<button class="btn sm primary" data-act="install">${icon('download')}${esc(t('set.installBtn'))}</button>` : '') + `<button class="btn sm" data-act="installGuide">${icon('smartphone')}${esc(t('inst.how'))}</button>`) +
    rowH(esc(t('set.shortcuts')), esc(t('set.shortcutsSub')), `<button class="btn sm" data-act="shortcuts">${icon('keyboard')}${esc(t('common.view'))}</button>`))}
  ${sec('about', 'info', t('set.about'),
    rowH(esc(t('about.nav')), esc(t('about.navSub')), `<a class="btn sm" href="#/about">${icon('info')}${esc(t('common.view'))}</a>`) +
    rowH(esc(t('faq.nav')), esc(t('faq.navSub')), `<a class="btn sm" href="#/faq">${icon('circle-help')}${esc(t('common.view'))}</a>`) +
    rowH(esc(t('nav.support')), esc(t('set.supportSub')), `<a class="btn sm accent" href="#/support">${icon('hand-heart')}${esc(t('nav.support'))}</a>`) +
    rowH(esc(t('promo.title')), esc(t('promo.sub')), `<button class="btn sm" data-act="promo">${icon('share')}${esc(t('promo.btn'))}</button>`) +
    rowH(esc(t('legal.privacy')), '', `<a class="btn sm" href="#/privacy">${esc(t('common.view'))}</a>`) +
    rowH(esc(t('legal.terms')), '', `<a class="btn sm" href="#/terms">${esc(t('common.view'))}</a>`) +
    rowH('Kept ' + APP_VERSION, esc(t('set.aboutSub')), ''))}
  </div></div></div>`;
}
function installHint() {
  if (matchMedia('(display-mode: standalone)').matches) return t('set.installed');
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return t('set.installIos');
  return InstallPrompt.event ? t('set.installReady') : t('set.installMenu');
}

export { viewSettings };
