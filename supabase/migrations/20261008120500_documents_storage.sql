-- =============================================================================
-- DOCUMENTOS (currículo e outros) + STORAGE PRIVADO
-- O arquivo fica no bucket privado candidate-files em {org}/{candidato}/{uuid}.
-- O banco guarda só metadados. Download por URL assinada de curta duração.
-- O registro do documento passa pela RPC register_candidate_document, que
-- confere o caminho, a existência do objeto e marca a versão vigente.
-- =============================================================================

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  candidate_id uuid not null,
  document_type text not null default 'resume' check (document_type in ('resume', 'other')),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  )),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  is_current boolean not null default true,
  uploaded_by_member_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint candidate_documents_path_ck
    check (storage_path like organization_id::text || '/' || candidate_id::text || '/%'),
  foreign key (organization_id, candidate_id) references public.candidates (organization_id, id),
  foreign key (organization_id, uploaded_by_member_id) references public.organization_members (organization_id, id)
);

create index candidate_documents_candidate_idx on public.candidate_documents (candidate_id, created_at desc);
create unique index candidate_documents_current_resume_uq
  on public.candidate_documents (candidate_id)
  where document_type = 'resume' and is_current;

alter table public.candidate_documents enable row level security;
revoke all on public.candidate_documents from anon, authenticated;
grant all on public.candidate_documents to service_role;
grant select on public.candidate_documents to authenticated;

create policy candidate_documents_select on public.candidate_documents
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

-- -----------------------------------------------------------------------------
-- Bucket privado e políticas
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-files',
  'candidate-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Caminho válido = {org da sessão}/{candidato ativo da org}/{arquivo}
create function private.can_access_candidate_file(p_name text, p_require_active boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_parts text[];
begin
  if v_org is null or p_name is null
     or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then
    return false;
  end if;
  v_parts := string_to_array(p_name, '/');
  if v_parts[1] <> v_org::text then
    return false;
  end if;
  return exists (
    select 1 from public.candidates c
    where c.id = v_parts[2]::uuid
      and c.organization_id = v_org
      and (not p_require_active or c.archived_at is null)
  );
end;
$$;

grant execute on function private.can_access_candidate_file(text, boolean) to authenticated, service_role;

create policy candidate_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'candidate-files' and (select private.can_access_candidate_file(name, false)));

create policy candidate_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'candidate-files' and (select private.can_access_candidate_file(name, true)));

-- Sem UPDATE/DELETE: substituir = enviar novo arquivo (o anterior fica no histórico).

-- -----------------------------------------------------------------------------
-- RPC de registro
-- -----------------------------------------------------------------------------

create function private.register_candidate_document(
  p_candidate_id uuid,
  p_document_type text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_member uuid := private.current_member_id();
  v_id uuid;
  v_replaced boolean := false;
begin
  if v_org is null then
    raise exception 'Sessão sem organização' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.candidates c
    where c.id = p_candidate_id and c.organization_id = v_org and c.archived_at is null
  ) then
    raise exception 'Candidato não encontrado' using errcode = 'P0002';
  end if;
  if p_storage_path not like v_org::text || '/' || p_candidate_id::text || '/%' then
    raise exception 'Caminho de arquivo inválido' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'candidate-files' and o.name = p_storage_path
  ) then
    raise exception 'Arquivo não encontrado no armazenamento' using errcode = 'P0002';
  end if;

  if p_document_type = 'resume' then
    update public.candidate_documents d
       set is_current = false
     where d.candidate_id = p_candidate_id
       and d.organization_id = v_org
       and d.document_type = 'resume'
       and d.is_current;
    v_replaced := found;
  end if;

  insert into public.candidate_documents (
    organization_id, candidate_id, document_type, file_name, storage_path, mime_type, size_bytes,
    uploaded_by_member_id
  )
  values (
    v_org, p_candidate_id, p_document_type, btrim(p_file_name), p_storage_path, p_mime_type, p_size_bytes,
    v_member
  )
  returning id into v_id;

  perform private.add_candidate_history(
    v_org, p_candidate_id,
    case when v_replaced then 'document_replaced' else 'document_uploaded' end,
    'document', null, btrim(p_file_name), null,
    jsonb_build_object('document_id', v_id, 'document_type', p_document_type)
  );

  return v_id;
end;
$$;

create function public.register_candidate_document(
  p_candidate_id uuid,
  p_document_type text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.register_candidate_document(
    p_candidate_id, p_document_type, p_file_name, p_storage_path, p_mime_type, p_size_bytes
  )
$$;

revoke execute on function public.register_candidate_document(uuid, text, text, text, text, integer) from public, anon;
grant execute on function
  private.register_candidate_document(uuid, text, text, text, text, integer),
  public.register_candidate_document(uuid, text, text, text, text, integer)
to authenticated, service_role;
