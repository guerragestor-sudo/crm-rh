-- =============================================================================
-- INTEGRAÇÃO PREVISTA (26/10/2026)
--
-- integration_date continua sendo o dia em que o candidato COMEÇOU (não pode
-- ser futura; congela o SLA). Para registrar uma data combinada com
-- antecedência, existe integration_planned_date, que aceita datas futuras e
-- não entra no SLA nem nos indicadores de integrados.
--
--  * Ao confirmar a integração (integration_date preenchida), a prevista é
--    limpa automaticamente.
--  * O histórico registra mudanças na data prevista.
--  * Filtro integration = 'planned': aguardando integração com data prevista.
-- =============================================================================

alter table public.candidates add column integration_planned_date date;

grant insert (integration_planned_date), update (integration_planned_date)
  on public.candidates to authenticated;

create function private.candidates_clear_planned_integration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.integration_date is not null then
    new.integration_planned_date := null;
  end if;
  return new;
end;
$$;

create trigger candidates_40_clear_planned_integration
  before insert or update on public.candidates
  for each row execute function private.candidates_clear_planned_integration();

-- Histórico: mesma função de 20261025120000_cava_fields.sql, com a data prevista.
create or replace function private.log_candidate_changes()
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

  -- Integração prevista: registra mudanças feitas pela usuária; quando a
  -- integração é confirmada, a prevista é limpa sem gerar linha extra.
  if new.integration_planned_date is distinct from old.integration_planned_date
     and not (new.integration_planned_date is null and new.integration_date is not null) then
    perform private.add_candidate_history(
      new.organization_id, new.id, 'updated', 'integration_planned_date',
      to_char(old.integration_planned_date, 'DD/MM/YYYY'),
      to_char(new.integration_planned_date, 'DD/MM/YYYY')
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
    'documentation_status', 'documentation_notes', 'course_status', 'course_notes',
    'cavaplay', 'course_paid_by_cava'
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

-- Filtros: mesma função de 20261025120000_cava_fields.sql, com integration = 'planned'.
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
      coalesce((p_filters ->> 'missing_phone')::boolean, false) as missing_phone,
      nullif(p_filters ->> 'cavaplay', '') as cavaplay,
      nullif(p_filters ->> 'course_paid_by_cava', '') as course_paid_by_cava
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
    and (p.integration is null
         or (p.integration = 'done' and c.integration_date is not null)
         or (p.integration = 'pending' and c.integration_date is null)
         or (p.integration = 'planned' and c.integration_date is null and c.integration_planned_date is not null))
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
    and (p.cavaplay is null or c.cavaplay = (p.cavaplay = 'yes'))
    and (p.course_paid_by_cava is null or c.course_paid_by_cava = (p.course_paid_by_cava = 'yes'))
$$;
