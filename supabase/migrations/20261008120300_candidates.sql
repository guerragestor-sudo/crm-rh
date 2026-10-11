-- =============================================================================
-- CANDIDATOS + HISTÓRICO (auditoria imutável da ficha)
--
-- Regras garantidas no banco:
--  * organization_id, autor e datas de criação vêm da sessão (nunca do cliente);
--  * CPF único por organização (bloqueia); telefone/e-mail só geram aviso (app);
--  * status_id e manager_id só mudam pelas RPCs change_candidate_status /
--    change_candidate_manager (GRANT de UPDATE por coluna os exclui);
--  * SLA congelado em sla_days_frozen quando integration_date é preenchida;
--  * todo evento relevante gera linha em candidate_history (via trigger).
-- =============================================================================

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,

  -- Dados pessoais e contato (normalizados: só dígitos / minúsculas)
  full_name text not null check (char_length(btrim(full_name)) between 2 and 150),
  phone text check (phone ~ '^\d{12,13}$'),
  email text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cpf text check (cpf ~ '^\d{11}$'),

  -- Perfil
  region_id uuid,
  segment_id uuid,
  availability text check (availability in ('immediate', 'up_to_15_days', 'up_to_30_days', 'to_negotiate')),
  currently_working boolean,
  source_id uuid,

  -- Processo
  manager_id uuid,
  notes text check (char_length(notes) <= 5000),
  status_id uuid not null,
  status_changed_at timestamptz not null default now(),
  interview_at timestamptz,
  integration_date date,
  documentation_status text not null default 'pending'
    check (documentation_status in ('pending', 'in_progress', 'complete')),
  documentation_notes text check (char_length(documentation_notes) <= 2000),
  course_status text not null default 'not_started'
    check (course_status in ('not_started', 'in_progress', 'completed')),
  course_notes text check (char_length(course_notes) <= 2000),

  -- SLA congelado na integração (dias civis no fuso da organização)
  sla_days_frozen integer check (sla_days_frozen >= 0),
  sla_frozen_at timestamptz,

  -- Controle
  responsible_member_id uuid not null,
  archived_at timestamptz,
  archived_by_member_id uuid,
  created_by_member_id uuid,
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  search_text text generated always as (
    private.f_unaccent(lower(
      full_name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(cpf, '')
    ))
  ) stored,

  unique (organization_id, id),
  constraint candidates_contact_ck check (phone is not null or email is not null),
  constraint candidates_sla_frozen_ck check ((integration_date is null) = (sla_days_frozen is null)),

  foreign key (organization_id, region_id) references public.regions (organization_id, id),
  foreign key (organization_id, segment_id) references public.segments (organization_id, id),
  foreign key (organization_id, source_id) references public.sources (organization_id, id),
  foreign key (organization_id, manager_id) references public.managers (organization_id, id),
  foreign key (organization_id, status_id) references public.candidate_statuses (organization_id, id),
  foreign key (organization_id, responsible_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, archived_by_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, created_by_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, updated_by_member_id) references public.organization_members (organization_id, id)
);

create unique index candidates_org_cpf_uq on public.candidates (organization_id, cpf) where cpf is not null;
create index candidates_org_phone_idx on public.candidates (organization_id, phone) where phone is not null;
create index candidates_org_email_idx on public.candidates (organization_id, email) where email is not null;
create index candidates_org_status_idx on public.candidates (organization_id, status_id);
create index candidates_org_manager_idx on public.candidates (organization_id, manager_id);
create index candidates_org_region_idx on public.candidates (organization_id, region_id);
create index candidates_org_source_idx on public.candidates (organization_id, source_id);
create index candidates_org_segment_idx on public.candidates (organization_id, segment_id);
create index candidates_org_created_idx on public.candidates (organization_id, created_at desc);
create index candidates_org_integration_idx on public.candidates (organization_id, integration_date);
create index candidates_search_trgm_idx on public.candidates using gin (search_text extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Histórico
-- -----------------------------------------------------------------------------

create table public.candidate_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  candidate_id uuid not null,
  actor_member_id uuid,
  action text not null check (action in (
    'created', 'updated', 'status_changed', 'manager_changed', 'responsible_changed',
    'interview_changed', 'integration_changed', 'archived', 'restored',
    'task_created', 'task_completed', 'task_cancelled', 'task_reopened', 'task_rescheduled',
    'document_uploaded', 'document_replaced'
  )),
  field text,
  old_value text,
  new_value text,
  reason text check (char_length(reason) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (organization_id, candidate_id) references public.candidates (organization_id, id),
  foreign key (organization_id, actor_member_id) references public.organization_members (organization_id, id)
);

create index candidate_history_candidate_idx on public.candidate_history (candidate_id, created_at desc, id desc);
create index candidate_history_org_idx on public.candidate_history (organization_id, created_at desc);

create function private.add_candidate_history(
  p_organization_id uuid,
  p_candidate_id uuid,
  p_action text,
  p_field text default null,
  p_old_value text default null,
  p_new_value text default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.candidate_history (
    organization_id, candidate_id, actor_member_id, action, field, old_value, new_value, reason, metadata
  )
  values (
    p_organization_id, p_candidate_id, private.current_member_id(), p_action, p_field,
    p_old_value, p_new_value, nullif(btrim(p_reason), ''), coalesce(p_metadata, '{}'::jsonb)
  );
$$;

create function private.mask_cpf(p_cpf text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_cpf is null then null
              else substr(p_cpf, 1, 3) || '.***.***-' || substr(p_cpf, 10, 2) end
$$;

-- -----------------------------------------------------------------------------
-- Gatilhos BEFORE (ordem alfabética: 10 → 20 → 30)
-- -----------------------------------------------------------------------------

create function private.candidates_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
begin
  -- Com sessão, autor e datas vêm do servidor. Sem sessão (seed/scripts), mantém o informado.
  if v_member is not null then
    new.created_at := now();
    new.created_by_member_id := v_member;
    new.responsible_member_id := coalesce(new.responsible_member_id, v_member);
    new.archived_at := null;
    new.archived_by_member_id := null;
  end if;
  new.updated_at := new.created_at;
  new.updated_by_member_id := new.created_by_member_id;
  new.status_changed_at := new.created_at;
  return new;
end;
$$;

create function private.candidates_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.organization_id := old.organization_id;
  new.created_at := old.created_at;
  new.created_by_member_id := old.created_by_member_id;
  new.updated_at := now();
  new.updated_by_member_id := coalesce(private.current_member_id(), new.updated_by_member_id);
  if new.status_id is distinct from old.status_id then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create function private.candidates_freeze_sla()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tz text;
  v_days integer;
begin
  if new.integration_date is null then
    new.sla_days_frozen := null;
    new.sla_frozen_at := null;
    return new;
  end if;

  -- Mesma data de integração: o valor congelado não muda.
  if tg_op = 'UPDATE' and new.integration_date is not distinct from old.integration_date then
    new.sla_days_frozen := old.sla_days_frozen;
    new.sla_frozen_at := old.sla_frozen_at;
    return new;
  end if;

  v_tz := private.org_timezone(new.organization_id);
  if new.integration_date > (now() at time zone v_tz)::date then
    raise exception 'A data de integração não pode ser futura' using errcode = '23514';
  end if;

  v_days := new.integration_date - (new.created_at at time zone v_tz)::date;
  if v_days < 0 then
    raise exception 'A data de integração não pode ser anterior à data de cadastro' using errcode = '23514';
  end if;

  new.sla_days_frozen := v_days;
  new.sla_frozen_at := now();
  return new;
end;
$$;

create trigger candidates_10_set_organization
  before insert on public.candidates
  for each row execute function private.set_organization_from_session();

create trigger candidates_20_before_insert
  before insert on public.candidates
  for each row execute function private.candidates_before_insert();

create trigger candidates_20_before_update
  before update on public.candidates
  for each row execute function private.candidates_before_update();

create trigger candidates_30_freeze_sla
  before insert or update on public.candidates
  for each row execute function private.candidates_freeze_sla();

-- -----------------------------------------------------------------------------
-- Gatilho AFTER: histórico
-- -----------------------------------------------------------------------------

create function private.log_candidate_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(current_setting('app.change_reason', true), '')), '');
  v_tz text := private.org_timezone(new.organization_id);
  v_old jsonb;
  v_new jsonb;
  v_field text;
  v_old_value text;
  v_new_value text;
begin
  if tg_op = 'INSERT' then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'created', 'status', null,
      (select s.name from public.candidate_statuses s where s.id = new.status_id),
      null,
      jsonb_build_object(
        'status_id', new.status_id,
        'manager_id', new.manager_id,
        'manager_name', (select m.name from public.managers m where m.id = new.manager_id)
      )
    );
    return new;
  end if;

  if new.status_id is distinct from old.status_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'status_changed', 'status',
      (select s.name from public.candidate_statuses s where s.id = old.status_id),
      (select s.name from public.candidate_statuses s where s.id = new.status_id),
      v_reason,
      jsonb_build_object('old_id', old.status_id, 'new_id', new.status_id)
    );
  end if;

  if new.manager_id is distinct from old.manager_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'manager_changed', 'manager',
      (select m.name from public.managers m where m.id = old.manager_id),
      (select m.name from public.managers m where m.id = new.manager_id),
      v_reason,
      jsonb_build_object('old_id', old.manager_id, 'new_id', new.manager_id)
    );
  end if;

  if new.responsible_member_id is distinct from old.responsible_member_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'responsible_changed', 'responsible',
      (select p.full_name from public.organization_members m join public.profiles p on p.id = m.user_id
        where m.id = old.responsible_member_id),
      (select p.full_name from public.organization_members m join public.profiles p on p.id = m.user_id
        where m.id = new.responsible_member_id),
      null,
      jsonb_build_object('old_id', old.responsible_member_id, 'new_id', new.responsible_member_id)
    );
  end if;

  if new.interview_at is distinct from old.interview_at then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'interview_changed', 'interview_at',
      to_char(old.interview_at at time zone v_tz, 'DD/MM/YYYY HH24:MI'),
      to_char(new.interview_at at time zone v_tz, 'DD/MM/YYYY HH24:MI')
    );
  end if;

  if new.integration_date is distinct from old.integration_date then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'integration_changed', 'integration_date',
      to_char(old.integration_date, 'DD/MM/YYYY'),
      to_char(new.integration_date, 'DD/MM/YYYY'),
      null,
      jsonb_build_object('sla_days_frozen', new.sla_days_frozen)
    );
  end if;

  if new.archived_at is distinct from old.archived_at then
    perform private.add_candidate_history(
      new.organization_id, new.id,
      case when new.archived_at is null then 'restored' else 'archived' end
    );
  end if;

  if new.region_id is distinct from old.region_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'updated', 'region',
      (select r.name from public.regions r where r.id = old.region_id),
      (select r.name from public.regions r where r.id = new.region_id)
    );
  end if;

  if new.segment_id is distinct from old.segment_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'updated', 'segment',
      (select s.name from public.segments s where s.id = old.segment_id),
      (select s.name from public.segments s where s.id = new.segment_id)
    );
  end if;

  if new.source_id is distinct from old.source_id then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'updated', 'source',
      (select s.name from public.sources s where s.id = old.source_id),
      (select s.name from public.sources s where s.id = new.source_id)
    );
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  foreach v_field in array array[
    'full_name', 'phone', 'email', 'cpf', 'availability', 'currently_working', 'notes',
    'documentation_status', 'documentation_notes', 'course_status', 'course_notes'
  ] loop
    v_old_value := v_old ->> v_field;
    v_new_value := v_new ->> v_field;
    if v_old_value is distinct from v_new_value then
      if v_field = 'cpf' then
        v_old_value := private.mask_cpf(v_old_value);
        v_new_value := private.mask_cpf(v_new_value);
      end if;
      perform private.add_candidate_history(
        new.organization_id, new.id, 'updated', v_field, left(v_old_value, 500), left(v_new_value, 500)
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger candidates_90_history
  after insert or update on public.candidates
  for each row execute function private.log_candidate_changes();

-- -----------------------------------------------------------------------------
-- RPCs: status, gerente e arquivamento
-- -----------------------------------------------------------------------------

create function private.change_candidate_status(p_candidate_id uuid, p_status_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'O motivo deve ter no máximo 500 caracteres' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.candidate_statuses s
    where s.id = p_status_id and s.organization_id = v_org and s.is_active
  ) then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', coalesce(p_reason, ''), true);

  update public.candidates c
     set status_id = p_status_id
   where c.id = p_candidate_id
     and c.organization_id = v_org
     and c.archived_at is null;

  if not found then
    raise exception 'Candidato não encontrado' using errcode = 'P0002';
  end if;

  perform set_config('app.change_reason', '', true);
end;
$$;

create function private.change_candidate_manager(p_candidate_id uuid, p_manager_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'O motivo deve ter no máximo 500 caracteres' using errcode = '22023';
  end if;
  if p_manager_id is not null and not exists (
    select 1 from public.managers m
    where m.id = p_manager_id and m.organization_id = v_org and m.is_active
  ) then
    raise exception 'Gerente inválido' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', coalesce(p_reason, ''), true);

  update public.candidates c
     set manager_id = p_manager_id
   where c.id = p_candidate_id
     and c.organization_id = v_org
     and c.archived_at is null;

  if not found then
    raise exception 'Candidato não encontrado' using errcode = 'P0002';
  end if;

  perform set_config('app.change_reason', '', true);
end;
$$;

create function private.set_candidate_archived(p_candidate_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is null or not private.is_admin() then
    raise exception 'Apenas administradores podem arquivar ou restaurar candidatos' using errcode = '42501';
  end if;

  update public.candidates c
     set archived_at = case when p_archived then now() end,
         archived_by_member_id = case when p_archived then private.current_member_id() end
   where c.id = p_candidate_id
     and c.organization_id = v_org
     and (c.archived_at is null) = p_archived;

  if not found then
    raise exception 'Candidato não encontrado' using errcode = 'P0002';
  end if;

  perform private.audit(
    case when p_archived then 'candidate_archived' else 'candidate_restored' end,
    'candidate', p_candidate_id, '{}'::jsonb
  );
end;
$$;

-- Wrappers expostos pela API (SECURITY INVOKER).
create function public.change_candidate_status(p_candidate_id uuid, p_status_id uuid, p_reason text default null)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.change_candidate_status(p_candidate_id, p_status_id, p_reason) $$;

create function public.change_candidate_manager(p_candidate_id uuid, p_manager_id uuid, p_reason text default null)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.change_candidate_manager(p_candidate_id, p_manager_id, p_reason) $$;

create function public.archive_candidate(p_candidate_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.set_candidate_archived(p_candidate_id, true) $$;

create function public.restore_candidate(p_candidate_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.set_candidate_archived(p_candidate_id, false) $$;

-- -----------------------------------------------------------------------------
-- RLS e privilégios
-- -----------------------------------------------------------------------------

alter table public.candidates enable row level security;
alter table public.candidate_history enable row level security;

revoke all on public.candidates, public.candidate_history from anon, authenticated;
grant all on public.candidates, public.candidate_history to service_role;

grant select on public.candidates to authenticated;
grant insert (
  full_name, phone, email, cpf, region_id, segment_id, availability, currently_working, source_id,
  manager_id, notes, status_id, interview_at, integration_date, documentation_status,
  documentation_notes, course_status, course_notes, responsible_member_id
) on public.candidates to authenticated;
-- status_id e manager_id ficam de fora: só mudam pelas RPCs (com motivo e histórico).
grant update (
  full_name, phone, email, cpf, region_id, segment_id, availability, currently_working, source_id,
  notes, interview_at, integration_date, documentation_status, documentation_notes, course_status,
  course_notes, responsible_member_id
) on public.candidates to authenticated;

create policy candidates_select on public.candidates
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy candidates_insert on public.candidates
  for insert to authenticated
  with check (organization_id = (select private.current_organization_id()));

create policy candidates_update on public.candidates
  for update to authenticated
  using (organization_id = (select private.current_organization_id()) and archived_at is null)
  with check (organization_id = (select private.current_organization_id()));

-- Histórico: somente leitura para usuários; escrita só por triggers/funções privadas.
grant select on public.candidate_history to authenticated;

create policy candidate_history_select on public.candidate_history
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

revoke execute on function
  public.change_candidate_status(uuid, uuid, text),
  public.change_candidate_manager(uuid, uuid, text),
  public.archive_candidate(uuid),
  public.restore_candidate(uuid)
from public, anon;

grant execute on function
  private.change_candidate_status(uuid, uuid, text),
  private.change_candidate_manager(uuid, uuid, text),
  private.set_candidate_archived(uuid, boolean),
  private.mask_cpf(text),
  public.change_candidate_status(uuid, uuid, text),
  public.change_candidate_manager(uuid, uuid, text),
  public.archive_candidate(uuid),
  public.restore_candidate(uuid)
to authenticated, service_role;
