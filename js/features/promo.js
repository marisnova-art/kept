/* Kept — "Tell people about Kept": a ready note with the link, sent through the system share sheet,
   a copy, or a few common places. Nothing is posted by the app itself. */
import { CFG } from '../lib/config.js';
import { t } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { dialog, toast } from '../ui/feedback.js';
import { pop } from '../ui/motion.js';

const siteUrl = () => (CFG.SITE_URL || (location.origin + location.pathname)).replace(/#.*$/, '');

function promoDialog() {
  const url = siteUrl();
  const enc = encodeURIComponent;
  const targets = [
    ['x', 'X', text => `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`],
    ['threads', 'Threads', text => `https://www.threads.net/intent/post?text=${enc(text + ' ' + url)}`],
    ['facebook', 'Facebook', () => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['line', 'LINE', text => `https://line.me/R/share?text=${enc(text + ' ' + url)}`],
    ['mail', t('promo.email'), text => `mailto:?subject=${enc(t('promo.mailSubject'))}&body=${enc(text + '\n\n' + url)}`]
  ];
  return dialog({
    title: t('promo.title'), body: t('promo.sub'),
    html: `<label class="pm-l">${esc(t('promo.edit'))}<textarea class="input pm-msg" rows="3" maxlength="400">${esc(t('promo.msg'))}</textarea></label>
      <div class="pm-link"><span>${esc(url)}</span><button class="btn sm" data-pm="link">${icon('link')}${esc(t('promo.copyLink'))}</button></div>
      <div class="pm-grid">${navigator.share ? `<button class="pm-t" data-pm="share">${icon('share')}<span>${esc(t('promo.share'))}</span></button>` : ''}
        <button class="pm-t" data-pm="all">${icon('copy')}<span>${esc(t('promo.copyAll'))}</span></button>
        ${targets.map(([id, label]) => `<a class="pm-t" data-pm="${id}" href="#" target="_blank" rel="noopener noreferrer">${icon(id === 'mail' ? 'mail' : 'external-link')}<span>${esc(label)}</span></a>`).join('')}</div>`,
    actions: [{ label: t('common.close'), cls: 'primary', value: null }],
    onMount: d => {
      const msg = () => d.querySelector('.pm-msg').value.trim() || t('promo.msg');
      const copy = (s, el) => navigator.clipboard.writeText(s).then(() => { toast(t('common.copied')); pop(el, 'mo-pop'); }).catch(() => {});
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-pm]'); if (!b) return; const k = b.dataset.pm;
        if (k === 'link') { e.preventDefault(); copy(url, b); return; }
        if (k === 'all') { e.preventDefault(); copy(msg() + '\n' + url, b); return; }
        if (k === 'share') { e.preventDefault(); navigator.share({ title: 'Kept', text: msg(), url }).catch(() => {}); return; }
        const tg = targets.find(x => x[0] === k); if (tg) b.href = tg[2](msg()); // filled at click time so edits to the note are used
      });
    }
  });
}

export { promoDialog };
