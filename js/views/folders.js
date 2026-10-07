/* Kept — Shared folders: the folder list, one folder's records, members and invites */
import { CAT_COLORS, S, live } from '../data/store.js';
import { byDay, sortEntries } from '../features/search.js';
import { Share } from '../features/share.js';
import { fmtNum, t, tn } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { confirmDlg, dialog, promptDlg, toast } from '../ui/feedback.js';
import { emptyState, entryList, header, listControls } from '../ui/entries.js';
import { go } from '../ui/router.js';

const initial = s => esc((s || '?').trim().charAt(0).toUpperCase());
const faces = (f, max = 4) => `<span class="fm-faces">${f.members.filter(m => m.status === 'active').slice(0, max).map(m => `<i title="${esc(m.email)}">${initial(m.email)}</i>`).join('')}</span>`;
const roleLabel = r => t('share.role.' + r);

/* why sharing is not available yet, if it is not */
function gate() {
  if (S.mode !== 'cloud') return `<div class="note fl-note">${icon('users')}<span style="flex:1">${esc(t('share.needCloud'))}</span><button class="btn sm primary" data-act="signIn">${esc(t('auth.signIn'))}</button></div>`;
  if (Share.supported === false) return `<div class="note fl-note">${icon('info')}<span style="flex:1">${esc(t('share.needServer'))}</span></div>`;
  return '';
}

function viewFolders() {
  const g = gate();
  const inv = Share.invites.map(i => `<div class="fl-inv"><span class="fl-ic" style="${i.color ? `--fc:${esc(i.color)}` : ''}">${icon('users')}</span>
      <div class="fl-mid"><b>${esc(i.name)}</b><span>${esc(i.invited_by_email ? t('share.invitedBy', { who: i.invited_by_email }) : t('share.invited'))} · ${esc(roleLabel(i.role))}</span></div>
      <button class="btn sm ghost" data-act="folderDecline" data-id="${i.folder_id}">${esc(t('share.decline'))}</button><button class="btn sm primary" data-act="folderAccept" data-id="${i.folder_id}" data-name="${esc(i.name)}">${esc(t('share.accept'))}</button></div>`).join('');
  const cards = Share.folders.map(f => { const n = live().filter(e => e.folder_id === f.id).length;
    return `<a class="fl-card" href="#/folder/${f.id}" style="${f.color ? `--fc:${esc(f.color)}` : ''}"><span class="fl-ic">${icon('users')}</span>
      <div class="fl-mid"><b>${esc(f.name)}</b><span>${esc(tn('share.records', n))} · ${esc(roleLabel(f.role))}</span></div>${faces(f)}</a>`; }).join('');
  return `<div class="wrap view-enter" style="max-width:900px">${header(esc(t('nav.shared')), esc(t('share.sub')), Share.available() ? `<div class="ph-actions"><button class="btn primary" data-act="folderNew">${icon('plus')}<span>${esc(t('share.new'))}</span></button></div>` : '')}
    ${g}
    ${inv ? `<h3 class="dgrp">${esc(t('share.invites'))}<span class="c">${fmtNum(Share.invites.length)}</span></h3><div class="fl-list">${inv}</div>` : ''}
    ${cards ? `<div class="fl-list">${cards}</div>` : !g ? `<div class="empty"><div class="orb"></div><div class="big">${esc(t('share.emptyTitle'))}</div><div>${esc(t('share.emptySub'))}</div><div style="margin-top:20px"><button class="btn primary" data-act="folderNew">${icon('plus')}<span>${esc(t('share.new'))}</span></button></div></div>` : ''}
    <p class="fl-how">${icon('lock')}<span>${esc(t('share.how'))}</span></p></div>`;
}

function viewFolder(id) {
  const f = Share.folder(id);
  if (!f) return `<div class="wrap view-enter">${header(esc(t('nav.shared')), '')}${gate()}${emptyState(t('share.noFolder'), t('share.noFolderSub'))}</div>`;
  const list = sortEntries(live().filter(e => e.folder_id === id));
  const actions = `<div class="ph-actions"><button class="btn sm fm-open" data-act="folderManage" data-id="${f.id}">${faces(f, 3)}<span>${esc(t('share.members'))}</span></button>${listControls().replace('<div class="ph-actions">', '').replace(/<\/div>\s*$/, '')}</div>`;
  const sub = `${esc(tn('share.membersN', f.members.filter(m => m.status === 'active').length))} · ${esc(roleLabel(f.role))}`;
  const canAdd = f.role !== 'viewer';
  return `<div class="wrap view-enter">${header(`<span style="color:${esc(f.color || 'inherit')}">●</span> ${esc(f.name)} <span class="mut">${fmtNum(list.length)}</span>`, sub, actions)}
    ${entryList(list, { grouped: byDay(), empty: `<div class="empty"><div class="orb"></div><div class="big">${esc(t('share.folderEmpty'))}</div><div>${esc(t(canAdd ? 'share.folderEmptySub' : 'share.folderEmptyView'))}</div>${canAdd ? `<div style="margin-top:20px"><button class="btn primary" data-act="new" data-folder="${f.id}">${icon('plus')}<span>${esc(t('common.newRecord'))}</span></button></div>` : ''}</div>` })}</div>`;
}

/* ---------- dialogs ---------- */
async function newFolder() {
  if (!Share.available()) { go('folders'); toast(S.mode !== 'cloud' ? t('share.needCloud') : t('share.needServer'), { error: true }); return null; }
  const name = await promptDlg(t('share.new'), '', t('share.namePh'), t('share.newSub')); if (!name) return null;
  const id = await Share.create(name, CAT_COLORS[(Share.folders.length + 5) % CAT_COLORS.length]);
  if (id) { toast(t('share.created')); go('folder/' + id); setTimeout(() => manageFolder(id), 250); }
  return id || null;
}

function membersHTML(f) {
  const owner = f.role === 'owner'; const me = Share.myEmail();
  const rows = f.members.map(m => `<div class="fm-row"><i class="fm-av">${initial(m.email)}</i><div class="fm-mid"><b>${esc(m.email)}${m.email === me ? ` <small>${esc(t('share.you'))}</small>` : ''}</b>${m.status === 'invited' ? `<span class="fm-pend">${esc(t('share.pending'))}</span>` : ''}</div>
    ${owner && m.role !== 'owner' ? `<select class="select sm" data-fm-role="${esc(m.email)}" aria-label="${esc(t('share.roleH'))}">${['editor', 'viewer'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select>
      <button class="icon-btn" data-fm-rm="${esc(m.email)}" aria-label="${esc(t('share.remove'))}">${icon('x')}</button>` : `<span class="fm-role">${esc(roleLabel(m.role))}</span>`}</div>`).join('');
  const invite = owner ? `<form class="fm-inv" autocomplete="off"><input class="input" type="email" name="em" placeholder="${esc(t('share.invitePh'))}" aria-label="${esc(t('share.invitePh'))}" required>
      <select class="select" name="role" aria-label="${esc(t('share.roleH'))}"><option value="editor">${esc(roleLabel('editor'))}</option><option value="viewer">${esc(roleLabel('viewer'))}</option></select>
      <button class="btn primary" type="submit">${icon('user-plus')}<span>${esc(t('share.invite'))}</span></button></form><p class="fm-hint">${esc(t('share.inviteHint'))}</p>` : '';
  return `${owner ? `<div class="fm-name"><input class="input" name="fname" maxlength="60" value="${esc(f.name)}" aria-label="${esc(t('share.rename'))}"></div>` : ''}
    ${invite}<div class="fm-list">${rows}</div>
    <div class="fm-foot">${owner ? `<button class="btn sm ghost danger" data-fm="delete">${icon('trash-2')}<span>${esc(t('share.delete'))}</span></button>` : `<button class="btn sm ghost danger" data-fm="leave">${icon('log-out')}<span>${esc(t('share.leave'))}</span></button>`}</div>`;
}

function manageFolder(id) {
  const f0 = Share.folder(id); if (!f0) return;
  return dialog({ title: f0.name, wide: true, html: `<div class="fm-body">${membersHTML(f0)}</div>`, actions: [{ label: t('common.close'), cls: 'primary', value: null }],
    onMount: (d, done) => {
      const body = d.querySelector('.fm-body');
      const refresh = () => { const f = Share.folder(id); if (!f) return done(null); body.innerHTML = membersHTML(f); d.querySelector('h2').textContent = f.name; };
      const busy = async (el, p) => { el && (el.disabled = true); body.classList.add('busy'); const r = await p; body.classList.remove('busy'); refresh(); return r; };
      body.addEventListener('submit', async e => {
        e.preventDefault(); const fm = e.target; const email = fm.em.value.trim();
        if (await busy(fm.querySelector('button'), Share.invite(id, email, fm.role.value))) { toast(t('share.invitedOk', { email })); offerNote(Share.folder(id), email); }
      });
      body.addEventListener('change', e => { const em = e.target.dataset.fmRole; if (em) busy(e.target, Share.setRole(id, em, e.target.value)); });
      body.addEventListener('focusout', e => { if (e.target.name !== 'fname') return; const v = e.target.value.trim(); const f = Share.folder(id); if (v && f && v !== f.name) busy(null, Share.rename(id, v)); else if (f) e.target.value = f.name; });
      body.addEventListener('keydown', e => { if (e.target.name === 'fname' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
      body.addEventListener('click', async e => {
        const rm = e.target.closest('[data-fm-rm]'); const act = e.target.closest('[data-fm]')?.dataset.fm; const f = Share.folder(id); if (!f) return;
        if (rm) { if (await confirmDlg(t('share.removeQ', { who: rm.dataset.fmRm }), t('share.removeSub'), t('share.remove'), true)) { await Share.removeMember(id, rm.dataset.fmRm); manageFolder(id); } else manageFolder(id); }
        if (act === 'leave' && await confirmDlg(t('share.leaveQ', { name: f.name }), t('share.leaveSub'), t('share.leave'), true)) { if (await Share.leave(id)) { toast(t('share.left')); go('folders'); } }
        else if (act === 'leave') manageFolder(id);
        if (act === 'delete' && await confirmDlg(t('share.deleteQ', { name: f.name }), t('share.deleteSub'), t('share.delete'), true)) { if (await Share.remove(id)) { toast(t('share.deleted')); go('folders'); } }
        else if (act === 'delete') manageFolder(id);
      });
    } });
}

/* nothing is emailed by the app: hand the owner a ready note to send however they like */
function offerNote(f, email) {
  if (!f) return;
  const url = location.origin + location.pathname + '#/folders';
  const text = t('share.inviteMsg', { name: f.name, url, email });
  dialog({ title: t('share.noteTitle'), body: t('share.noteSub'), html: `<textarea class="input fm-note" rows="4" readonly>${esc(text)}</textarea>`,
    actions: [{ label: t('common.close'), cls: 'ghost', value: null },
      ...(navigator.share ? [{ label: t('share.send'), cls: 'ghost', run: () => navigator.share({ text }).catch(() => {}) }] : []),
      { label: t('common.copy'), cls: 'primary', run: () => navigator.clipboard.writeText(text).then(() => toast(t('common.copied'))).catch(() => {}) }] })
    .then(() => manageFolder(f.id));
}

async function acceptInvite(id, name) { if (await Share.accept(id)) { toast(t('share.accepted', { name })); go('folder/' + id); } }
async function declineInvite(id) { if (await confirmDlg(t('share.declineQ'), '', t('share.decline'), true)) await Share.decline(id); }

export { acceptInvite, declineInvite, manageFolder, newFolder, viewFolder, viewFolders };
