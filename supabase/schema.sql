-- ============================================================================
-- VLČINCE – PASPORTIZÁCIA MOBILIÁRU A ZELENE
-- Supabase (PostgreSQL) – kompletná databázová schéma vrátane auth/profilov
-- ============================================================================

create extension if not exists postgis;

-- ----------------------------------------------------------------------------
-- ENUM typy
-- ----------------------------------------------------------------------------

create type asset_category as enum (
  'lavicka', 'kos', 'zelen_strom', 'zelen_kry', 'zelen_trvalka',
  'detsky_prvok', 'sportovy_prvok', 'osvetlenie', 'ine'
);

create type asset_condition as enum (
  'dobry', 'poskodeny', 'chybajuci', 'na_vymenu'
);

create type sync_source as enum (
  'terenny_zber', 'import', 'admin'
);

-- ----------------------------------------------------------------------------
-- Hlavná tabuľka aktív
-- ----------------------------------------------------------------------------

create table if not exists public.vlcince_assets (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  category           asset_category not null,
  subtype            text,
  condition          asset_condition not null default 'dobry',
  latitude           double precision not null check (latitude between -90 and 90),
  longitude          double precision not null check (longitude between -180 and 180),
  geom               geometry(Point, 4326)
                       generated always as (
                         st_setsrid(st_makepoint(longitude, latitude), 4326)
                       ) stored,
  gps_accuracy_m     numeric,
  note               text,
  photo_url          text,
  source             sync_source not null default 'terenny_zber',
  user_id            uuid references auth.users(id) on delete set null,
  device_local_id    text,
  constraint device_local_id_unique unique (device_local_id)
);

comment on table public.vlcince_assets is 'Pasport mobiliáru a zelene sídliska Vlčince';
comment on column public.vlcince_assets.device_local_id is 'Klientské UUID z IndexedDB – zabraňuje duplicitám pri synchronizácii';
comment on column public.vlcince_assets.user_id is 'Autor záznamu - viaže sa na auth.users, používa sa v RLS pre autor/admin práva';

create index if not exists idx_assets_category   on public.vlcince_assets (category);
create index if not exists idx_assets_condition   on public.vlcince_assets (condition);
create index if not exists idx_assets_created_at  on public.vlcince_assets (created_at desc);
create index if not exists idx_assets_geom        on public.vlcince_assets using gist (geom);
create index if not exists idx_assets_user_id     on public.vlcince_assets (user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assets_updated_at on public.vlcince_assets;
create trigger trg_assets_updated_at
  before update on public.vlcince_assets
  for each row execute function public.set_updated_at();

alter table public.vlcince_assets enable row level security;

-- ----------------------------------------------------------------------------
-- Profily používateľov
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_url      text,
  contact_email   text,
  contact_phone   text,
  show_contact    boolean not null default false,
  role            text not null default 'user' check (role in ('user', 'admin')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is 'Rozšírené profily používateľov - avatar, kontakt, rola (user/admin)';
comment on column public.profiles.role is 'user = bežný zberač, admin = plné práva nad všetkými záznamami';
comment on column public.profiles.show_contact is 'Ak true, kontaktné údaje sa zobrazujú verejne pri príspevkoch autora';

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatické vytvorenie profilu pri registrácii
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'používateľ'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pomocná funkcia - je aktuálny používateľ admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Ochrana pred sebe-povýšením role (len admin môže meniť role)
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_role_escalation on public.profiles;
create trigger trg_guard_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

alter table public.profiles enable row level security;

create policy "Verejné čítanie profilov"
  on public.profiles for select using (true);

create policy "Používateľ upravuje vlastný profil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admin upravuje akýkoľvek profil"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS politiky pre vlcince_assets: autor ALEBO admin
-- ----------------------------------------------------------------------------

create policy "Verejné čítanie"
  on public.vlcince_assets for select
  using (true);

create policy "Prihlásení vkladajú len pod vlastným ID"
  on public.vlcince_assets for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Autor alebo admin upravuje"
  on public.vlcince_assets for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "Autor alebo admin maže"
  on public.vlcince_assets for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- Storage buckets
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', true)
on conflict (id) do nothing;

create policy "Verejné čítanie fotiek"
  on storage.objects for select
  using (bucket_id = 'asset-photos');

create policy "Prihlásení môžu nahrávať fotky"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'asset-photos');

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Verejné čítanie avatarov"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Avatary sa ukladajú do priečinka pomenovaného podľa user_id, napr. avatars/<uuid>/photo.jpg
create policy "Používateľ nahráva vlastný avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Používateľ prepisuje vlastný avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- Pohľad pre štatistiky
-- ----------------------------------------------------------------------------

create or replace view public.vlcince_assets_stats
with (security_invoker = true) as
select category, condition, count(*) as pocet
from public.vlcince_assets
group by category, condition;

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.vlcince_assets;

-- ----------------------------------------------------------------------------
-- Povýšenie prvého admina (spusti ručne po registrácii, nahraď UUID)
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where id = '<TVOJE-USER-UUID>';

-- ----------------------------------------------------------------------------
-- História zmien stavu (audit trail)
-- ----------------------------------------------------------------------------

create table if not exists public.asset_status_history (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.vlcince_assets(id) on delete cascade,
  old_condition  asset_condition,
  new_condition  asset_condition not null,
  changed_by     uuid references public.profiles(id) on delete set null,
  changed_at     timestamptz not null default now()
);

comment on table public.asset_status_history is 'Auditná história zmien stavu - zapisuje sa výhradne cez trigger, nie priamym insertom';

create index if not exists idx_status_history_asset on public.asset_status_history (asset_id, changed_at desc);

alter table public.asset_status_history enable row level security;

create policy "Verejné čítanie histórie"
  on public.asset_status_history for select using (true);

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.asset_status_history (asset_id, old_condition, new_condition, changed_by)
    values (new.id, null, new.condition, new.user_id);
  elsif tg_op = 'UPDATE' and new.condition is distinct from old.condition then
    insert into public.asset_status_history (asset_id, old_condition, new_condition, changed_by)
    values (new.id, old.condition, new.condition, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_status_change on public.vlcince_assets;
create trigger trg_log_status_change
  after insert or update on public.vlcince_assets
  for each row execute function public.log_status_change();

-- ----------------------------------------------------------------------------
-- Komentáre k záznamom (diskusia)
-- ----------------------------------------------------------------------------

create table if not exists public.asset_comments (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.vlcince_assets(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(trim(content)) between 1 and 500),
  created_at  timestamptz not null default now()
);

comment on table public.asset_comments is 'Diskusné komentáre k jednotlivým záznamom mobiliáru/zelene';

create index if not exists idx_comments_asset on public.asset_comments (asset_id, created_at);

alter table public.asset_comments enable row level security;

create policy "Verejné čítanie komentárov"
  on public.asset_comments for select using (true);

create policy "Prihlásení pridávajú komentáre pod vlastným menom"
  on public.asset_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Autor alebo admin maže komentár"
  on public.asset_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

alter publication supabase_realtime add table public.asset_comments;

-- ----------------------------------------------------------------------------
-- Debounce push notifikácií - zabraňuje zaplaveniu pri hromadných admin akciách
-- ----------------------------------------------------------------------------

create table if not exists public.notification_debounce (
  id            int primary key default 1,
  last_sent_at  timestamptz
);
insert into public.notification_debounce (id, last_sent_at) values (1, null)
on conflict (id) do nothing;

-- (aktuálna verzia notify_admins_on_critical_status s debounce logikou je vyššie
--  nahradená - pozri poslednú definíciu funkcie v tomto súbore ako zdroj pravdy
--  pri reprodukovaní schémy od začiatku)

-- ============================================================================
-- v2.0: viacnasobne fotky, konfigurovatelne kategorie/stavy, onboarding
-- ============================================================================
-- Pozri plnu migraciu vo verzii nasadenej v Supabase (migration: v2_multi_photos_configurable_taxonomy).
-- Struktura: asset_photos (viacnasobne fotky), categories + conditions (nahradaju enumy,
-- FK z vlcince_assets.category/condition), profiles.has_seen_onboarding, DELETE policy
-- pre asset-photos storage.
