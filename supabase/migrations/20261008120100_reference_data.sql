-- =============================================================================
-- CADASTROS DE APOIO: status operacionais, regiões, ramos, origens e gerentes.
-- Novos status/regiões/ramos/origens são linhas novas, sem migration estrutural.
-- Status NÃO têm categoria: nenhuma regra do sistema depende do status.
-- =============================================================================

-- Gatilho comum: organization_id vem da sessão quando há usuário autenticado.
create function private.set_organization_from_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is not null then
    new.organization_id := v_org;
  end if;
  if new.organization_id is null then
    raise exception 'Organização não identificada' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Status operacionais
-- -----------------------------------------------------------------------------

create table public.candidate_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default 'slate'
    check (color in ('slate', 'blue', 'violet', 'green', 'amber', 'orange', 'red', 'teal', 'pink')),
  position integer not null check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint candidate_statuses_position_uq unique (organization_id, position) deferrable initially immediate
);

create unique index candidate_statuses_org_name_uq on public.candidate_statuses (organization_id, lower(name));

-- -----------------------------------------------------------------------------
-- Listas simples (mesmo formato): regiões, ramos e origens/captação
-- -----------------------------------------------------------------------------

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index regions_org_name_uq on public.regions (organization_id, lower(name));

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index segments_org_name_uq on public.segments (organization_id, lower(name));

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index sources_org_name_uq on public.sources (organization_id, lower(name));

-- -----------------------------------------------------------------------------
-- Gerentes de indicação/destino (sem login no MVP)
-- -----------------------------------------------------------------------------

create table public.managers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text check (phone ~ '^\d{12,13}$'),
  email text check (email = lower(email)),
  is_active boolean not null default true,
  -- Reservado: gerente poderá virar usuário com login no futuro.
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index managers_org_name_uq on public.managers (organization_id, lower(name));

-- -----------------------------------------------------------------------------
-- Gatilhos, RLS e privilégios (mesmo padrão para as cinco tabelas)
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['candidate_statuses', 'regions', 'segments', 'sources', 'managers'] loop
    execute format(
      'create trigger %1$s_set_organization before insert on public.%1$I
         for each row execute function private.set_organization_from_session()', t);
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function private.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (organization_id = (select private.current_organization_id()))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (organization_id = (select private.current_organization_id()) and (select private.is_admin()))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (organization_id = (select private.current_organization_id()) and (select private.is_admin()))
         with check (organization_id = (select private.current_organization_id()))', t);
  end loop;
end;
$$;

-- Sem DELETE: itens deixam de ser usados com is_active = false (preserva o histórico).
grant insert (name, color, position, is_active), update (name, color, position, is_active)
  on public.candidate_statuses to authenticated;
grant insert (name, sort_order, is_active), update (name, sort_order, is_active)
  on public.regions, public.segments, public.sources to authenticated;
grant insert (name, phone, email, is_active), update (name, phone, email, is_active)
  on public.managers to authenticated;

-- -----------------------------------------------------------------------------
-- Dados padrão de cada nova organização
-- -----------------------------------------------------------------------------

create function private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_settings (organization_id) values (new.id);

  insert into public.candidate_statuses (organization_id, name, color, position)
  values
    (new.id, 'Seletiva', 'blue', 0),
    (new.id, 'Encaminhado', 'violet', 1),
    (new.id, 'Parceiro', 'green', 2),
    (new.id, 'Não está trabalhando', 'amber', 3),
    (new.id, 'Desistiu', 'red', 4),
    (new.id, 'Não retornou', 'slate', 5);

  insert into public.sources (organization_id, name, sort_order)
  values
    (new.id, 'Facebook', 0),
    (new.id, 'Instagram', 1),
    (new.id, 'WhatsApp', 2),
    (new.id, 'Indicação', 3),
    (new.id, 'Site', 4),
    (new.id, 'Outros', 5);

  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function private.handle_new_organization();
