// Kept 관리자 API — 관리자 페이지가 부르는 유일한 서버 창구
// Deploy:  supabase functions deploy admin-api            (JWT 검사 켜 둔 채로 배포: --no-verify-jwt 쓰지 마세요)
// Secrets: supabase secrets set ADMIN_ORIGIN=https://admin.example.com
//          (선택) PADDLE_API_KEY=pdl_… PADDLE_ENV=sandbox|production   → 관리자 페이지에서 구독 해지
// 흐름: 브라우저(관리자 로그인 토큰) → 이 함수 → 토큰 주인 확인 → admins 명단 확인 → service role로 조회/처리 → admin_audit 기록
// service role 키는 이 함수 안에만 있고, 브라우저로 나가지 않습니다.

type Env = { ADMIN_ORIGIN: string; PADDLE_API_KEY: string; PADDLE_ENV: string };
type Deps = { db: any; env: Env; fetch: typeof fetch };
type Admin = { id: string; email: string; role: 'owner' | 'staff' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 50;
class Fail extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

function cors(req: Request, env: Env) {
  const allowed = env.ADMIN_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? 'null'),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

async function whoIsAdmin(req: Request, db: any): Promise<Admin> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Fail(401, 'login required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new Fail(401, 'login required');
  const { data: row } = await db.from('admins').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!row) throw new Fail(403, 'not an admin');
  return { id: data.user.id, email: data.user.email ?? '', role: row.role };
}

const page = (p: unknown) => Math.max(0, Math.min(10000, Number(p) || 0));
const uid = (v: unknown) => { if (typeof v !== 'string' || !UUID.test(v)) throw new Fail(400, 'bad user id'); return v; };
const ownerOnly = (a: Admin) => { if (a.role !== 'owner') throw new Fail(403, 'owner only'); };
async function rpc(db: any, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Fail(500, error.message);
  return data;
}
async function audit(db: any, a: Admin, action: string, target: { id?: string; email?: string } = {}, detail: Record<string, unknown> = {}) {
  await db.from('admin_audit').insert({ admin_id: a.id, admin_email: a.email, action, target_user: target.id ?? null, target_email: target.email ?? null, detail });
}
async function targetUser(db: any, id: string) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data?.user) throw new Fail(404, 'user not found');
  return data.user;
}

async function act(a: Admin, body: any, { db, env, fetch }: Deps) {
  switch (body.action) {
    case 'me':
      return { email: a.email, role: a.role, paddle: !!env.PADDLE_API_KEY, paddleEnv: env.PADDLE_ENV || 'sandbox' };

    case 'stats':
      return rpc(db, 'admin_stats');

    case 'users': {
      const filter = ['all', 'paying', 'past_due', 'banned', 'admins'].includes(body.filter) ? body.filter : 'all';
      const rows = await rpc(db, 'admin_users', { q: String(body.q ?? '').trim().slice(0, 200), filter, lim: PAGE, off: page(body.page) * PAGE });
      return { rows, total: rows[0]?.total ?? 0, pageSize: PAGE };
    }

    case 'user':
      return (await rpc(db, 'admin_user', { uid: uid(body.id) })) ?? (() => { throw new Fail(404, 'user not found'); })();

    case 'subscriptions': {
      const st = ['all', 'active', 'trialing', 'past_due', 'paused', 'canceled', 'canceling'].includes(body.status) ? body.status : 'all';
      const rows = await rpc(db, 'admin_subscriptions', { st, lim: PAGE, off: page(body.page) * PAGE });
      return { rows, total: rows[0]?.total ?? 0, pageSize: PAGE };
    }

    case 'audit': {
      const { data, error } = await db.from('admin_audit').select('*').order('at', { ascending: false }).range(page(body.page) * PAGE, page(body.page) * PAGE + PAGE - 1);
      if (error) throw new Fail(500, error.message);
      return { rows: data, pageSize: PAGE };
    }

    case 'ban':
    case 'unban': {
      const id = uid(body.id);
      if (id === a.id) throw new Fail(400, 'cannot change your own account');
      const { data: isAdmin } = await db.from('admins').select('user_id').eq('user_id', id).maybeSingle();
      if (isAdmin) throw new Fail(400, 'remove admin role first');
      const u = await targetUser(db, id);
      const reason = String(body.reason ?? '').slice(0, 500);
      const { error } = await db.auth.admin.updateUserById(id, { ban_duration: body.action === 'ban' ? '876000h' : 'none' });
      if (error) throw new Fail(500, error.message);
      await audit(db, a, body.action, u, reason ? { reason } : {});
      return { ok: true };
    }

    case 'delete_user': {
      ownerOnly(a);
      const id = uid(body.id);
      if (id === a.id) throw new Fail(400, 'cannot delete your own account');
      const u = await targetUser(db, id);
      if (String(body.confirm_email ?? '').trim().toLowerCase() !== String(u.email ?? '').toLowerCase()) throw new Fail(400, 'email does not match');
      const { data: live } = await db.from('subscriptions').select('subscription_id').eq('user_id', id).in('status', ['active', 'trialing', 'past_due', 'paused']).is('cancel_at', null);
      if (live?.length) throw new Fail(409, 'cancel the subscription first');
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) throw new Fail(500, error.message);
      await audit(db, a, 'delete_user', u, { reason: String(body.reason ?? '').slice(0, 500) });
      return { ok: true };
    }

    case 'cancel_subscription': {
      ownerOnly(a);
      if (!env.PADDLE_API_KEY) throw new Fail(400, 'PADDLE_API_KEY not set');
      const sid = String(body.subscription_id ?? '');
      if (!/^sub_[a-z0-9]+$/i.test(sid)) throw new Fail(400, 'bad subscription id');
      const when = body.when === 'immediately' ? 'immediately' : 'next_billing_period';
      const { data: sub } = await db.from('subscriptions').select('user_id').eq('subscription_id', sid).maybeSingle();
      if (!sub) throw new Fail(404, 'subscription not found');
      const base = env.PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
      const r = await fetch(`${base}/subscriptions/${sid}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ effective_from: when })
      });
      if (!r.ok) throw new Fail(502, `paddle ${r.status}: ${(await r.text()).slice(0, 200)}`);
      // 상태 반영은 paddle-webhook이 합니다(subscription.updated / canceled)
      const { data: u } = sub.user_id ? await db.auth.admin.getUserById(sub.user_id) : { data: null };
      await audit(db, a, 'cancel_subscription', { id: sub.user_id ?? undefined, email: u?.user?.email }, { subscription_id: sid, when, reason: String(body.reason ?? '').slice(0, 500) });
      return { ok: true };
    }

    default:
      throw new Fail(400, 'unknown action');
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const h = cors(req, deps.env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  try {
    const a = await whoIsAdmin(req, deps.db);
    let body: any; try { body = await req.json(); } catch { throw new Fail(400, 'bad json'); }
    return json(200, await act(a, body ?? {}, deps));
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'server error' });
  }
}

// @ts-ignore Deno globals
if (typeof Deno !== 'undefined' && import.meta.main) {
  // @ts-ignore Deno globals
  const env = (k: string) => Deno.env.get(k) ?? '';
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const deps: Deps = { db, fetch, env: { ADMIN_ORIGIN: env('ADMIN_ORIGIN'), PADDLE_API_KEY: env('PADDLE_API_KEY'), PADDLE_ENV: env('PADDLE_ENV') } };
  // @ts-ignore Deno globals
  Deno.serve(req => handle(req, deps));
}
