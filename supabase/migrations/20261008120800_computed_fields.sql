-- =============================================================================
-- CAMPOS CALCULADOS (expostos pelo PostgREST como colunas da linha do candidato)
-- next_task: tarefa pendente mais próxima (inclusive atrasada), ou null.
-- =============================================================================

create function public.next_task(c public.candidates)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'type', t.type,
    'due_date', t.due_date,
    'due_time', t.due_time
  )
  from public.tasks t
  where t.candidate_id = c.id and t.status = 'pending'
  order by t.due_date, t.due_time nulls last, t.created_at
  limit 1
$$;

revoke execute on function public.next_task(public.candidates) from public, anon;
grant execute on function public.next_task(public.candidates) to authenticated, service_role;
