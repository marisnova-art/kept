/* Kept — Shared folders: folders shared with family, friends or a team.
   A record is private unless it is put in a shared folder (entries.folder_id; private is the default).
   Needs supabase/v2-shared-folders.sql on the server. Without it the app hides sharing and works as before. */
import { S, emit, saveEntries } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { t } from '../lib/i18n.js';
import { toast } from '../ui/feedback.js';

const MISSING = /PGRST20[25]|42P01|42883|does not exist|Could not find/i;
const ROLES = ['editor', 'viewer'];

const Share = {
  sb: null,
  supported: null, // null: not checked yet · true/false: the server has (or lacks) the shared-folder tables
  probed: false, changed: false, sig: '',
  folders: [],     // my active folders: { id, name, color, owner_id, role, members: [{ email, user_id, role, status }] }
  invites: [],     // invites for my email: { folder_id, name, color, role, invited_by_email }
  known: [],       // folder ids whose records were already fetched in full

  me: () => S.user?.id || null,
  myEmail: () => (S.user?.email || '').toLowerCase(),
  available() { return S.mode === 'cloud' && this.supported === true; },
  folder(id) { return id ? this.folders.find(f => f.id === id) || null : null; },
  roleOf(fid) { return this.folder(fid)?.role || null; },
  isMine(e) { return !e.owner || !S.user || e.owner === S.user.id; },
  /* viewers read; owners and editors write. Your own records are always yours to edit. */
  canEdit(e) { return !e.folder_id || this.isMine(e) || ['owner', 'editor'].includes(this.roleOf(e.folder_id)); },
  writable() { return this.folders.filter(f => f.role !== 'viewer'); },
  authorOf(e) {
    if (this.isMine(e)) return null;
    for (const f of this.folders) { const m = f.members.find(x => x.user_id === e.owner); if (m) return m.email; }
    return '';
  },

  async restore() {
    const s = S.db ? await S.db.get('share', null) : null;
    Object.assign(this, { supported: s?.supported ?? null, folders: s?.folders || [], invites: s?.invites || [], known: s?.known || [], probed: false });
  },
  persist() { return S.db?.set('share', { supported: this.supported, folders: this.folders, invites: this.invites, known: this.known }); },

  /* called at the start of every sync; returns folders that are new to this device */
  async load(sb) {
    this.sb = sb;
    if (!this.probed) {
      const { error } = await sb.from('folders').select('id').limit(1);
      if (error && !MISSING.test(`${error.code} ${error.message}`)) throw error;
      this.supported = !error; this.probed = true;
    }
    if (!this.supported) { this.changed = !!(this.folders.length || this.invites.length); this.folders = []; this.invites = []; return []; }
    const [fr, mr, ir] = await Promise.all([
      sb.from('folders').select('id,name,color,owner_id,updated_at'),
      sb.from('folder_members').select('folder_id,email,user_id,role,status'),
      sb.rpc('my_folder_invites')
    ]);
    const err = fr.error || mr.error || ir.error; if (err) throw err;
    const me = this.me(); const mine = mr.data.filter(m => m.user_id === me && m.status === 'active');
    this.folders = fr.data.filter(f => mine.some(m => m.folder_id === f.id))
      .map(f => ({ ...f, role: mine.find(m => m.folder_id === f.id).role, members: mr.data.filter(m => m.folder_id === f.id).sort((a, b) => (b.role === 'owner') - (a.role === 'owner') || a.email.localeCompare(b.email)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.invites = ir.data || [];
    const sig = JSON.stringify([this.folders, this.invites]); this.changed = sig !== this.sig; this.sig = sig;
    return this.folders.map(f => f.id).filter(id => !this.known.includes(id));
  },

  /* ---------- actions (online only; each ends with a sync so every list catches up) ---------- */
  async call(fn) {
    if (!this.available() || !this.sb) { toast(t('share.needCloud'), { error: true }); return false; }
    if (!navigator.onLine) { toast(t('share.offline'), { error: true }); return false; }
    try { const r = await fn(this.sb); await Sync.run(); emit('share'); return r ?? true; }
    catch (e) { console.warn('share', e); toast(/limit/i.test(e.message || '') ? t('share.limit') : t('err.server', { m: e.message || String(e) }), { error: true }); return false; }
  },
  must: ({ data, error }) => { if (error) throw error; return data; },
  create(name, color) { return this.call(async sb => this.must(await sb.from('folders').insert({ name: name.slice(0, 60), color }).select('id').single()).id); },
  rename(fid, name) { return this.call(async sb => this.must(await sb.from('folders').update({ name: name.slice(0, 60) }).eq('id', fid).select('id'))); },
  invite(fid, email, role = 'editor') {
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast(t('share.badEmail'), { error: true }); return false; }
    if (this.folder(fid)?.members.some(m => m.email === email)) { toast(t('share.already'), { error: true }); return false; }
    return this.call(async sb => this.must(await sb.from('folder_members').insert({ folder_id: fid, email, role: ROLES.includes(role) ? role : 'editor' })));
  },
  setRole(fid, email, role) { return this.call(async sb => this.must(await sb.from('folder_members').update({ role }).eq('folder_id', fid).eq('email', email).select('email'))); },
  removeMember(fid, email) { return this.call(async sb => this.must(await sb.from('folder_members').delete().eq('folder_id', fid).eq('email', email))); },
  accept(fid) { return this.call(async sb => this.must(await sb.rpc('accept_folder_invite', { f: fid }))); },
  decline(fid) { return this.call(async sb => this.must(await sb.from('folder_members').delete().eq('folder_id', fid).eq('email', this.myEmail()))); },
  /* leaving takes your own records back to private, then drops your membership */
  async leave(fid) {
    await this.unshareMine(fid);
    return this.call(async sb => this.must(await sb.from('folder_members').delete().eq('folder_id', fid).eq('user_id', this.me())));
  },
  /* deleting a folder keeps every record; the server turns them private (on delete set null) */
  async remove(fid) {
    await this.unshareMine(fid);
    return this.call(async sb => this.must(await sb.from('folders').delete().eq('id', fid)));
  },
  async unshareMine(fid) {
    const mine = [...S.entries.values()].filter(e => e.folder_id === fid && this.isMine(e));
    mine.forEach(e => { e.folder_id = null; }); if (mine.length) await saveEntries(mine);
  }
};

export { Share };
