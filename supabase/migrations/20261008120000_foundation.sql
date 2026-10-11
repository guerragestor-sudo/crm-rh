-- =============================================================================
-- FUNDAÇÃO: extensões, schema privado, organizações, perfis e membros.
-- Convenções: text + CHECK (sem ENUM), timestamptz para momentos, date para
-- datas civis, UNIQUE (organization_id, id) + FK composta entre tabelas de
-- negócio, funções SECURITY DEFINER só no schema private com search_path = ''.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- As políticas de RLS chamam funções do schema private; o schema não é exposto pela API.
grant usage on schema private to authenticated, service_role;

-- Funções novas não ficam executáveis por PUBLIC/anon: cada uma recebe GRANT explícito.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

create function private.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organizações
-- -----------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  -- Meta de SLA em dias. Sem valor no MVP; preparado para configuração futura.
  sla_target_days integer check (sla_target_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger organization_settings_validate_timezone
  before insert or update of timezone on public.organization_settings
  for each row execute function private.validate_timezone();

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users) e membros (vínculo usuário ↔ organização)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  -- Papéis futuros (director, manager, supervisor, client) entram como novos valores.
  role text not null check (role in ('admin', 'recruiter')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- MVP: um usuário pertence a uma única organização.
  unique (user_id)
);

create index organization_members_organization_idx on public.organization_members (organization_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Identidade da sessão (usadas pelas políticas de RLS)
-- -----------------------------------------------------------------------------

create function private.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create function private.current_member_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_member_role()) = 'admin', false)
$$;

create function private.org_timezone(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.timezone from public.organization_settings s where s.organization_id = p_organization_id),
    'America/Sao_Paulo'
  )
$$;

create function private.org_today(p_organization_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone private.org_timezone(p_organization_id))::date
$$;

-- -----------------------------------------------------------------------------
-- RLS e privilégios
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

revoke all on public.organizations, public.organization_settings, public.profiles,
  public.organization_members from anon, authenticated;
grant all on public.organizations, public.organization_settings, public.profiles,
  public.organization_members to service_role;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated
  using (id = (select private.current_organization_id()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (id = (select private.current_organization_id()) and (select private.is_admin()))
  with check (id = (select private.current_organization_id()));

grant select on public.organization_settings to authenticated;
grant update (timezone, sla_target_days) on public.organization_settings to authenticated;

create policy organization_settings_select on public.organization_settings
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy organization_settings_update on public.organization_settings
  for update to authenticated
  using (organization_id = (select private.current_organization_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_organization_id()));

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.organization_members m
      where m.user_id = profiles.id
        and m.organization_id = (select private.current_organization_id())
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.organization_members to authenticated;
grant update (role, status) on public.organization_members to authenticated;

create policy organization_members_select on public.organization_members
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (organization_id = (select private.current_organization_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_organization_id()));

grant execute on function
  private.f_unaccent(text),
  private.current_member_id(),
  private.current_organization_id(),
  private.current_member_role(),
  private.is_admin(),
  private.org_timezone(uuid),
  private.org_today(uuid)
to authenticated, service_role;
