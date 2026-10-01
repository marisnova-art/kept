-- =====================================================================
--  Kept — Supabase schema
--  Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--  Every table is locked down with Row Level Security: a signed-in user
--  can only ever read or write rows where user_id = auth.uid().
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------- categories ----------
create table if not exists public.categories (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 60),
  color              text not null default '#ff6a2b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort               int  not null default 0,
  created_at         timestamptz not null default now(),
  client_updated_at  timestamptz,
  updated_at         timestamptz not null default now(),   -- server clock, used as sync cursor
  version            int  not null default 1
);
create index if not exists categories_user_updated on public.categories (user_id, updated_at);

-- ---------- entries (every kind of record) ----------
create table if not exists public.entries (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type               text not null default 'note' check (char_length(type) between 1 and 40),
  title              text not null default '' check (char_length(title) <= 300),
  content            text not null default '' check (char_length(content) <= 200000),   -- sanitized rich-text HTML
  content_text       text not null default '' check (char_length(content_text) <= 200000),
  category_id        uuid references public.categories(id) on delete set null,
  tags               text[] not null default '{}' check (cardinality(tags) <= 30),
  favorite           boolean not null default false,
  pinned             boolean not null default false,
  meta               jsonb not null default '{}'::jsonb check (pg_column_size(meta) <= 8192),
  created_at         timestamptz not null default now(),
  client_updated_at  timestamptz,
  deleted_at         timestamptz,                          -- soft delete (trash)
  updated_at         timestamptz not null default now(),   -- server clock, used as sync cursor
  version            int  not null default 1               -- optimistic concurrency
);
create index if not exists entries_user_updated on public.entries (user_id, updated_at);
create index if not exists entries_user_type    on public.entries (user_id, type) where deleted_at is null;
create index if not exists entries_user_cat     on public.entries (user_id, category_id);
create index if not exists entries_tags_gin     on public.entries using gin (tags);
create index if not exists entries_trgm_title   on public.entries using gin (title gin_trgm_ops);
create index if not exists entries_trgm_text    on public.entries using gin (content_text gin_trgm_ops);

-- ---------- per-user settings ----------
create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb check (pg_column_size(prefs) <= 65536),
  updated_at timestamptz not null default now()
);

-- ---------- tombstones so other devices learn about permanent deletes ----------
create table if not exists public.deleted_records (
  record_id  uuid not null,
  table_name text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (table_name, record_id)
);
create index if not exists deleted_records_user on public.deleted_records (user_id, deleted_at);

-- ---------- voluntary support history (written ONLY by a server webhook) ----------
create table if not exists public.donations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  provider    text not null,
  provider_ref text unique,
  provider_customer text,
  kind        text not null check (kind in ('once','monthly')),
  amount      numeric(12,2) not null check (amount > 0),
  currency    text not null default 'USD',
  status      text not null default 'paid',
  created_at  timestamptz not null default now()
);

-- maps a payment-provider customer to an account (service role only, no client access)
create table if not exists public.donation_customers (
  provider_customer text primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);

-- =====================================================================
--  Triggers: server-owned columns can't be forged by clients
-- =====================================================================
create or replace function public.kept_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.version := 1;
  else
    new.user_id := old.user_id;            -- ownership can never change
    new.version := old.version + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries for each row execute function public.kept_touch();
drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before insert or update on public.categories for each row execute function public.kept_touch();

create or replace function public.kept_tombstone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.deleted_records (record_id, table_name, user_id, deleted_at)
  values (old.id, tg_table_name, old.user_id, clock_timestamp())
  on conflict (table_name, record_id) do update set deleted_at = excluded.deleted_at;
  return old;
end $$;
drop trigger if exists entries_tomb on public.entries;
create trigger entries_tomb after delete on public.entries for each row execute function public.kept_tombstone();
drop trigger if exists categories_tomb on public.categories;
create trigger categories_tomb after delete on public.categories for each row execute function public.kept_tombstone();

-- category must belong to the same user
create or replace function public.kept_check_category() returns trigger language plpgsql as $$
begin
  if new.category_id is not null and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
    new.category_id := null;
  end if;
  return new;
end $$;
drop trigger if exists entries_cat_owner on public.entries;
create trigger entries_cat_owner before insert or update of category_id on public.entries for each row execute function public.kept_check_category();

-- fair-use quotas (keeps a free service affordable — adjust to your budget)
create or replace function public.kept_quota() returns trigger language plpgsql as $$
declare n int;
begin
  if tg_table_name = 'entries' then
    select count(*) into n from public.entries where user_id = auth.uid();
    if n >= 20000 then raise exception 'Record limit reached (20000)'; end if;
  else
    select count(*) into n from public.categories where user_id = auth.uid();
    if n >= 200 then raise exception 'Category limit reached (200)'; end if;
  end if;
  return new;
end $$;
drop trigger if exists entries_quota on public.entries;
create trigger entries_quota before insert on public.entries for each row execute function public.kept_quota();
drop trigger if exists categories_quota on public.categories;
create trigger categories_quota before insert on public.categories for each row execute function public.kept_quota();

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.entries         enable row level security;
alter table public.categories      enable row level security;
alter table public.user_settings   enable row level security;
alter table public.deleted_records enable row level security;
alter table public.donations       enable row level security;
alter table public.donation_customers enable row level security;   -- no policies = no client access

do $$ begin
  -- entries
  drop policy if exists "own entries select" on public.entries;
  drop policy if exists "own entries insert" on public.entries;
  drop policy if exists "own entries update" on public.entries;
  drop policy if exists "own entries delete" on public.entries;
  create policy "own entries select" on public.entries for select to authenticated using (user_id = auth.uid());
  create policy "own entries insert" on public.entries for insert to authenticated with check (user_id = auth.uid());
  create policy "own entries update" on public.entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "own entries delete" on public.entries for delete to authenticated using (user_id = auth.uid());
  -- categories
  drop policy if exists "own categories select" on public.categories;
  drop policy if exists "own categories insert" on public.categories;
  drop policy if exists "own categories update" on public.categories;
  drop policy if exists "own categories delete" on public.categories;
  create policy "own categories select" on public.categories for select to authenticated using (user_id = auth.uid());
  create policy "own categories insert" on public.categories for insert to authenticated with check (user_id = auth.uid());
  create policy "own categories update" on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "own categories delete" on public.categories for delete to authenticated using (user_id = auth.uid());
  -- settings
  drop policy if exists "own settings all" on public.user_settings;
  create policy "own settings all" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  -- tombstones: read-only for the owner (written by trigger)
  drop policy if exists "own tombstones select" on public.deleted_records;
  create policy "own tombstones select" on public.deleted_records for select to authenticated using (user_id = auth.uid());
  -- donations: read-only for the owner (written by the webhook with the service role)
  drop policy if exists "own donations select" on public.donations;
  create policy "own donations select" on public.donations for select to authenticated using (user_id = auth.uid());
end $$;

-- the anon role gets nothing
revoke all on public.entries, public.categories, public.user_settings, public.deleted_records, public.donations, public.donation_customers from anon;
revoke all on public.donation_customers from authenticated;
grant select, insert, update, delete on public.entries, public.categories, public.user_settings to authenticated;
grant select on public.deleted_records, public.donations to authenticated;

-- =====================================================================
--  Account deletion (called from Settings → Delete account)
-- =====================================================================
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.entries         where user_id = uid;
  delete from public.categories      where user_id = uid;
  delete from public.user_settings   where user_id = uid;
  delete from public.donations       where user_id = uid;
  delete from public.donation_customers where user_id = uid;
  delete from public.deleted_records where user_id = uid;
  delete from auth.users             where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- housekeeping: tombstones older than 90 days are no longer needed
-- (schedule with pg_cron if available:  select cron.schedule('kept-tombs','0 4 * * *',$$delete from public.deleted_records where deleted_at < now() - interval '90 days'$$);)
