-- =====================================================================
-- Kept v2 — 정기구독 (Paddle Billing)
-- Supabase → SQL Editor에 전체를 붙여 넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- 구독 내역은 Edge Function paddle-webhook만 씁니다(service role). 앱은 자기 구독을 읽기만 합니다.
-- =====================================================================
create table if not exists public.subscriptions (
  subscription_id     text primary key,                       -- Paddle sub_…
  user_id             uuid references auth.users(id) on delete cascade,
  customer_id         text,                                   -- Paddle ctm_…
  status              text not null,                          -- active · trialing · past_due · paused · canceled
  plan                text check (plan in ('monthly', 'yearly')),
  price_id            text,
  currency            text,
  current_period_end  timestamptz,
  cancel_at           timestamptz,                            -- scheduled cancel (ends at period end)
  update_payment_url  text,
  cancel_url          text,
  event_at            timestamptz,                            -- Paddle occurred_at of the last applied event
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, updated_at desc);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions for select using (user_id = auth.uid());
-- no insert/update/delete policies: only the service role (the webhook) writes
grant select on public.subscriptions to authenticated;

-- one place to ask "is this account a subscriber?" — use it in RLS or limits later if paid perks are added
create or replace function public.is_subscriber(u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions where user_id = u and status in ('active', 'trialing', 'past_due'))
$$;
grant execute on function public.is_subscriber(uuid) to authenticated;
