/* Kept — Install guide */
import { ACT } from '../app/actions.js';
import { isNarrow } from '../editor/editor.js';
import { t } from '../lib/i18n.js';
import { esc, icon, ls } from '../lib/utils.js';
import { dialog } from '../ui/feedback.js';
import { InstallPrompt } from '../ui/shell.js';

/* ---------- Install guide (iPhone / iPad / Android / desktop) ---------- */
const Platform = {
  ios: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  ipad: () => /ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  android: () => /android/i.test(navigator.userAgent),
  inApp: () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps|everytimeApp|Whale\/.*inapp/i.test(navigator.userAgent),
  standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
};
function installBanner() {
  if (Platform.standalone() || ls.get('kept.instHint') === 'off') return '';
  if (!(Platform.ios() || (Platform.android() && InstallPrompt.event) || (Platform.android() && isNarrow()))) return '';
  return `<div class="inst-banner rise"><img src="icons/icon-192.png" alt="" width="44" height="44"><div class="ib-t"><b>${esc(t('inst.bannerTitle'))}</b><span>${esc(t('inst.bannerSub'))}</span></div>
    <button class="btn sm primary" data-act="${InstallPrompt.event ? 'install' : 'installGuide'}">${esc(InstallPrompt.event ? t('set.installBtn') : t('inst.how'))}</button><button class="icon-btn" data-act="instHintOff" aria-label="${esc(t('common.close'))}">${icon('x')}</button></div>`;
}
function installGuide() {
  const step = (n, ic, title, sub) => `<li class="ig-step"><span class="ig-n">${n}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><span class="ig-ic">${ic}</span></li>`;
  const shareIc = icon('share'), plusIc = icon('square-plus');
  let steps, intro = '', note = '';
  if (Platform.standalone()) { steps = `<li class="ig-step done">${icon('circle-check')}<div><b>${esc(t('set.installed'))}</b></div></li>`; }
  else if (Platform.ios()) {
    if (Platform.inApp()) intro = `<div class="note warn">${icon('alert-triangle')}<span>${esc(t('inst.inApp'))}</span></div>`;
    const ipad = Platform.ipad();
    steps = step(1, shareIc, esc(t('inst.ios1')), esc(t(ipad ? 'inst.ios1Pad' : 'inst.ios1Phone'))) + step(2, plusIc, esc(t('inst.ios2')), esc(t('inst.ios2Sub'))) +
      step(3, `<b class="ig-add">${esc(t('inst.addWord'))}</b>`, esc(t('inst.ios3')), '') + step(4, `<img src="icons/icon-192.png" alt="" width="28" height="28" style="border-radius:7px">`, esc(t('inst.ios4')), '');
    note = t('inst.iosNote');
  } else if (Platform.android()) {
    steps = step(1, icon('ellipsis-vertical'), esc(t('inst.and1')), esc(t('inst.and1Sub'))) + step(2, icon('monitor-down'), esc(t('inst.and2')), '') + step(3, `<img src="icons/icon-192.png" alt="" width="28" height="28" style="border-radius:7px">`, esc(t('inst.ios4')), '');
  } else {
    steps = step(1, icon('monitor-down'), esc(t('inst.desk1')), esc(t('inst.desk1Sub'))) + step(2, icon('app-window'), esc(t('inst.desk2')), '');
  }
  dialog({ title: t('inst.title'), wide: true, html: `${intro}<p>${esc(t('inst.why'))}</p><ol class="ig">${steps}</ol>${note ? `<div class="note">${icon('info')}<span>${esc(note)}</span></div>` : ''}`,
    actions: [...(InstallPrompt.event ? [{ label: t('set.installBtn'), cls: 'primary', run: () => { ACT.install(); } }] : []), { label: t('common.close'), cls: InstallPrompt.event ? 'ghost' : 'primary', value: true }] });
}

export { Platform, installBanner, installGuide };
