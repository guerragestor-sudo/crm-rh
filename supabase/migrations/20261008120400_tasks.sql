-- =============================================================================
-- TAREFAS / AGENDA
-- Data totalmente livre (due_date) com horário opcional. "Atrasada" é calculada
-- no fuso da organização, nunca gravada. Sem DELETE: tarefa errada é cancelada.
-- external_id/metadata ficam reservados para integrações futuras.
-- =============================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  candidate_id uuid not null,
  type text not null check (type in (
    'call', 'whatsapp', 'email', 'interview', 'request_document', 'course', 'referral', 'follow_up', 'custom'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (char_length(description) <= 2000),
  due_date date not null,
  due_time time,
  responsible_member_id uuid not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  completed_at timestamptz,
  completed_by_member_id uuid,
  external_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint tasks_completion_ck check ((status = 'done') = (completed_at is not null)),
  foreign key (organization_id, candidate_id) references public.candidates (organization_id, id),
  foreign key (organization_id, responsible_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, completed_by_member_id) references public.organization_members (organization_id, id),
  foreign key (organization_id, created_by_member_id) references public.organization_members (organization_id, id)
);

create index tasks_org_status_due_idx on public.tasks (organization_id, status, due_date, due_time);
create index tasks_candidate_idx on public.tasks (candidate_id, status, due_date);
create index tasks_org_responsible_idx on public.tasks (organization_id, responsible_member_id, status, due_date);

create function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
begin
  if tg_op = 'INSERT' then
    if v_member is not null then
      new.created_at := now();
      new.created_by_member_id := v_member;
      new.responsible_member_id := coalesce(new.responsible_member_id, v_member);
    end if;
    new.updated_at := new.created_at;
    if exists (
      select 1 from public.candidates c
      where c.id = new.candidate_id and c.archived_at is not null
    ) then
      raise exception 'Não é possível criar tarefa para candidato arquivado' using errcode = '23514';
    end if;
  else
    new.organization_id := old.organization_id;
    new.candidate_id := old.candidate_id;
    new.created_at := old.created_at;
    new.created_by_member_id := old.created_by_member_id;
    new.updated_at := now();
  end if;

  if new.status = 'done' then
    if tg_op = 'UPDATE' and old.status = 'done' then
      new.completed_at := old.completed_at;
      new.completed_by_member_id := old.completed_by_member_id;
    elsif v_member is not null or new.completed_at is null then
      new.completed_at := now();
      new.completed_by_member_id := coalesce(v_member, new.completed_by_member_id);
    end if;
  else
    new.completed_at := null;
    new.completed_by_member_id := null;
  end if;

  return new;
end;
$$;

create trigger tasks_10_set_organization
  before insert on public.tasks
  for each row execute function private.set_organization_from_session();

create trigger tasks_20_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

create function private.log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := jsonb_build_object('task_id', new.id, 'type', new.type);
begin
  if tg_op = 'INSERT' then
    perform private.add_candidate_history(
      new.organization_id, new.candidate_id, 'task_created', 'task', null, new.title, null,
      v_meta || jsonb_build_object('due_date', new.due_date, 'due_time', new.due_time)
    );
  elsif new.status is distinct from old.status then
    perform private.add_candidate_history(
      new.organization_id, new.candidate_id,
      case new.status when 'done' then 'task_completed'
                      when 'cancelled' then 'task_cancelled'
                      else 'task_reopened' end,
      'task', null, new.title, null, v_meta
    );
  elsif new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    perform private.add_candidate_history(
      new.organization_id, new.candidate_id, 'task_rescheduled', 'task',
      to_char(old.due_date, 'DD/MM/YYYY') || coalesce(' ' || to_char(old.due_time, 'HH24:MI'), ''),
      to_char(new.due_date, 'DD/MM/YYYY') || coalesce(' ' || to_char(new.due_time, 'HH24:MI'), ''),
      null, v_meta || jsonb_build_object('title', new.title)
    );
  end if;
  return new;
end;
$$;

create trigger tasks_90_history
  after insert or update on public.tasks
  for each row execute function private.log_task_changes();

alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant all on public.tasks to service_role;

grant select on public.tasks to authenticated;
grant insert (
  candidate_id, type, title, description, due_date, due_time, responsible_member_id, priority, status
) on public.tasks to authenticated;
grant update (
  type, title, description, due_date, due_time, responsible_member_id, priority, status
) on public.tasks to authenticated;

create policy tasks_select on public.tasks
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (organization_id = (select private.current_organization_id()));

create policy tasks_update on public.tasks
  for update to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));
