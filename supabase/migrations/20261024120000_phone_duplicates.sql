-- =============================================================================
-- DUPLICIDADE PELO TELEFONE (24/10/2026)
--
--  * Telefone repetido na mesma organização BLOQUEIA (índice único parcial).
--    Nem todo candidato envia documentos no início, então o CPF não serve
--    como chave principal.
--  * CPF continua único quando preenchido (duas pessoas não têm o mesmo CPF).
--  * E-mail repetido só gera aviso (app).
--  * Telefone e e-mail deixam de ser obrigatórios: o candidato pode entrar com
--    "telefone pendente" (ex.: importação da planilha) e ser completado depois.
--    O filtro missing_phone lista esses candidatos.
-- =============================================================================

alter table public.candidates drop constraint candidates_contact_ck;

drop index public.candidates_org_phone_idx;
create unique index candidates_org_phone_uq on public.candidates (organization_id, phone) where phone is not null;

-- Duplicidade: correspondências que bloqueiam (CPF e telefone) vêm primeiro.
create or replace function public.find_candidate_duplicates(
  p_cpf text default null,
  p_phone text default null,
  p_email text default null,
  p_exclude_id uuid default null
)
returns table (id uuid, full_name text, match text, status_name text, archived boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.full_name,
    case
      when p_cpf is not null and c.cpf = p_cpf then 'cpf'
      when p_phone is not null and c.phone = p_phone then 'phone'
      else 'email'
    end,
    s.name,
    c.archived_at is not null
  from public.candidates c
  join public.candidate_statuses s on s.id = c.status_id
  where c.organization_id = private.current_organization_id()
    and (p_exclude_id is null or c.id <> p_exclude_id)
    and (
      (p_cpf is not null and c.cpf = p_cpf)
      or (p_phone is not null and c.phone = p_phone)
      or (p_email is not null and c.email = lower(p_email))
    )
  order by ((p_cpf is not null and c.cpf = p_cpf) or (p_phone is not null and c.phone = p_phone)) desc,
           c.created_at desc
  limit 5
$$;

-- Filtros: novo filtro "telefone pendente" (missing_phone). Demais regras iguais
-- às de 20261009090000_no_next_action_rule.sql.
create or replace function public.filter_candidates(p_filters jsonb default '{}'::jsonb)
returns setof public.candidates
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      ctx.org,
      ctx.tz,
      private.org_today(ctx.org) as today,
      (now() at time zone ctx.tz)::time as now_time,
      coalesce((p_filters ->> 'archived')::boolean, false) as archived,
      private.jsonb_uuid_array(p_filters -> 'status_ids') as status_ids,
      private.jsonb_uuid_array(p_filters -> 'region_ids') as region_ids,
      private.jsonb_uuid_array(p_filters -> 'source_ids') as source_ids,
      private.jsonb_uuid_array(p_filters -> 'manager_ids') as manager_ids,
      private.jsonb_uuid_array(p_filters -> 'segment_ids') as segment_ids,
      private.f_unaccent(lower(nullif(btrim(p_filters ->> 'q'), ''))) as q,
      (p_filters ->> 'created_from')::date as created_from,
      (p_filters ->> 'created_to')::date as created_to,
      (p_filters ->> 'integration_from')::date as integration_from,
      (p_filters ->> 'integration_to')::date as integration_to,
      nullif(p_filters ->> 'integration', '') as integration,
      coalesce((p_filters ->> 'no_next_action')::boolean, false) as no_next_action,
      coalesce((p_filters ->> 'has_overdue_task')::boolean, false) as has_overdue_task,
      coalesce((p_filters ->> 'missing_phone')::boolean, false) as missing_phone
    from (
      select
        private.current_organization_id() as org,
        private.org_timezone(private.current_organization_id()) as tz
    ) ctx
  )
  select c.*
  from public.candidates c
  cross join params p
  where c.organization_id = p.org
    and (c.archived_at is not null) = p.archived
    and (p.status_ids is null or c.status_id = any (p.status_ids))
    and (p.region_ids is null or c.region_id = any (p.region_ids))
    and (p.source_ids is null or c.source_id = any (p.source_ids))
    and (p.manager_ids is null or c.manager_id = any (p.manager_ids))
    and (p.segment_ids is null or c.segment_id = any (p.segment_ids))
    and (p.q is null or c.search_text like '%' || private.escape_like(p.q) || '%')
    and (p.created_from is null or c.created_at >= (p.created_from::timestamp at time zone p.tz))
    and (p.created_to is null or c.created_at < ((p.created_to + 1)::timestamp at time zone p.tz))
    and (p.integration_from is null or c.integration_date >= p.integration_from)
    and (p.integration_to is null or c.integration_date <= p.integration_to)
    and (p.integration is null or (p.integration = 'done') = (c.integration_date is not null))
    and (not p.no_next_action or not exists (
      select 1 from public.tasks t
      where t.candidate_id = c.id and t.status = 'pending'
    ))
    and (not p.has_overdue_task or exists (
      select 1 from public.tasks t
      where t.candidate_id = c.id and t.status = 'pending'
        and private.is_task_overdue(t.due_date, t.due_time, p.today, p.now_time)
    ))
    and (not p.missing_phone or c.phone is null)
$$;
