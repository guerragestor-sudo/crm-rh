-- =============================================================================
-- CONFIGURAÇÕES: troca de posição entre dois status em um único comando
-- (a UNIQUE (organization_id, position) é verificada ao fim do comando).
-- SECURITY INVOKER: o RLS (somente admin altera) continua valendo.
-- =============================================================================

create function public.swap_status_positions(p_first uuid, p_second uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.candidate_statuses s
     set position = case
       when s.id = p_first then (select position from public.candidate_statuses where id = p_second)
       else (select position from public.candidate_statuses where id = p_first)
     end
   where s.id in (p_first, p_second)
     and s.organization_id = (select private.current_organization_id());
$$;

revoke execute on function public.swap_status_positions(uuid, uuid) from public, anon;
grant execute on function public.swap_status_positions(uuid, uuid) to authenticated, service_role;
