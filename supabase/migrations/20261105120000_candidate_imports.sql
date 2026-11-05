-- =============================================================================
-- IMPORTAÇÃO DE PLANILHA PELO APP (05/11/2026)
--
-- A recrutadora importa candidatos em massa pela tela /candidatos/importar:
--  * cada importação vira uma linha em candidate_imports e marca os candidatos
--    com import_id (permite "Desfazer importação" por até 7 dias);
--  * a gravação é um único INSERT (entram todos ou nenhum), feito pela função
--    import_candidates, que também aceita a data de cadastro vinda da planilha
--    (a data da entrevista; o SLA conta a partir dela, como na importação da SETE.26);
--  * import_id não tem GRANT para authenticated: só a função grava a coluna, e
--    só linhas com import_id mantêm o created_at informado.
-- =============================================================================

create table public.candidate_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  row_count integer not null check (row_count between 1 and 1000),
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by_member_id uuid,
  unique (organization_id, id),
  foreign key (organization_id, created_by_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, undone_by_member_id) references public.organization_members (organization_id, id),
  constraint candidate_imports_undone_ck check ((undone_at is null) = (undone_by_member_id is null))
);

create index candidate_imports_org_created_idx on public.candidate_imports (organization_id, created_at desc);

alter table public.candidate_imports enable row level security;
revoke all on public.candidate_imports from anon, authenticated;
grant all on public.candidate_imports to service_role;
grant select on public.candidate_imports to authenticated;

create policy candidate_imports_select on public.candidate_imports
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

alter table public.candidates add column import_id uuid;
alter table public.candidates
  add constraint candidates_import_fk
  foreign key (organization_id, import_id) references public.candidate_imports (organization_id, id);
create index candidates_import_idx on public.candidates (import_id) where import_id is not null;

-- Auditoria: importação e desfazer.
alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (action in (
  'data_export', 'document_view', 'document_download', 'candidate_archived', 'candidate_restored',
  'data_import', 'data_import_undone'
));

-- -----------------------------------------------------------------------------
-- Data de cadastro: com sessão, continua sendo now(), exceto nas linhas gravadas
-- pela importação (import_id preenchido), que trazem a data da planilha.
-- -----------------------------------------------------------------------------
create or replace function private.candidates_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
begin
  -- Com sessão, autor e datas vêm do servidor. Sem sessão (seed/scripts), mantém o informado.
  if v_member is not null then
    if new.import_id is null or new.created_at is null then
      new.created_at := now();
    end if;
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

-- -----------------------------------------------------------------------------
-- Gravação em lote
-- -----------------------------------------------------------------------------
create function private.import_candidates(p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_member uuid := private.current_member_id();
  v_count integer;
  v_import uuid;
  v_inserted integer;
begin
  if v_org is null or v_member is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Linhas inválidas' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 1000 then
    raise exception 'A importação deve ter de 1 a 1000 candidatos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(status_id uuid)
    where not exists (
      select 1 from public.candidate_statuses s
      where s.id = r.status_id and s.organization_id = v_org and s.is_active
    )
  ) then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(created_at timestamptz)
    where r.created_at > now() + interval '5 minutes' or r.created_at < now() - interval '5 years'
  ) then
    raise exception 'Data de cadastro fora do período permitido (até 5 anos atrás, nunca futura)' using errcode = '22023';
  end if;

  insert into public.candidate_imports (organization_id, file_name, row_count, created_by_member_id)
  values (v_org, left(coalesce(nullif(btrim(p_file_name), ''), 'planilha'), 200), v_count, v_member)
  returning id into v_import;

  insert into public.candidates (
    organization_id, import_id, full_name, phone, email, cpf, region_id, segment_id, availability,
    currently_working, source_id, manager_id, status_id, notes, interview_at, integration_date,
    integration_planned_date, documentation_status, documentation_notes, course_status, course_notes,
    cavaplay, course_paid_by_cava, responsible_member_id, created_at
  )
  select
    v_org, v_import, r.full_name, r.phone, r.email, r.cpf, r.region_id, r.segment_id, r.availability,
    r.currently_working, r.source_id, r.manager_id, r.status_id, r.notes, r.interview_at, r.integration_date,
    r.integration_planned_date, coalesce(r.documentation_status, 'pending'), r.documentation_notes,
    coalesce(r.course_status, 'not_started'), r.course_notes, coalesce(r.cavaplay, false),
    coalesce(r.course_paid_by_cava, false), v_member, coalesce(r.created_at, now())
  from jsonb_to_recordset(p_rows) as r(
    full_name text, phone text, email text, cpf text, region_id uuid, segment_id uuid, availability text,
    currently_working boolean, source_id uuid, manager_id uuid, status_id uuid, notes text,
    interview_at timestamptz, integration_date date, integration_planned_date date,
    documentation_status text, documentation_notes text, course_status text, course_notes text,
    cavaplay boolean, course_paid_by_cava boolean, created_at timestamptz
  );
  get diagnostics v_inserted = row_count;

  perform private.audit('data_import', 'candidate_import', v_import, jsonb_build_object('rows', v_inserted));
  return jsonb_build_object('import_id', v_import, 'inserted', v_inserted);
end;
$$;

-- -----------------------------------------------------------------------------
-- Desfazer (até 7 dias; quem importou ou administrador). Apaga os candidatos da
-- importação com histórico e tarefas; com documento anexado, recusa.
-- -----------------------------------------------------------------------------
create function private.undo_candidate_import(p_import_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_member uuid := private.current_member_id();
  v_import public.candidate_imports;
  v_deleted integer;
begin
  if v_org is null or v_member is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;

  select * into v_import
  from public.candidate_imports i
  where i.id = p_import_id and i.organization_id = v_org
  for update;
  if not found then
    raise exception 'Importação não encontrada' using errcode = 'P0002';
  end if;
  if v_import.undone_at is not null then
    raise exception 'Esta importação já foi desfeita' using errcode = '22023';
  end if;
  if v_import.created_by_member_id <> v_member and not private.is_admin() then
    raise exception 'Só quem importou ou um administrador pode desfazer' using errcode = '42501';
  end if;
  if v_import.created_at < now() - interval '7 days' then
    raise exception 'O prazo para desfazer (7 dias) terminou' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.candidate_documents d
    join public.candidates c on c.organization_id = d.organization_id and c.id = d.candidate_id
    where c.organization_id = v_org and c.import_id = p_import_id
  ) then
    raise exception 'Há documentos anexados a candidatos desta importação. Remova-os antes de desfazer.' using errcode = '22023';
  end if;

  delete from public.tasks t
  using public.candidates c
  where c.organization_id = v_org and c.import_id = p_import_id
    and t.organization_id = c.organization_id and t.candidate_id = c.id;

  delete from public.candidate_history h
  using public.candidates c
  where c.organization_id = v_org and c.import_id = p_import_id
    and h.organization_id = c.organization_id and h.candidate_id = c.id;

  delete from public.candidates c
  where c.organization_id = v_org and c.import_id = p_import_id;
  get diagnostics v_deleted = row_count;

  update public.candidate_imports
     set undone_at = now(), undone_by_member_id = v_member
   where id = p_import_id;

  perform private.audit('data_import_undone', 'candidate_import', p_import_id, jsonb_build_object('rows', v_deleted));
  return v_deleted;
end;
$$;

-- API (invoker; a função privada valida sessão e organização)
create function public.import_candidates(p_file_name text, p_rows jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.import_candidates(p_file_name, p_rows) $$;

create function public.undo_candidate_import(p_import_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.undo_candidate_import(p_import_id) $$;

revoke execute on function private.import_candidates(text, jsonb) from public, anon;
revoke execute on function private.undo_candidate_import(uuid) from public, anon;
revoke execute on function public.import_candidates(text, jsonb) from public, anon;
revoke execute on function public.undo_candidate_import(uuid) from public, anon;
grant execute on function private.import_candidates(text, jsonb) to authenticated, service_role;
grant execute on function private.undo_candidate_import(uuid) to authenticated, service_role;
grant execute on function public.import_candidates(text, jsonb) to authenticated, service_role;
grant execute on function public.undo_candidate_import(uuid) to authenticated, service_role;
