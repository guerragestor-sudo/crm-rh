-- =============================================================================
-- AJUSTE DE REGRA (09/10/2026): "Atrasadas" e "Sem próxima ação" são grupos
-- separados.
--   * Atrasada: candidato com tarefa pendente cujo prazo já passou.
--   * Sem próxima ação: candidato ativo SEM NENHUMA tarefa pendente.
-- Um candidato com tarefa atrasada aparece só em "Atrasadas" (a tarefa
-- pendente é a próxima ação, ainda que vencida).
-- =============================================================================

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
      coalesce((p_filters ->> 'has_overdue_task')::boolean, false) as has_overdue_task
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
$$;

create or replace function public.dashboard_summary(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_tz text := private.org_timezone(v_org);
  v_today date := private.org_today(v_org);
  v_now_time time := (now() at time zone v_tz)::time;
  v_target integer;
  v_result jsonb;
begin
  if v_org is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;

  select s.sla_target_days into v_target
  from public.organization_settings s where s.organization_id = v_org;

  with base as materialized (
    select c.*,
           coalesce(c.sla_days_frozen, v_today - (c.created_at at time zone v_tz)::date) as sla
    from public.filter_candidates(p_filters) c
  ),
  pending as materialized (
    select t.candidate_id, t.due_date, t.due_time
    from public.tasks t
    join base b on b.id = t.candidate_id
    where t.status = 'pending'
  ),
  months as (
    select generate_series(
      date_trunc('month', v_today::timestamp) - interval '11 months',
      date_trunc('month', v_today::timestamp),
      interval '1 month'
    )::date as month
  )
  select jsonb_build_object(
    'today', v_today,
    'sla_target_days', v_target,
    'totals', jsonb_build_object(
      'active', (select count(*) from base),
      'new_7_days', (select count(*) from base where (created_at at time zone v_tz)::date > v_today - 7),
      'interviews_upcoming', (select count(*) from base where interview_at >= now()),
      'interviews_today', (select count(*) from base where (interview_at at time zone v_tz)::date = v_today),
      'integrations', (select count(*) from base where integration_date is not null),
      'integrations_this_month', (
        select count(*) from base
        where date_trunc('month', integration_date::timestamp) = date_trunc('month', v_today::timestamp)
      ),
      'overdue_tasks', (
        select count(*) from pending where private.is_task_overdue(due_date, due_time, v_today, v_now_time)
      ),
      'today_tasks', (select count(*) from pending where due_date = v_today),
      'no_next_action', (
        select count(*) from base b
        where not exists (select 1 from pending p where p.candidate_id = b.id)
      )
    ),
    'sla', (
      select jsonb_build_object(
        'completed_count', count(*) filter (where integration_date is not null),
        'avg', round(avg(sla) filter (where integration_date is not null), 1),
        'median', percentile_cont(0.5) within group (order by sla) filter (where integration_date is not null),
        'min', min(sla) filter (where integration_date is not null),
        'max', max(sla) filter (where integration_date is not null),
        'waiting_count', count(*) filter (where integration_date is null),
        'waiting_avg', round(avg(sla) filter (where integration_date is null), 1),
        'waiting_median', percentile_cont(0.5) within group (order by sla) filter (where integration_date is null),
        'above_target', case when v_target is null then null else count(*) filter (where sla > v_target) end
      )
      from base
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'color', s.color, 'count', coalesce(x.n, 0)
      ) order by s.position), '[]'::jsonb)
      from public.candidate_statuses s
      left join (select status_id, count(*) as n from base group by status_id) x on x.status_id = s.id
      where s.organization_id = v_org and (s.is_active or x.n > 0)
    ),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'count', g.n) order by g.n desc, g.name), '[]'::jsonb)
      from (
        select b.source_id as id, coalesce(r.name, 'Não informada') as name, count(*) as n
        from base b left join public.sources r on r.id = b.source_id
        group by b.source_id, r.name
      ) g
    ),
    'by_region', (
      select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'count', g.n) order by g.n desc, g.name), '[]'::jsonb)
      from (
        select b.region_id as id, coalesce(r.name, 'Não informada') as name, count(*) as n
        from base b left join public.regions r on r.id = b.region_id
        group by b.region_id, r.name
      ) g
    ),
    'by_manager', (
      select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'count', g.n) order by g.n desc, g.name), '[]'::jsonb)
      from (
        select b.manager_id as id, coalesce(m.name, 'Sem gerente') as name, count(*) as n
        from base b left join public.managers m on m.id = b.manager_id
        group by b.manager_id, m.name
      ) g
    ),
    'by_month', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(mo.month, 'YYYY-MM'),
        'new', (select count(*) from base b
                where date_trunc('month', (b.created_at at time zone v_tz))::date = mo.month),
        'integrations', (select count(*) from base b
                         where date_trunc('month', b.integration_date::timestamp)::date = mo.month),
        'sla_avg', (select round(avg(b.sla), 1) from base b
                    where date_trunc('month', b.integration_date::timestamp)::date = mo.month),
        'sla_median', (select percentile_cont(0.5) within group (order by b.sla) from base b
                       where date_trunc('month', b.integration_date::timestamp)::date = mo.month)
      ) order by mo.month), '[]'::jsonb)
      from months mo
    )
  ) into v_result;

  return v_result;
end;
$$;
