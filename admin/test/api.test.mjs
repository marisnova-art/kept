// admin.sql 권한 + admin-api 동작 검사.  node api.test.mjs
import { makeDb, serviceClient } from './fake-db.mjs';
import { handle } from '../supabase/functions/admin-api/index.ts';

const pg = await makeDb(), db = serviceClient(pg);
const U = { ann: 'aaaaaaaa-0000-4000-8000-000000000001', bob: 'bbbbbbbb-0000-4000-8000-000000000002', cat: 'cccccccc-0000-4000-8000-000000000003', dan: 'dddddddd-0000-4000-8000-000000000004' };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const asRole = async (role, sql) => pg.transaction(async tx => { await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U.bob]); await tx.exec(`set local role ${role}`); return (await tx.query(sql)).rows; });
const denied = async (p, m) => { try { await p; ok(false, m); } catch (e) { ok(/permission denied/.test(e.message), m + ' → ' + e.message.slice(0, 50)); } };

// seed: ann = owner admin, cat = staff admin, bob = paying user, dan = free user
await pg.exec(`insert into admins(user_id, role) values ('${U.ann}', 'owner'), ('${U.cat}', 'staff');
  update auth.users set last_sign_in_at = now() - interval '1 day', email_confirmed_at = now() where email in ('ann@x.com','bob@x.com');
  update auth.users set created_at = now() - interval '60 days' where email = 'dan@x.com';
  insert into subscriptions(subscription_id, user_id, status, plan, current_period_end) values ('sub_01bob', '${U.bob}', 'active', 'yearly', now() + interval '300 days');
  insert into subscriptions(subscription_id, user_id, status, plan) values ('sub_01old', '${U.dan}', 'canceled', 'monthly');`);
await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [U.bob]);
await pg.exec(`insert into entries(id, type, title, content) values ('11111111-0000-4000-8000-000000000001', 'note', '비밀 제목', '비밀 본문'), ('11111111-0000-4000-8000-000000000002', 'note', 'x', 'y')`);
await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);

// --- SQL 권한 ---
await denied(asRole('authenticated', 'select public.admin_stats()'), 'logged-in user cannot call admin_stats');
await denied(asRole('anon', `select * from public.admin_users()`), 'anon cannot call admin_users');
await denied(asRole('authenticated', 'select * from public.admins'), 'logged-in user cannot read admins');
await denied(asRole('authenticated', `insert into public.admins(user_id, role) values ('${U.bob}', 'owner')`), 'user cannot make self admin');
await denied(asRole('authenticated', 'select * from public.admin_audit'), 'user cannot read audit');
ok((await asRole('service_role', 'select public.admin_stats() s'))[0].s.users === 4, 'service role can call admin_stats');

// --- API ---
const call = async (who, body, init = {}) => {
  const r = await handle(new Request('https://x/functions/v1/admin-api', { method: 'POST', headers: { origin: 'https://admin.kept.app', ...(who ? { authorization: 'Bearer tok-' + U[who] } : {}) }, body: JSON.stringify(body), ...init }),
    { db, fetch: init.fetch ?? (async () => new Response('{}')), env: { ADMIN_ORIGIN: 'https://admin.kept.app', PADDLE_API_KEY: init.key ?? '', PADDLE_ENV: 'sandbox' } });
  return { status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
};
ok((await call(null, { action: 'stats' })).status === 401, 'no token → 401');
ok((await call('bob', { action: 'stats' })).status === 403, 'non-admin → 403');
const me = await call('cat', { action: 'me' });
ok(me.status === 200 && me.body.role === 'staff' && me.cors === 'https://admin.kept.app', 'staff admin: me + CORS origin');
const st = (await call('ann', { action: 'stats' })).body;
ok(st.users === 4 && st.new_30d === 3 && st.active_7d === 2 && st.entries === 2 && st.paying.yearly === 1 && st.subs_by_status.canceled === 1, 'stats numbers: ' + JSON.stringify({ u: st.users, n: st.new_30d, a: st.active_7d, e: st.entries, p: st.paying }));
const us = (await call('ann', { action: 'users', q: 'bo' })).body;
ok(us.total === 1 && us.rows[0].email === 'bob@x.com' && us.rows[0].entries === 2 && us.rows[0].sub_status === 'active', 'search users by email');
ok((await call('ann', { action: 'users', filter: 'admins' })).body.total === 2, 'filter admins');
ok((await call('ann', { action: 'users', q: '%' })).body.total === 0, 'search escapes %');
const bob = (await call('cat', { action: 'user', id: U.bob })).body;
ok(bob.entries === 2 && bob.subscriptions.length === 1 && !('update_payment_url' in bob.subscriptions[0]), 'user detail (counts, subscription)');
ok(!JSON.stringify(bob).includes('비밀'), 'user detail never contains record text');
ok((await call('ann', { action: 'user', id: 'nope' })).status === 400, 'bad id → 400');

// ban / unban
ok((await call('cat', { action: 'ban', id: U.ann })).status === 400, 'cannot ban an admin');
ok((await call('ann', { action: 'ban', id: U.ann })).status === 400, 'cannot ban self');
ok((await call('cat', { action: 'ban', id: U.dan, reason: '스팸' })).status === 200, 'staff can ban user');
ok((await call('ann', { action: 'users', filter: 'banned' })).body.rows[0]?.email === 'dan@x.com', 'banned filter shows dan');
ok((await call('ann', { action: 'unban', id: U.dan })).status === 200, 'unban');
ok((await call('ann', { action: 'stats' })).body.banned === 0, 'no one banned after unban');

// delete
ok((await call('cat', { action: 'delete_user', id: U.dan, confirm_email: 'dan@x.com' })).status === 403, 'staff cannot delete');
ok((await call('ann', { action: 'delete_user', id: U.dan, confirm_email: 'x@x.com' })).status === 400, 'delete needs matching email');
ok((await call('ann', { action: 'delete_user', id: U.bob, confirm_email: 'bob@x.com' })).body.error === 'cancel the subscription first', 'live subscription blocks delete');
ok((await call('ann', { action: 'delete_user', id: U.dan, confirm_email: 'DAN@x.com ', reason: '본인 요청' })).status === 200, 'owner deletes user');
ok((await call('ann', { action: 'stats' })).body.users === 3, 'user gone');

// cancel subscription via Paddle
ok((await call('ann', { action: 'cancel_subscription', subscription_id: 'sub_01bob' })).body.error === 'PADDLE_API_KEY not set', 'cancel needs Paddle key');
ok((await call('cat', { action: 'cancel_subscription', subscription_id: 'sub_01bob' }, { key: 'k' })).status === 403, 'staff cannot cancel');
let sent;
const r = await call('ann', { action: 'cancel_subscription', subscription_id: 'sub_01bob', reason: '요청' }, { key: 'pdl_test', fetch: async (url, init) => { sent = { url, init }; return new Response('{}', { status: 200 }); } });
ok(r.status === 200 && sent.url === 'https://sandbox-api.paddle.com/subscriptions/sub_01bob/cancel' && JSON.parse(sent.init.body).effective_from === 'next_billing_period' && sent.init.headers.Authorization === 'Bearer pdl_test', 'cancel calls Paddle sandbox');
ok((await call('ann', { action: 'cancel_subscription', subscription_id: 'sub_01bob' }, { key: 'k', fetch: async () => new Response('nope', { status: 404 }) })).status === 502, 'Paddle error surfaces as 502');

// audit
const au = (await call('cat', { action: 'audit' })).body.rows.map(a => a.action);
ok(au.join() === 'cancel_subscription,delete_user,unban,ban', 'audit log: ' + au.join());
ok((await call('ann', { action: 'nope' })).status === 400, 'unknown action → 400');
ok((await handle(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://evil.com' } }), { db, fetch, env: { ADMIN_ORIGIN: 'https://admin.kept.app', PADDLE_API_KEY: '', PADDLE_ENV: '' } })).headers.get('access-control-allow-origin') === 'https://admin.kept.app', 'CORS does not echo other origins');

console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
