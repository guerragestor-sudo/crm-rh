-- =============================================================================
-- AUDITORIA: ações sensíveis fora da ficha do candidato (exportação, download
-- de documentos, arquivamento). Somente acréscimo; nada de dados pessoais em
-- metadata (apenas filtros, quantidades e ids).
-- =============================================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  actor_member_id uuid,
  action text not null check (action in (
    'data_export', 'document_view', 'document_download', 'candidate_archived', 'candidate_restored'
  )),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, actor_member_id) references public.organization_members (organization_id, id)
);

create index audit_logs_org_occurred_idx on public.audit_logs (organization_id, occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant all on public.audit_logs to service_role;
grant select on public.audit_logs to authenticated;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

create function private.audit(p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is null then
    raise exception 'Organização não identificada' using errcode = '42501';
  end if;
  insert into public.audit_logs (organization_id, actor_member_id, action, entity_type, entity_id, metadata)
  values (v_org, private.current_member_id(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- API: a aplicação só pode registrar eventos de leitura/exportação.
create function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_action not in ('data_export', 'document_view', 'document_download') then
    raise exception 'Ação de auditoria não permitida' using errcode = '42501';
  end if;
  perform private.audit(p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;

revoke execute on function public.log_audit_event(text, text, uuid, jsonb) from public, anon;
grant execute on function private.audit(text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.log_audit_event(text, text, uuid, jsonb) to authenticated, service_role;
