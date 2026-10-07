/* Kept 관리자 페이지 — 빌드 없이 동작하는 단일 모듈
   모든 데이터는 Edge Function admin-api를 거칩니다. 이 파일은 관리자 권한을 판단하지 않습니다(서버가 판단). */
const CFG = window.KEPT_ADMIN_CONFIG || {};
const app = document.getElementById('app');
let sb = null, me = null;

/* ---------- helpers ---------- */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n || 0).toLocaleString('ko-KR');
const day = d => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const when = d => d ? new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const ago = d => {
  if (!d) return '—';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}분 전`;
  if (s < 86400) return `${Math.round(s / 3600)}시간 전`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)}일 전`;
  return day(d);
};
const STATUS = { active: '이용 중', trialing: '체험 중', past_due: '결제 실패', paused: '일시정지', canceled: '해지됨' };
const PLAN = { monthly: '월간', yearly: '연간' };
const ACTION = { ban: '이용 정지', unban: '정지 해제', delete_user: '계정 삭제', cancel_subscription: '구독 해지' };
const ERR = {
  'login required': '다시 로그인해 주세요.', 'not an admin': '이 계정은 관리자 명단에 없습니다.', 'owner only': '최고 관리자(owner)만 할 수 있습니다.',
  'cannot change your own account': '내 계정은 여기서 바꿀 수 없습니다.', 'cannot delete your own account': '내 계정은 여기서 삭제할 수 없습니다.',
  'remove admin role first': '관리자 계정입니다. 먼저 관리자 명단에서 빼 주세요.', 'email does not match': '확인용 이메일이 일치하지 않습니다.',
  'cancel the subscription first': '이용 중인 구독이 있습니다. 먼저 구독을 해지해 주세요.', 'PADDLE_API_KEY not set': '서버에 Paddle API 키가 없어 여기서 해지할 수 없습니다. Paddle 대시보드에서 해지해 주세요.'
};
const badge = (s, cls = '') => `<span class="badge ${esc(cls || s)}">${esc(STATUS[s] || s)}</span>`;
/* 초록 알약(↗ +21) — 참고 이미지의 변화량 표시 */
const pill = (text, tone = 'up') => `<span class="pill ${tone}">${tone === 'up' ? I.up : tone === 'down' ? I.down : ''}${esc(text)}</span>`;
/* 큰 숫자: 소수점 아래는 흐리게 ($59.85 → $59 + .85) */
const big = (v, prefix = '') => {
  const [a, b] = String(v).split('.');
  return `${esc(prefix)}${esc(a)}${b !== undefined ? `<span class="dim">.${esc(b)}</span>` : ''}`;
};
const TONES = ['violet', 'mustard', 'coral', 'sage'];
const tone = s => TONES[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
const avatar = email => `<span class="ava ${tone(email)}">${esc(String(email || '?')[0].toUpperCase())}</span>`;

/* 선 아이콘 (stroke = currentColor) */
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  dash: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>'),
  users: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
  card: svg('<rect x="3.5" y="6" width="17" height="12.5" rx="2.5"/><path d="M3.5 10.5h17M7 15h3"/>'),
  log: svg('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>'),
  refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
  out: svg('<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="M10 16l4-4-4-4M14 12H4.5"/>'),
  up: svg('<path d="M7 17 17 7M9 7h8v8"/>'),
  down: svg('<path d="M7 7l10 10M17 9v8H9"/>'),
  check: svg('<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>'),
  alert: svg('<path d="M12 4 3 19.5h18z"/><path d="M12 10v4M12 17h.01"/>'),
  note: svg('<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h4"/>'),
  folder: svg('<path d="M3.5 7.5a2 2 0 0 1 2-2H10l2 2h6.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  ban: svg('<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>'),
  trash: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>')
};

async function api(action, args = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { renderLogin(); throw new Error('login required'); }
  const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...args })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = body.error || `HTTP ${r.status}`;
    if (r.status === 404 && !body.error) throw new Error('admin-api 함수가 아직 배포되지 않았습니다.');
    throw new Error(ERR[msg] || msg);
  }
  return body;
}

function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* 확인 창: fields = [{ name, label, placeholder }] → 입력값 객체 또는 null */
function confirmBox({ title, body, ok = '확인', danger = false, fields = [] }) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.className = 'confirm';
    d.innerHTML = `<form method="dialog">
      <h3>${esc(title)}</h3><p>${body}</p>
      ${fields.map(f => `<label>${esc(f.label)}<input name="${esc(f.name)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" ${f.required ? 'required' : ''}></label>`).join('')}
      <div class="row end"><button value="cancel" formnovalidate class="btn ghost">취소</button><button value="ok" class="btn ${danger ? 'danger' : 'primary'}">${esc(ok)}</button></div>
    </form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => {
      const out = d.returnValue === 'ok' ? Object.fromEntries(new FormData(d.querySelector('form'))) : null;
      d.remove(); res(out);
    });
    d.showModal();
  });
}

/* ---------- charts ---------- */
function fillDays(rows, n) {
  const m = new Map((rows || []).map(r => [String(r.day).slice(0, 10), Number(r.n)]));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86400000).toISOString().slice(0, 10);
    return { day: d, n: m.get(d) || 0 };
  });
}
/* 점들을 부드러운 곡선으로 (Catmull-Rom → cubic Bézier) */
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const pts = (series, w, h, pad = 4) => {
  const max = Math.max(1, ...series.map(x => x.n));
  return series.map((x, i) => [i / Math.max(1, series.length - 1) * w, h - pad - x.n / max * (h - pad * 2)]);
};
function spark(series, label) {
  const total = series.reduce((a, x) => a + x.n, 0);
  return `<svg class="spark" viewBox="0 0 120 44" preserveAspectRatio="none" role="img" aria-label="${esc(label)}: 최근 30일 ${total}">
    <title>${esc(label)} · 최근 30일 합계 ${total}</title>
    <path d="${smooth(pts(series, 120, 44))}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
/* 큰 추이 차트: 십자선 + 툴팁 */
function lineChart(el, series) {
  const W = 600, H = 190;
  const P = pts(series, W, H, 14);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="${W}" y1="${H - 14}" y2="${H - 14}" class="axis" vector-effect="non-scaling-stroke"/>
      <path d="${smooth(P)}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <i class="cross" hidden></i><i class="dot" hidden></i><span class="tip" hidden></span>`;
  const cross = el.querySelector('.cross'), dot = el.querySelector('.dot'), tip = el.querySelector('.tip');
  const show = i => {
    const [x, y] = P[i], r = el.getBoundingClientRect(), px = x / W * r.width, py = y / H * r.height;
    cross.hidden = dot.hidden = tip.hidden = false;
    cross.style.left = dot.style.left = tip.style.left = px + 'px';
    dot.style.top = py + 'px'; tip.style.top = py + 'px';
    tip.classList.toggle('l', px < 70); tip.classList.toggle('r', px > r.width - 70); // 가장자리에서 툴팁이 밖으로 나가지 않게
    const d = new Date(series[i].day);
    tip.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 · ${series[i].n}명`;
  };
  el.onpointermove = e => { const r = el.getBoundingClientRect(); show(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (P.length - 1))); };
  el.onpointerleave = () => show(P.length - 1);
  show(P.length - 1);
}

/* ---------- login ---------- */
function renderLogin(msg = '') {
  app.innerHTML = `<main class="login">
    <form id="lf" class="login-card">
      <span class="mark" aria-hidden="true"></span>
      <p class="label">KEPT ADMIN</p>
      <h1 class="display">관리자 로그인</h1>
      <label>이메일<input name="email" type="email" autocomplete="username" required></label>
      <label>비밀번호<input name="pw" type="password" autocomplete="current-password" required></label>
      <button class="btn primary wide">로그인</button>
      <p class="err" id="lerr">${esc(msg)}</p>
      <p class="hint">관리자 명단에 등록된 계정만 들어올 수 있습니다.</p>
    </form></main>`;
  document.getElementById('lf').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), err = document.getElementById('lerr');
    err.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('pw') });
    if (error) { err.textContent = '이메일 또는 비밀번호가 맞지 않습니다.'; return; }
    start();
  });
}

async function start() {
  try { me = await api('me'); }
  catch (e) {
    if (e.message !== 'login required') { await sb.auth.signOut(); renderLogin(e.message); }
    return;
  }
  route();
}

/* ---------- shell: 검은 프레임 + 아이콘 레일 + 상단바 + 둥근 패널 ---------- */
const NAV = [['#/', '대시보드', I.dash], ['#/users', '회원', I.users], ['#/subs', '구독·결제', I.card], ['#/audit', '관리 기록', I.log]];
function greet() { const h = new Date().getHours(); return h < 6 ? '늦은 밤이에요' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요'; }
function shell(active, inner) {
  const q = active === '#/users' ? new URLSearchParams((location.hash.split('?')[1]) || '').get('q') || '' : '';
  app.innerHTML = `<div class="frame">
    <aside class="rail">
      <a href="#/" class="mark" aria-label="Kept 관리자"></a>
      <nav>${NAV.map(([h, l, ic]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${ic}<span>${l}</span></a>`).join('')}</nav>
      <button id="reload" class="fab" title="새로고침" aria-label="새로고침">${I.refresh}</button>
    </aside>
    <header class="topbar">
      <form id="ts" class="tsearch" role="search">${I.search}<input name="q" type="search" placeholder="회원 이메일 또는 ID 검색" value="${esc(q)}" aria-label="회원 검색"></form>
      <div class="me">
        <span class="hello">${greet()}, <b>${esc(me.email.split('@')[0])}</b></span>
        <span class="ava big ${tone(me.email)}" title="${esc(me.email)} · ${me.role === 'owner' ? '최고 관리자' : '운영자'}">${esc(me.email[0].toUpperCase())}</span>
        <button id="out" class="iconbtn" title="로그아웃" aria-label="로그아웃">${I.out}</button>
      </div>
    </header>
    <main id="main" class="panel">${inner}</main></div>`;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); me = null; renderLogin(); };
  document.getElementById('reload').onclick = () => route();
  document.getElementById('ts').onsubmit = e => { e.preventDefault(); location.hash = link('#/users', { q: new FormData(e.target).get('q') }); };
}
const loading = active => shell(active, '<p class="muted pad">불러오는 중…</p>');
const failed = (active, e) => shell(active, `<div class="box pad"><p class="err">${esc(e.message)}</p></div>`);
const head = (label, value, extra = '') => `<header class="hero"><p class="label">${esc(label)}</p><h1 class="display">${value}</h1>${extra}</header>`;
const sectionHead = (title, href, text) => `<div class="shead"><p class="label">${esc(title)}</p>${href ? `<a href="${href}">${esc(text)}</a>` : ''}</div>`;

/* ---------- dashboard ---------- */
async function viewDash() {
  loading('#/');
  let s, recent = [];
  try { [s, recent] = await Promise.all([api('stats'), api('audit').then(r => r.rows.slice(0, 3)).catch(() => [])]); } catch (e) { return failed('#/', e); }
  const p = s.paying || {}, P = CFG.PRICES || { monthly: 3.99, yearly: 39.9, currency: 'USD' };
  const mrr = (p.monthly || 0) * P.monthly + (p.yearly || 0) * P.yearly / 12;
  const paying = (p.monthly || 0) + (p.yearly || 0);
  const st = s.subs_by_status || {};
  const signups = fillDays(s.signups_30d, 30), entries = fillDays(s.entries_series, 30), subs = fillDays(s.subs_series, 30);
  const sum = a => a.reduce((x, y) => x + y.n, 0);
  const activePct = s.users ? Math.round(s.active_7d / s.users * 100) : 0;

  shell('#/', `<div class="dash">
    <div class="dash-main">
      ${head('전체 회원', big(num(s.users)), pill(`+${num(s.new_7d)} 이번 주`))}
      ${sectionHead('주요 지표', '#/users', '회원 전체 보기')}
      <section class="cards">
        <a class="card violet" href="#/users">
          <div class="ctop"><span class="cicon">${I.users}</span><div><b>신규 가입</b><small>최근 30일</small></div></div>
          ${spark(signups, '신규 가입')}
          <p class="cnum">${num(s.new_30d)}</p>${pill(`+${num(s.new_7d)} 7일`)}
        </a>
        <a class="card mustard" href="#/subs?status=active">
          <div class="ctop"><span class="cicon">${I.card}</span><div><b>유료 구독</b><small>월간 ${num(p.monthly)} · 연간 ${num(p.yearly)}</small></div></div>
          ${spark(subs, '새 구독')}
          <p class="cnum">${num(paying)}</p>${pill(`+${num(sum(subs))} 30일`)}
        </a>
        <a class="card coral" href="#/users">
          <div class="ctop"><span class="cicon">${I.note}</span><div><b>기록</b><small>삭제 제외</small></div></div>
          ${spark(entries, '새 기록')}
          <p class="cnum">${num(s.entries)}</p>${pill(`+${num(s.entries_7d)} 7일`)}
        </a>
        <a class="card black" href="#/users">
          <div class="ctop"><span class="cicon">${I.clock}</span><div><b>7일 내 접속</b><small>회원 대비</small></div></div>
          <div class="meter" role="img" aria-label="회원의 ${activePct}%"><i data-w="${activePct}"></i></div>
          <p class="cnum">${num(s.active_7d)}</p>${pill(`${activePct}%`, 'flat')}
        </a>
      </section>
      ${sectionHead('인사이트')}
      <section class="insights">
        <div class="box chartbox">
          <div class="row between"><div class="ctop"><span class="cicon mustard">${I.users}</span><div><b>가입 추이</b><small id="ctot"></small></div></div>
            <span id="cpill"></span></div>
          <div class="chart" id="chart"></div>
          <div class="ranges" role="tablist">${[[7, '7일'], [14, '14일'], [30, '30일']].map(([n, l]) => `<button role="tab" data-n="${n}" class="${n === 30 ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="box news">
          ${sectionHead('최근 관리 기록', '#/audit', '전체 보기')}
          ${recent.length ? `<ul>${recent.map(a => `<li><span class="ava ${a.action === 'unban' ? 'sage' : a.action === 'ban' ? 'mustard' : 'coral'}">${a.action === 'delete_user' ? I.trash : a.action === 'cancel_subscription' ? I.card : I.ban}</span>
            <div><b>${esc(ACTION[a.action] || a.action)}${a.target_email ? ` · ${esc(a.target_email)}` : ''}</b>
            <small>${I.clock}${ago(a.at)} · ${esc(a.admin_email || '')}</small></div></li>`).join('')}</ul>` : '<p class="muted">아직 조치한 기록이 없습니다.</p>'}
        </div>
      </section>
    </div>
    <aside class="dash-side">
      <a class="stack s1" href="#/subs?status=active"><span class="sicon">${I.check}</span><b>이용 중</b>${pill(num(st.active), 'flat')}</a>
      <a class="stack s2" href="#/subs?status=canceling"><span class="sicon">${I.clock}</span><b>해지 예정</b>${pill(num(s.canceling), 'flat')}</a>
      <a class="stack s3 coral" href="#/subs?status=past_due"><div class="row between"><span class="row gap"><span class="sicon">${I.alert}</span><b>결제 실패</b></span>${st.past_due ? pill('재시도 중', 'down') : ''}</div>
        <p class="cnum">${num(st.past_due)}<span class="dim">건</span></p></a>
      <div class="sage-panel">
        <div class="tabs2"><b>구독</b><span>요약</span></div>
        <div class="well">
          <p class="label">예상 월 매출</p>
          <p class="cnum">${big(mrr.toFixed(2), '$')}</p>
          <small>월간 ${num(p.monthly)} × $${P.monthly} + 연간 ${num(p.yearly)} × $${P.yearly} ÷ 12</small>
        </div>
        <div class="well soft">
          ${Object.keys(STATUS).map(k => `<a class="srow" href="#/subs?status=${k}"><span>${esc(STATUS[k])}</span><b>${num(st[k])}</b></a>`).join('')}
          <a class="srow" href="#/users?filter=banned"><span>이용 정지 회원</span><b>${num(s.banned)}</b></a>
          <a class="srow" href="#/"><span>공유 폴더</span><b>${num(s.shared_folders)}</b></a>
        </div>
        <a class="btn blackpill wide" href="#/subs">구독 목록 보기</a>
      </div>
    </aside></div>`);

  document.querySelectorAll('.meter i').forEach(i => i.style.setProperty('--w', Math.max(2, Number(i.dataset.w)) + '%'));
  const draw = n => {
    const series = signups.slice(-n), t = sum(series), prev = sum(signups.slice(-2 * n, -n));
    lineChart(document.getElementById('chart'), series);
    document.getElementById('ctot').textContent = `최근 ${n}일 ${num(t)}명`;
    document.getElementById('cpill').innerHTML = n < 30 && prev ? pill(`${t >= prev ? '+' : ''}${Math.round((t - prev) / prev * 100)}% 직전 대비`, t >= prev ? 'up' : 'down') : pill(`${num(t)}명`, 'flat');
  };
  document.querySelectorAll('.ranges button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.ranges button').forEach(x => x.classList.toggle('on', x === b)); draw(Number(b.dataset.n));
  });
  draw(30);
}

/* ---------- users ---------- */
const UFILTER = [['all', '전체'], ['paying', '유료'], ['past_due', '결제 실패'], ['banned', '이용 정지'], ['admins', '관리자']];
async function viewUsers(q) {
  const filter = q.get('filter') || 'all', search = q.get('q') || '', pg = Number(q.get('page') || 0);
  loading('#/users');
  let r; try { r = await api('users', { q: search, filter, page: pg }); } catch (e) { return failed('#/users', e); }
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  shell('#/users', `${head(search ? `“${search}” 검색 결과` : '회원', big(num(r.total)) + '<span class="unit">명</span>')}
    <div class="ranges left">${UFILTER.map(([k, l]) => `<a href="${link('#/users', { filter: k, q: search })}" class="${k === filter ? 'on' : ''}">${l}</a>`).join('')}</div>
    <div class="box tablebox"><table><thead><tr><th>회원</th><th>가입</th><th>최근 접속</th><th class="r">기록</th><th>구독</th></tr></thead><tbody>
      ${r.rows.map(u => `<tr data-id="${esc(u.id)}" tabindex="0">
        <td><div class="who">${avatar(u.email)}<div><b>${esc(u.email)}</b>${u.admin_role ? ' <span class="badge admin">관리자</span>' : ''}${u.banned_until && new Date(u.banned_until) > new Date() ? ' <span class="badge banned">정지</span>' : ''}</div></div></td>
        <td>${day(u.created_at)}</td><td>${ago(u.last_sign_in_at)}</td><td class="r num">${num(u.entries)}</td>
        <td>${u.sub_status ? `${badge(u.sub_status)} <span class="muted">${esc(PLAN[u.sub_plan] || '')}</span>` : '<span class="muted">무료</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted pad">해당하는 회원이 없습니다.</td></tr>'}
    </tbody></table></div>
    ${pager('#/users', { filter, q: search }, pg, pages)}`);
  document.querySelectorAll('tr[data-id]').forEach(tr => {
    const go = () => { location.hash = '#/users/' + tr.dataset.id; };
    tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}
function link(base, params) { const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== 'all' && v !== '0')).toString(); return s ? `${base}?${s}` : base; }
function pager(base, params, pg, pages) {
  if (pages <= 1) return '';
  return `<div class="row center gap pager">
    ${pg > 0 ? `<a class="btn ghost sm" href="${link(base, { ...params, page: pg - 1 })}">이전</a>` : ''}
    <span class="muted">${pg + 1} / ${pages}</span>
    ${pg + 1 < pages ? `<a class="btn ghost sm" href="${link(base, { ...params, page: pg + 1 })}">다음</a>` : ''}</div>`;
}

async function viewUser(id) {
  loading('#/users');
  let u; try { u = await api('user', { id }); } catch (e) { return failed('#/users', e); }
  const banned = u.banned_until && new Date(u.banned_until) > new Date();
  const sub = (u.subscriptions || [])[0];
  const live = sub && ['active', 'trialing', 'past_due', 'paused'].includes(sub.status);
  shell('#/users', `<a href="#/users" class="back">${I.back}회원 목록</a>
    <header class="hero person">${avatar(u.email).replace('class="ava', 'class="ava xl')}
      <div><p class="label">${u.admin_role ? '관리자 계정' : '회원'}</p><h1 class="display sm">${esc(u.email)}</h1>
      <div class="row gap wrap">${banned ? pill('이용 정지', 'down') : pill(`가입 ${ago(u.created_at)}`, 'flat')}${u.email_confirmed_at ? '' : pill('이메일 미인증', 'down')}</div></div></header>
    <section class="cards">
      <div class="card violet"><div class="ctop"><span class="cicon">${I.note}</span><div><b>기록</b><small>휴지통 ${num(u.entries_trash)}</small></div></div><p class="cnum">${num(u.entries)}</p><small>최근 ${ago(u.last_entry_at)}</small></div>
      <div class="card mustard"><div class="ctop"><span class="cicon">${I.folder}</span><div><b>공유 폴더</b><small>만든 것 · 참여</small></div></div><p class="cnum">${num(u.folders_owned)}<span class="dim"> · ${num(u.folders_joined)}</span></p><small>카테고리 ${num(u.categories)}개</small></div>
      <div class="card ${live ? 'sage' : 'coral'}"><div class="ctop"><span class="cicon">${I.card}</span><div><b>구독</b><small>${sub ? esc(PLAN[sub.plan] || sub.plan || '') : '무료'}</small></div></div><p class="cnum sm">${sub ? esc(STATUS[sub.status] || sub.status) : '없음'}</p><small>${sub ? (sub.cancel_at ? `${day(sub.cancel_at)} 해지 예정` : `다음 ${day(sub.current_period_end)}`) : '구독한 적 없음'}</small></div>
      <div class="card black"><div class="ctop"><span class="cicon">${I.clock}</span><div><b>최근 접속</b><small>${when(u.last_sign_in_at)}</small></div></div><p class="cnum sm">${ago(u.last_sign_in_at)}</p><small>첫 기록 ${day(u.first_entry_at)}</small></div>
    </section>
    <p class="muted xs">개인 기록이라 내용은 관리자에게도 보이지 않습니다.</p>
    <section class="grid2">
      <div class="box pad"><h2>계정</h2><dl>
        <dt>회원 ID</dt><dd class="mono">${esc(u.id)}</dd>
        <dt>가입</dt><dd>${when(u.created_at)}</dd>
        <dt>이메일 인증</dt><dd>${u.email_confirmed_at ? when(u.email_confirmed_at) : '<span class="warn-t">미인증</span>'}</dd>
        <dt>최근 접속</dt><dd>${when(u.last_sign_in_at)}</dd>
      </dl></div>
      <div class="box pad"><h2>조치</h2>
        <div class="row gap wrap">
          ${u.admin_role || u.id === me.id ? '<span class="muted">관리자 계정은 여기서 정지·삭제할 수 없습니다.</span>' : `
            ${banned ? `<button class="btn primary" id="unban">${I.check}정지 해제</button>` : `<button class="btn" id="ban">${I.ban}이용 정지</button>`}
            ${me.role === 'owner' ? `<button class="btn danger" id="del">${I.trash}계정 삭제</button>` : ''}`}
        </div>
        <p class="muted xs">이용 정지: 새로 로그인할 수 없고, 이미 열린 앱도 로그인 갱신 시점(최대 1시간)에 끊깁니다. 기록은 그대로 남습니다.</p>
      </div>
    </section>
    <section class="box pad"><h2>구독 내역</h2>
      ${(u.subscriptions || []).length ? `<div class="tablebox flat"><table><thead><tr><th>상태</th><th>요금제</th><th>다음 결제/종료</th><th>해지 예정</th><th>Paddle ID</th><th></th></tr></thead><tbody>
        ${u.subscriptions.map(s => `<tr><td>${badge(s.status)}</td><td>${esc(PLAN[s.plan] || s.plan || '')}</td><td>${day(s.current_period_end)}</td><td>${s.cancel_at ? day(s.cancel_at) : '—'}</td>
          <td class="mono xs">${esc(s.subscription_id)}<br>${esc(s.customer_id || '')}</td>
          <td>${me.role === 'owner' && s.status !== 'canceled' && !s.cancel_at ? `<button class="btn ghost sm" data-cancel="${esc(s.subscription_id)}">해지</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">구독한 적 없음 (무료)</p>'}
      <p class="muted xs">환불·영수증·결제 수단은 Paddle 대시보드에서 처리합니다. Paddle에서 위 ID로 검색하세요.</p>
    </section>
    <section class="box pad"><h2>이 회원에 대한 관리 기록</h2>${auditList(u.audit || [])}</section>`);

  const reload = () => viewUser(id);
  const on = (sel, fn) => { const el = document.getElementById(sel); if (el) el.onclick = fn; };
  on('ban', async () => {
    const v = await confirmBox({ title: '이용 정지', body: `<b>${esc(u.email)}</b> 계정의 로그인을 막습니다. 기록은 지워지지 않고, 언제든 해제할 수 있습니다.`, ok: '정지', danger: true, fields: [{ name: 'reason', label: '사유 (관리 기록에 남음)', placeholder: '예: 스팸 가입' }] });
    if (!v) return;
    try { await api('ban', { id, reason: v.reason }); toast('이용을 정지했습니다.'); reload(); } catch (e) { toast(e.message, true); }
  });
  on('unban', async () => {
    if (!await confirmBox({ title: '정지 해제', body: `<b>${esc(u.email)}</b> 계정이 다시 로그인할 수 있게 됩니다.`, ok: '해제' })) return;
    try { await api('unban', { id }); toast('정지를 해제했습니다.'); reload(); } catch (e) { toast(e.message, true); }
  });
  on('del', async () => {
    const v = await confirmBox({
      title: '계정 삭제', danger: true, ok: '영구 삭제',
      body: `<b>${esc(u.email)}</b> 계정과 기록 ${num(u.entries)}개, 이 회원이 만든 공유 폴더가 <b>영구히 삭제</b>됩니다. 되돌릴 수 없습니다.${live && !sub.cancel_at ? '<br><br>이용 중인 구독이 있어 먼저 해지해야 합니다.' : ''}`,
      fields: [{ name: 'confirm_email', label: '확인을 위해 이메일을 그대로 입력', placeholder: u.email, required: true }, { name: 'reason', label: '사유', placeholder: '예: 본인 요청 (메일 2026-10-07)' }]
    });
    if (!v) return;
    try { await api('delete_user', { id, ...v }); toast('계정을 삭제했습니다.'); location.hash = '#/users'; } catch (e) { toast(e.message, true); }
  });
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => cancelSub(b.dataset.cancel, u.email, reload));
}

async function cancelSub(sid, email, after) {
  if (!me.paddle) { toast(ERR['PADDLE_API_KEY not set'], true); return; }
  const v = await confirmBox({
    title: '구독 해지', ok: '해지', danger: true,
    body: `<b>${esc(email || sid)}</b>의 구독을 <b>이번 결제 기간이 끝날 때</b> 해지합니다. 이미 결제한 기간은 계속 쓸 수 있습니다. 환불이 필요하면 Paddle 대시보드에서 따로 처리하세요.`,
    fields: [{ name: 'reason', label: '사유', placeholder: '예: 본인 요청' }]
  });
  if (!v) return;
  try { await api('cancel_subscription', { subscription_id: sid, when: 'next_billing_period', reason: v.reason }); toast('해지를 요청했습니다. 몇 초 뒤 반영됩니다.'); setTimeout(after, 2500); }
  catch (e) { toast(e.message, true); }
}

/* ---------- subscriptions ---------- */
const SFILTER = [['all', '전체'], ['active', '이용 중'], ['canceling', '해지 예정'], ['past_due', '결제 실패'], ['paused', '일시정지'], ['canceled', '해지됨']];
async function viewSubs(q) {
  const status = q.get('status') || 'all', pg = Number(q.get('page') || 0);
  loading('#/subs');
  let r; try { r = await api('subscriptions', { status, page: pg }); } catch (e) { return failed('#/subs', e); }
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  shell('#/subs', `${head('구독·결제 · ' + (SFILTER.find(f => f[0] === status) || SFILTER[0])[1], big(num(r.total)) + '<span class="unit">건</span>')}
    <div class="ranges left">${SFILTER.map(([k, l]) => `<a href="${link('#/subs', { status: k })}" class="${k === status ? 'on' : ''}">${l}</a>`).join('')}</div>
    <div class="box tablebox"><table><thead><tr><th>회원</th><th>상태</th><th>요금제</th><th>다음 결제/종료</th><th>해지 예정</th><th>최근 변경</th></tr></thead><tbody>
      ${r.rows.map(s => `<tr ${s.user_id ? `data-id="${esc(s.user_id)}" tabindex="0"` : ''}>
        <td><div class="who">${avatar(s.email || '?')}<div>${s.email ? `<b>${esc(s.email)}</b>` : '<span class="muted">연결 안 됨</span>'}<br><span class="mono xs muted">${esc(s.subscription_id)}</span></div></div></td>
        <td>${badge(s.status)}</td><td>${esc(PLAN[s.plan] || s.plan || '')} <span class="muted xs">${esc(s.currency || '')}</span></td>
        <td>${day(s.current_period_end)}</td><td>${s.cancel_at ? day(s.cancel_at) : '—'}</td><td>${ago(s.updated_at)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted pad">해당하는 구독이 없습니다.</td></tr>'}
    </tbody></table></div>
    ${pager('#/subs', { status }, pg, pages)}
    <p class="muted xs">여기 목록은 Paddle 웹훅이 기록한 것입니다. 금액·환불·세금·정산은 Paddle 대시보드가 기준입니다.</p>`);
  document.querySelectorAll('tr[data-id]').forEach(tr => {
    const go = () => { location.hash = '#/users/' + tr.dataset.id; };
    tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}

/* ---------- audit ---------- */
function auditList(rows) {
  if (!rows.length) return '<p class="muted">기록 없음</p>';
  return `<ul class="audit">${rows.map(a => `<li><span class="ava ${a.action === 'unban' ? 'sage' : a.action === 'ban' ? 'mustard' : 'coral'}">${a.action === 'delete_user' ? I.trash : a.action === 'cancel_subscription' ? I.card : I.ban}</span>
    <div><b>${esc(ACTION[a.action] || a.action)}</b>${a.target_email ? ` · ${esc(a.target_email)}` : ''}
    <small>${when(a.at)} · ${esc(a.by || a.admin_email || '')}</small>
    ${a.detail?.reason ? `<small>사유: ${esc(a.detail.reason)}</small>` : ''}</div></li>`).join('')}</ul>`;
}
async function viewAudit(q) {
  const pg = Number(q.get('page') || 0);
  loading('#/audit');
  let r; try { r = await api('audit', { page: pg }); } catch (e) { return failed('#/audit', e); }
  shell('#/audit', `${head('관리 기록', '누가, 언제, 왜', '<p class="muted">정지·삭제·해지는 모두 여기에 남습니다.</p>')}
    <section class="box pad">${auditList(r.rows)}</section>
    <div class="row center gap pager">${pg > 0 ? `<a class="btn ghost sm" href="${link('#/audit', { page: pg - 1 })}">이전</a>` : ''}
      ${r.rows.length === r.pageSize ? `<a class="btn ghost sm" href="${link('#/audit', { page: pg + 1 })}">다음</a>` : ''}</div>`);
}

/* ---------- router ---------- */
function route() {
  if (!me) return;
  const [path, qs] = (location.hash || '#/').split('?');
  const q = new URLSearchParams(qs || '');
  const m = path.match(/^#\/users\/([0-9a-f-]{36})$/i);
  if (m) return viewUser(m[1]);
  if (path === '#/users') return viewUsers(q);
  if (path === '#/subs') return viewSubs(q);
  if (path === '#/audit') return viewAudit(q);
  return viewDash();
}
window.addEventListener('hashchange', route);

/* ---------- boot ---------- */
(async () => {
  if (!/^https:\/\//.test(CFG.SUPABASE_URL || '') || !CFG.SUPABASE_ANON_KEY || !window.supabase) {
    app.innerHTML = '<p class="boot">config.js에 Supabase 주소와 anon 키를 넣어 주세요.</p>'; return;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kept.admin.auth' } });
  const { data: { session } } = await sb.auth.getSession();
  if (session) start(); else renderLogin();
})();
