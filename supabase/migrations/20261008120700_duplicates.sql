-- =============================================================================
-- DUPLICIDADE: CPF bloqueia (índice único); telefone e e-mail só avisam.
-- Retorna no máximo 5 candidatos da própria organização (RLS + filtro explícito).
-- =============================================================================

create function public.find_candidate_duplicates(
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
  order by (p_cpf is not null and c.cpf = p_cpf) desc, c.created_at desc
  limit 5
$$;

revoke execute on function public.find_candidate_duplicates(text, text, text, uuid) from public, anon;
grant execute on function public.find_candidate_duplicates(text, text, text, uuid) to authenticated, service_role;
