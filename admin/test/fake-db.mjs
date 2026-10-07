// supabase-js(service role) 흉내 — admin-api가 쓰는 만큼만, PGlite 위에서 동작
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const R = p => readFileSync(new URL(p, import.meta.url), 'utf8');

export async function makeDb() {
  const pg = new PGlite();
  await pg.exec(R('../../tools/sql-test/v1-mock.sql'));
  await pg.exec(`alter table auth.users add column created_at timestamptz default now(), add column last_sign_in_at timestamptz,
    add column email_confirmed_at timestamptz, add column banned_until timestamptz;
    create role service_role; grant usage on schema public, auth to service_role;`);
  for (const f of ['../../v2/supabase/v2-shared-folders.sql', '../../v2/supabase/v2-subscriptions.sql', '../supabase/admin.sql']) { await pg.exec(R(f)); await pg.exec(R(f)); }
  return pg;
}

const q = (pg, sql, params) => pg.query(sql, params).then(r => r.rows);
const ident = s => { if (!/^[a-z_]+$/.test(s)) throw new Error('bad ident ' + s); return s; };

class Query {
  constructor(pg, table) { Object.assign(this, { pg, table, where: [], params: [], cols: '*', ord: '', lim: '', op: 'select' }); }
  select(c = '*') { this.cols = c === '*' ? '*' : c.split(',').map(x => ident(x.trim())).join(','); return this; }
  eq(c, v) { this.params.push(v); this.where.push(`${ident(c)} = $${this.params.length}`); return this; }
  in(c, a) { this.params.push(a); this.where.push(`${ident(c)} = any($${this.params.length})`); return this; }
  is(c, v) { if (v !== null) throw new Error('is only null'); this.where.push(`${ident(c)} is null`); return this; }
  order(c, o = {}) { this.ord = ` order by ${ident(c)} ${o.ascending === false ? 'desc' : 'asc'}`; return this; }
  range(a, b) { this.lim = ` limit ${b - a + 1} offset ${a}`; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  maybeSingle() { this.single = true; return this; }
  async run() {
    try {
      if (this.op === 'insert') {
        const k = Object.keys(this.row).map(ident);
        await q(this.pg, `insert into public.${ident(this.table)} (${k}) values (${k.map((_, i) => '$' + (i + 1))})`, k.map(x => this.row[x]));
        return { data: null, error: null };
      }
      const rows = await q(this.pg, `select ${this.cols} from public.${ident(this.table)}${this.where.length ? ' where ' + this.where.join(' and ') : ''}${this.ord}${this.lim}`, this.params);
      return { data: this.single ? rows[0] ?? null : rows, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  }
  then(res, rej) { return this.run().then(res, rej); }
}

export function serviceClient(pg) {
  const user = async id => (await q(pg, 'select id, email from auth.users where id = $1', [id]))[0];
  return {
    from: t => new Query(pg, t),
    async rpc(fn, args = {}) {
      try {
        const k = Object.keys(args);
        const rows = await q(pg, `select * from public.${ident(fn)}(${k.map((x, i) => `${ident(x)} => $${i + 1}`)})`, k.map(x => args[x]));
        const scalar = rows.length === 1 && Object.keys(rows[0]).length === 1 && fn in rows[0];
        return { data: scalar ? rows[0][fn] : rows, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    auth: {
      async getUser(token) { const u = token.startsWith('tok-') && await user(token.slice(4)); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } }; },
      admin: {
        async getUserById(id) { const u = await user(id); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'not found' } }; },
        async updateUserById(id, { ban_duration }) {
          await q(pg, `update auth.users set banned_until = case when $2 = 'none' then null else now() + $2::interval end where id = $1`, [id, ban_duration === 'none' ? 'none' : ban_duration.replace('h', ' hours')]);
          return { data: {}, error: null };
        },
        async deleteUser(id) { await q(pg, 'delete from auth.users where id = $1', [id]); return { data: {}, error: null }; }
      }
    }
  };
}
