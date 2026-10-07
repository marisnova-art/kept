/* Kept — Profile photo */
import { S, savePrefs } from '../data/store.js';
import { applyI18n, t } from '../lib/i18n.js';
import { esc } from '../lib/utils.js';
import { toast } from '../ui/feedback.js';
import { render, shell } from '../ui/shell.js';

/* ---------- Profile photo ---------- */
const validAvatar = v => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 60000;
function avatarHTML(cls = 'avatar') {
  const p = S.prefs; const ch = (p.displayName || S.user?.email || 'K')[0].toUpperCase();
  return validAvatar(p.avatar) ? `<img class="${cls} photo" src="${p.avatar}" alt="">` : `<span class="${cls}">${esc(ch)}</span>`;
}
function pickAvatar() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; if (f.size > 15e6) { toast(t('avatar.tooBig'), { error: true }); return; }
    try {
      const url = URL.createObjectURL(f); const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const N = 160, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      const m = Math.min(img.naturalWidth, img.naturalHeight); g.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, N, N);
      URL.revokeObjectURL(url);
      let q = .85, data = c.toDataURL('image/jpeg', q); while (data.length > 24000 && q > .4) { q -= .1; data = c.toDataURL('image/jpeg', q); }
      savePrefs({ avatar: data }); toast(t('avatar.saved')); shell(); applyI18n(); render();
    } catch { toast(t('avatar.fail'), { error: true }); }
  };
  inp.click();
}

export { avatarHTML, pickAvatar, validAvatar };
