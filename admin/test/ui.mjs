// 관리자 화면을 실제 브라우저로 띄워 확인 (Supabase 로그인과 admin-api는 PGlite로 흉내).  node ui.mjs [스크린샷 폴더]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeDb, serviceClient } from './fake-db.mjs';
import { handle } from '../supabase/functions/admin-api/index.ts';

const out = process.argv[2] || '.';
const pg = await makeDb(), db = serviceClient(pg);
const ANN = 'aaaaaaaa-0000-4000-8000-000000000001', BOB = 'bbbbbbbb-0000-4000-8000-000000000002';
await pg.exec(`insert into admins values ('${ANN}', 'owner');
  insert into auth.users(id, email, created_at, last_sign_in_at) select gen_random_uuid(), 'user' || i || '@example.com', now() - (i || ' days')::interval * 0.4, now() - (i || ' hours')::interval * 3 from generate_series(1, 64) i;
  update auth.users set last_sign_in_at = now() - interval '2 hours', email_confirmed_at = now() where id = '${BOB}';
  insert into subscriptions(subscription_id, user_id, customer_id, status, plan, currency, current_period_end) values
    ('sub_01bob', '${BOB}', 'ctm_01bob', 'active', 'yearly', 'USD', now() + interval '300 days');
  insert into subscriptions(subscription_id, user_id, status, plan, currency, current_period_end, cancel_at)
    select 'sub_0' || i, id, case when i % 7 = 0 then 'past_due' when i % 5 = 0 then 'canceled' else 'active' end, case when i % 3 = 0 then 'yearly' else 'monthly' end, 'USD', now() + interval '20 days', case when i % 4 = 0 then now() + interval '20 days' end
    from (select id, row_number() over (order by email) i from auth.users where email like 'user%') u where i <= 18;`);
await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [BOB]);
await pg.exec(`insert into entries(id, type, title) select gen_random_uuid(), 'note', 't' from generate_series(1, 37)`);

const FAKE_SB = `window.supabase = { createClient: () => { let s = JSON.parse(localStorage.getItem('fake.sess') || 'null'); return { auth: {
  getSession: async () => ({ data: { session: s } }),
  signInWithPassword: async ({ email, password }) => email === 'ann@x.com' && password === 'pw' ? (s = { access_token: 'tok-${ANN}' }, localStorage.setItem('fake.sess', JSON.stringify(s)), { data: {}, error: null }) :
    email === 'bob@x.com' ? (s = { access_token: 'tok-${BOB}' }, localStorage.setItem('fake.sess', JSON.stringify(s)), { data: {}, error: null }) : { error: { message: 'bad' } },
  signOut: async () => { s = null; localStorage.removeItem('fake.sess'); } } } } };`;
const site = new URL('../site/', import.meta.url);
const errors = [];
const browser = await chromium.launch();
async function page(viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', colorScheme: 'dark' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    // 글꼴은 실제로 받아 와야 화면 비교가 의미 있음 (curl은 프록시 설정을 따름)
    if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
      try { const body = execFileSync('curl', ['-sSL', '-A', 'Mozilla/5.0 Chrome/120', u.href], { maxBuffer: 1 << 26 }); return route.fulfill({ body, contentType: u.hostname === 'fonts.gstatic.com' ? 'font/woff2' : 'text/css', headers: { 'access-control-allow-origin': '*' } }); }
      catch { return route.abort(); }
    }
    if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ body: FAKE_SB, contentType: 'text/javascript' });
    if (u.pathname === '/functions/v1/admin-api') {
      const req = route.request();
      const r = await handle(new Request(u, { method: req.method(), headers: req.headers(), body: req.method() === 'POST' ? req.postData() : undefined }),
        { db, fetch: async () => new Response('{}'), env: { ADMIN_ORIGIN: 'http://admin.test', PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' } });
      return route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: await r.text() });
    }
    if (u.hostname === 'admin.test') {
      const f = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
      let body = readFileSync(new URL(f, site), 'utf8');
      if (f === 'config.js') body = body.replace(/SUPABASE_URL: "[^"]*"/, 'SUPABASE_URL: "https://fake.supabase.co"');
      return route.fulfill({ body, contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    }
    return route.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  return p;
}
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const p = await page({ width: 1440, height: 960 });
const lp = await page({ width: 1280, height: 800 }); await lp.goto('http://admin.test/'); await lp.waitForSelector('#lf'); await lp.waitForTimeout(400); await lp.screenshot({ path: `${out}/admin-login.png` });
await p.goto('http://admin.test/');
// 관리자가 아닌 계정
await p.fill('input[name=email]', 'bob@x.com'); await p.fill('input[name=pw]', 'x'); await p.click('button.primary');
await p.waitForSelector('#lerr:not(:empty)'); ok((await p.textContent('#lerr')).includes('관리자 명단에 없습니다'), 'non-admin is turned away');
await p.fill('input[name=email]', 'ann@x.com'); await p.fill('input[name=pw]', 'pw'); await p.click('button.primary');
await p.waitForSelector('.cards'); await p.waitForTimeout(400); ok((await p.textContent('.hero')).includes('68'), 'dashboard shows 68 users');
await p.screenshot({ path: `${out}/admin-dashboard.png`, fullPage: true });
await p.hover('#chart', { position: { x: 300, y: 80 } }); await p.screenshot({ path: `${out}/admin-dashboard-hover.png` });
ok(await p.isVisible('#chart .tip'), 'chart tooltip on hover');
await p.click('.ranges button[data-n="7"]'); ok((await p.textContent('#ctot')).includes('7일'), 'range pill switches to 7 days');
await p.goto('http://admin.test/#/users'); await p.waitForSelector('tbody tr');
ok(await p.locator('tbody tr').count() === 50, 'users page 1 has 50 rows'); ok((await p.textContent('.pager')).includes('1 / 2'), 'pager shows 2 pages');
await p.screenshot({ path: `${out}/admin-users.png`, fullPage: false });
await p.fill('input[name=q]', 'bob'); await p.press('input[name=q]', 'Enter');
await p.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1); await p.click('tbody tr');
await p.waitForSelector('#ban'); ok((await p.textContent('.card.violet .cnum')).trim() === '37', 'bob detail shows 37 records');
await p.screenshot({ path: `${out}/admin-user.png`, fullPage: true });
await p.click('#ban'); await p.fill('dialog input[name=reason]', '테스트 정지');
await p.screenshot({ path: `${out}/admin-ban-dialog.png` });
await p.click('dialog button[value=ok]'); await p.waitForSelector('#unban'); ok(true, 'ban → unban button appears');
await p.click('#del'); await p.fill('dialog input[name=confirm_email]', 'bob@x.com'); await p.click('dialog button[value=ok]');
await p.waitForSelector('.toast.bad'); ok((await p.textContent('.toast.bad')).includes('먼저 구독을 해지'), 'delete blocked by live subscription');
await p.goto('http://admin.test/#/subs?status=past_due'); await p.waitForSelector('tbody tr');
ok((await p.locator('tbody .badge.past_due').count()) >= 1, 'subscriptions filter past_due');
await p.goto('http://admin.test/#/subs'); await p.waitForSelector('tbody tr'); await p.screenshot({ path: `${out}/admin-subs.png` });
await p.goto('http://admin.test/#/audit'); await p.waitForSelector('.audit li'); await p.screenshot({ path: `${out}/admin-audit.png` }); ok((await p.textContent('.audit')).includes('테스트 정지'), 'audit shows ban reason');

const m = await page({ width: 390, height: 844 });
await m.goto('http://admin.test/'); await m.fill('input[name=email]', 'ann@x.com'); await m.fill('input[name=pw]', 'pw'); await m.click('button.primary');
await m.waitForSelector('.cards'); await m.waitForTimeout(400); ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no horizontal page scroll');
await m.screenshot({ path: `${out}/admin-mobile.png`, fullPage: true });
ok(!errors.length, 'no page errors ' + errors.join(' | '));
await browser.close();
console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
