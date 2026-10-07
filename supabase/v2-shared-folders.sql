-- =====================================================================
-- Kept v2 — 공유 폴더 (shared folders)
-- Supabase → SQL Editor에 전체를 붙여 넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 전제 (v1 schema.sql 원본이 없어 앱 코드와 README에서 추정한 내용):
--   public.entries    : id uuid PK, user_id uuid (기본값 auth.uid(), RLS user_id = auth.uid()),
--                       version / updated_at 을 올리는 BEFORE UPDATE 트리거, 소유자를 강제하는 트리거
--   public.categories, public.deleted_records, public.user_settings, rpc delete_my_account
-- 이 파일은 기존 테이블·정책을 지우거나 바꾸지 않습니다. 새 테이블과 "추가" 정책만 만듭니다.
-- (Postgres RLS의 permissive 정책은 OR로 합쳐지므로 기존 "내 것만" 정책은 그대로 동작합니다.)
--
-- 모델
--   folders         공유 폴더. 만든 사람이 owner.
--   folder_members  폴더 멤버. 초대는 이메일로 만들고(status = invited), 그 이메일로 로그인한
--                   사람이 수락하면 active. 역할: owner / editor(보기·쓰기) / viewer(보기만)
--   entries.folder_id  기록을 공유할 폴더. null = 나만 보기(기본값)
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists folders_owner_idx on public.folders(owner_id);

create table if not exists public.folder_members (
  folder_id   uuid not null references public.folders(id) on delete cascade,
  email       text not null check (email = lower(email) and char_length(email) between 3 and 320),
  user_id     uuid references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  status      text not null default 'invited' check (status in ('invited', 'active')),
  invited_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (folder_id, email)
);
create index if not exists folder_members_user_idx on public.folder_members(user_id) where status = 'active';
create index if not exists folder_members_email_idx on public.folder_members(email) where status = 'invited';

alter table public.entries add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists entries_folder_idx on public.entries(folder_id, updated_at) where folder_id is not null;

alter table public.folders enable row level security;
alter table public.folder_members enable row level security;

-- ---------- helpers (security definer: policies call them without recursing into RLS) ----------
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.folder_role(f uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.folder_members where folder_id = f and user_id = auth.uid() and status = 'active'
$$;

create or replace function public.folder_invited(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.folder_members where folder_id = f and status = 'invited' and email = public.my_email())
$$;

-- ---------- limits ----------
-- 무료 기준: 한 사람이 만드는 폴더 20개, 폴더당 멤버(초대 포함) 30명. 구독 단계에서 조정할 수 있습니다.
create or replace function public.folders_limits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'folders' then
    if (select count(*) from public.folders where owner_id = new.owner_id) >= 20 then
      raise exception 'folder limit reached' using errcode = 'P0001';
    end if;
  else
    if (select count(*) from public.folder_members where folder_id = new.folder_id) >= 30 then
      raise exception 'member limit reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists folders_limits on public.folders;
create trigger folders_limits before insert on public.folders for each row execute function public.folders_limits();
drop trigger if exists folder_members_limits on public.folder_members;
create trigger folder_members_limits before insert on public.folder_members for each row execute function public.folders_limits();

-- ---------- folder bookkeeping ----------
-- the creator becomes the owner member; owner_id can never change
create or replace function public.folders_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(auth.uid(), new.owner_id);
    new.created_at := now();
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists folders_owner on public.folders;
create trigger folders_owner before insert or update on public.folders for each row execute function public.folders_owner();

create or replace function public.folders_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.folder_members (folder_id, email, user_id, role, status, invited_by)
  values (new.id, coalesce(nullif(public.my_email(), ''), new.owner_id::text), new.owner_id, 'owner', 'active', new.owner_id)
  on conflict (folder_id, email) do update set user_id = excluded.user_id, role = 'owner', status = 'active';
  return new;
end $$;
drop trigger if exists folders_add_owner on public.folders;
create trigger folders_add_owner after insert on public.folders for each row execute function public.folders_add_owner();

-- ---------- policies: folders ----------
drop policy if exists "folders: members read" on public.folders;
create policy "folders: members read" on public.folders for select
  using (owner_id = auth.uid() or public.folder_role(id) is not null or public.folder_invited(id));
drop policy if exists "folders: create own" on public.folders;
create policy "folders: create own" on public.folders for insert
  with check (owner_id = auth.uid());
drop policy if exists "folders: owner edits" on public.folders;
create policy "folders: owner edits" on public.folders for update
  using (public.folder_role(id) = 'owner') with check (public.folder_role(id) = 'owner');
drop policy if exists "folders: owner deletes" on public.folders;
create policy "folders: owner deletes" on public.folders for delete
  using (owner_id = auth.uid());

-- ---------- policies: folder_members ----------
drop policy if exists "members: folder reads" on public.folder_members;
create policy "members: folder reads" on public.folder_members for select
  using (public.folder_role(folder_id) is not null or email = public.my_email());
drop policy if exists "members: owner invites" on public.folder_members;
create policy "members: owner invites" on public.folder_members for insert
  with check (public.folder_role(folder_id) = 'owner' and role in ('editor', 'viewer'));
drop policy if exists "members: owner sets role" on public.folder_members;
create policy "members: owner sets role" on public.folder_members for update
  using (public.folder_role(folder_id) = 'owner') with check (public.folder_role(folder_id) = 'owner');
drop policy if exists "members: owner removes or self leaves" on public.folder_members;
create policy "members: owner removes or self leaves" on public.folder_members for delete
  using (role <> 'owner' and (public.folder_role(folder_id) = 'owner' or email = public.my_email() or user_id = auth.uid()));

-- ---------- policies: entries (added next to the existing "own rows" policies) ----------
drop policy if exists "entries: folder members read" on public.entries;
create policy "entries: folder members read" on public.entries for select
  using (folder_id is not null and public.folder_role(folder_id) is not null);
drop policy if exists "entries: folder editors update" on public.entries;
create policy "entries: folder editors update" on public.entries for update
  using (folder_id is not null and public.folder_role(folder_id) in ('owner', 'editor'))
  with check (folder_id is not null and public.folder_role(folder_id) in ('owner', 'editor'));
-- deleting a row stays owner-only (the existing policy); editors can move a record to the trash (deleted_at)

-- an entry can only be put into a folder where you can write, and an editor never takes over someone's record.
-- named zz_ so it runs after the v1 triggers (BEFORE triggers fire in name order) and has the last word on user_id.
create or replace function public.zz_entries_folder_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;
  if auth.uid() is not null and new.folder_id is not null
     and (tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id)
     and coalesce(public.folder_role(new.folder_id), '') not in ('owner', 'editor') then
    raise exception 'no write access to this folder' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists zz_entries_folder_guard on public.entries;
create trigger zz_entries_folder_guard before insert or update on public.entries for each row execute function public.zz_entries_folder_guard();

-- ---------- rpc ----------
-- invites waiting for the signed-in user's email
create or replace function public.my_folder_invites()
returns table (folder_id uuid, name text, color text, role text, invited_by_email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.folder_id, f.name, f.color, m.role,
         (select o.email from public.folder_members o where o.folder_id = m.folder_id and o.user_id = m.invited_by limit 1),
         m.created_at
  from public.folder_members m join public.folders f on f.id = m.folder_id
  where m.status = 'invited' and m.email = public.my_email()
  order by m.created_at desc
$$;

create or replace function public.accept_folder_invite(f uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_email();
begin
  if auth.uid() is null or me = '' then raise exception 'sign in first'; end if;
  update public.folder_members set user_id = auth.uid(), status = 'active', updated_at = now()
   where folder_id = f and email = me and status = 'invited';
  if not found then raise exception 'invite not found'; end if;
end $$;

-- members: invites start as 'invited' with no user, the owner row is fixed, and the only way to become
-- active is the invited person accepting (accept_folder_invite)
create or replace function public.folder_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.email := lower(btrim(new.email));
    if new.role = 'owner' and not exists (select 1 from public.folders where id = new.folder_id and owner_id = new.user_id) then
      raise exception 'only the folder creator is owner';
    end if;
    if new.role <> 'owner' then new.status := 'invited'; new.user_id := null; end if;
    new.invited_by := auth.uid();
  else
    new.folder_id := old.folder_id; new.email := old.email; new.invited_by := old.invited_by; new.created_at := old.created_at;
    if old.role = 'owner' or new.role = 'owner' then new.role := old.role; end if;
    if new.user_id is distinct from old.user_id or new.status is distinct from old.status then
      -- only an invite → active change by the invited person themselves is allowed
      if not (old.status = 'invited' and new.status = 'active' and new.user_id = auth.uid() and old.email = public.my_email()) then
        new.user_id := old.user_id; new.status := old.status;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists folder_members_guard on public.folder_members;
create trigger folder_members_guard before insert or update on public.folder_members for each row execute function public.folder_members_guard();

grant execute on function public.my_folder_invites() to authenticated;
grant execute on function public.accept_folder_invite(uuid) to authenticated;
grant execute on function public.folder_role(uuid) to authenticated;
grant execute on function public.folder_invited(uuid) to authenticated;
grant execute on function public.my_email() to authenticated;
grant select, insert, update, delete on public.folders, public.folder_members to authenticated;

-- 끝. 앱은 이 테이블이 있는지 스스로 확인하고, 없으면 공유 기능만 숨긴 채 기존처럼 동작합니다.
