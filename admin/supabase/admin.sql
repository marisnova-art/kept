-- =====================================================================
-- Kept 관리자 — 서버 준비
-- 먼저 v2-shared-folders.sql, v2-subscriptions.sql을 실행한 뒤,
-- Supabase → SQL Editor에 이 파일 전체를 붙여 넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 원칙
--  · 아래 표와 함수는 브라우저(anon / 로그인 사용자)에서 절대 호출할 수 없습니다.
--    Edge Function admin-api만 service role로 부르고, 그 함수가 "관리자 명단에 있는가"를 먼저 확인합니다.
--  · 관리자도 회원의 기록 내용(제목·본문)은 보지 않습니다. 개수와 날짜만 봅니다.
-- =====================================================================

-- ---------- 관리자 명단 ----------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'staff')),  -- owner: 계정 삭제·구독 해지까지, staff: 조회·정지
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
-- 정책 없음 = anon·authenticated 모두 읽기/쓰기 불가. service role만 접근.
revoke all on public.admins from anon, authenticated;

-- ---------- 관리 기록 (누가 언제 무엇을 했는지) ----------
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users(id) on delete set null,
  admin_email text,
  action      text not null,
  target_user uuid,
  target_email text,
  detail      jsonb not null default '{}',
  at          timestamptz not null default now()
);
create index if not exists admin_audit_at_idx on public.admin_audit(at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- ---------- 대시보드 숫자 ----------
create or replace function public.admin_stats() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'users',          (select count(*) from auth.users),
    'new_7d',         (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_30d',        (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d',      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'banned',         (select count(*) from auth.users where banned_until > now()),
    'entries',        (select count(*) from public.entries where deleted_at is null),
    'entries_7d',     (select count(*) from public.entries where created_at > now() - interval '7 days'),
    'shared_folders', (select count(*) from public.folders),
    'subs_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.subscriptions group by status) s), '{}'),
    'paying',         coalesce((select jsonb_object_agg(plan, n) from (select plan, count(*) n from public.subscriptions where status in ('active', 'past_due') group by plan) p), '{}'),
    'signups_30d',    coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (
                        select date_trunc('day', created_at)::date d, count(*) n from auth.users
                        where created_at > now() - interval '30 days' group by 1) g), '[]'),
    'entries_series', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (
                        select date_trunc('day', created_at)::date d, count(*) n from public.entries
                        where created_at > now() - interval '30 days' group by 1) g), '[]'),
    'subs_series',    coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (
                        select date_trunc('day', created_at)::date d, count(*) n from public.subscriptions
                        where created_at > now() - interval '30 days' group by 1) g), '[]'),
    'canceling',      (select count(*) from public.subscriptions where cancel_at is not null and status <> 'canceled')
  )
$$;

-- ---------- 회원 목록 (검색 · 페이지) ----------
drop function if exists public.admin_users(text, text, int, int);
create or replace function public.admin_users(q text default '', filter text default 'all', lim int default 50, off int default 0)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
               entries bigint, last_entry_at timestamptz, sub_status text, sub_plan text, admin_role text, total bigint)
language sql stable security definer set search_path = public, auth as $$
  with base as (
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until,
           (select count(*) from public.entries e where e.user_id = u.id and e.deleted_at is null) entries,
           (select max(e.updated_at) from public.entries e where e.user_id = u.id) last_entry_at,
           s.status sub_status, s.plan sub_plan, a.role admin_role
    from auth.users u
    left join lateral (select status, plan from public.subscriptions x where x.user_id = u.id order by x.updated_at desc limit 1) s on true
    left join public.admins a on a.user_id = u.id
    where (coalesce(q, '') = '' or u.email ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%' or u.id::text = q)
  ), f as (
    select * from base where case filter
      when 'paying'   then sub_status in ('active', 'past_due', 'trialing')
      when 'past_due' then sub_status = 'past_due'
      when 'banned'   then banned_until > now()
      when 'admins'   then admin_role is not null
      else true end
  )
  select f.*, count(*) over () total from f
  order by f.created_at desc
  limit least(greatest(lim, 1), 200) offset greatest(off, 0)
$$;

-- ---------- 회원 한 명 ----------
create or replace function public.admin_user(uid uuid) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at, 'banned_until', u.banned_until,
    'admin_role', (select role from public.admins where user_id = u.id),
    'entries', (select count(*) from public.entries where user_id = u.id and deleted_at is null),
    'entries_trash', (select count(*) from public.entries where user_id = u.id and deleted_at is not null),
    'categories', (select count(*) from public.categories where user_id = u.id),
    'first_entry_at', (select min(created_at) from public.entries where user_id = u.id),
    'last_entry_at', (select max(updated_at) from public.entries where user_id = u.id),
    'folders_owned', (select count(*) from public.folders where owner_id = u.id),
    'folders_joined', (select count(*) from public.folder_members where user_id = u.id and status = 'active' and role <> 'owner'),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s) - 'update_payment_url' - 'cancel_url' order by s.updated_at desc)
                               from public.subscriptions s where s.user_id = u.id), '[]'),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'action', action, 'by', admin_email, 'detail', detail) order by at desc)
                       from (select * from public.admin_audit where target_user = u.id order by at desc limit 20) a), '[]')
  )
  from auth.users u where u.id = uid
$$;

-- ---------- 구독 목록 ----------
drop function if exists public.admin_subscriptions(text, int, int);
create or replace function public.admin_subscriptions(st text default 'all', lim int default 50, off int default 0)
returns table (subscription_id text, user_id uuid, email text, status text, plan text, currency text,
               current_period_end timestamptz, cancel_at timestamptz, customer_id text, created_at timestamptz, updated_at timestamptz, total bigint)
language sql stable security definer set search_path = public, auth as $$
  select s.subscription_id, s.user_id, u.email::text, s.status, s.plan, s.currency, s.current_period_end, s.cancel_at,
         s.customer_id, s.created_at, s.updated_at, count(*) over () total
  from public.subscriptions s left join auth.users u on u.id = s.user_id
  where coalesce(st, 'all') = 'all' or s.status = st or (st = 'canceling' and s.cancel_at is not null and s.status <> 'canceled')
  order by s.updated_at desc
  limit least(greatest(lim, 1), 200) offset greatest(off, 0)
$$;

-- 위 함수들은 service role 전용
revoke execute on function public.admin_stats() from public, anon, authenticated;
revoke execute on function public.admin_users(text, text, int, int) from public, anon, authenticated;
revoke execute on function public.admin_user(uuid) from public, anon, authenticated;
revoke execute on function public.admin_subscriptions(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
grant execute on function public.admin_users(text, text, int, int) to service_role;
grant execute on function public.admin_user(uuid) to service_role;
grant execute on function public.admin_subscriptions(text, int, int) to service_role;

-- ---------- 첫 관리자 등록 (한 번만) ----------
-- 관리자 페이지에 쓸 계정으로 Kept에 먼저 가입한 뒤, 이메일을 바꿔서 아래 한 줄을 따로 실행하세요.
-- insert into public.admins (user_id, role) select id, 'owner' from auth.users where email = 'you@example.com' on conflict (user_id) do update set role = 'owner';
