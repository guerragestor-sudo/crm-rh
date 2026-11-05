-- Novidades do app (pop-up após o login): guarda, por usuário, a última novidade vista.
-- O conteúdo das novidades fica no código (src/modules/updates/releases.ts), com ids
-- sequenciais. Aqui só fica o maior id já visto, para o pop-up aparecer uma vez só,
-- no celular ou no computador.

alter table public.organization_members
  add column updates_seen integer
  check (updates_seen is null or updates_seen >= 0);

comment on column public.organization_members.updates_seen is
  'Maior id de novidade (src/modules/updates/releases.ts) que o usuário já viu. Nulo = nunca viu.';

-- O próprio usuário marca como visto (a política de update de membros é só do Admin).
-- Nunca volta para trás: marcar uma novidade antiga não reabre as mais novas.
create function private.mark_updates_seen(p_seen integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
  v_seen integer;
begin
  if v_member is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_seen is null or p_seen < 1 or p_seen > 1000000 then
    raise exception 'Novidade inválida.' using errcode = '22023';
  end if;

  update public.organization_members
     set updates_seen = greatest(coalesce(updates_seen, 0), p_seen)
   where id = v_member
  returning updates_seen into v_seen;

  return v_seen;
end;
$$;

create function public.mark_updates_seen(p_seen integer)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.mark_updates_seen(p_seen) $$;

revoke execute on function private.mark_updates_seen(integer) from public, anon;
revoke execute on function public.mark_updates_seen(integer) from public, anon;
grant execute on function private.mark_updates_seen(integer) to authenticated, service_role;
grant execute on function public.mark_updates_seen(integer) to authenticated, service_role;
