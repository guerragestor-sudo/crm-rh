-- =============================================================================
-- SEED DE DESENVOLVIMENTO (somente local; nunca roda em produção)
--
-- Usuários de teste (senha de todos: CrmDemo2026!)
--   admin@crm.local        Admin       — organização "Recrutamento Demo"
--   recrutador@crm.local   Recrutador  — organização "Recrutamento Demo"
--   outra@crm.local        Admin       — organização "Outra Organização" (teste de isolamento)
-- =============================================================================

-- Usuários no Auth local -------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('CrmDemo2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@crm.local', 'Admin Demo'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'recrutador@crm.local', 'Recrutador Demo'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'outra@crm.local', 'Admin Outra Org')
) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email in ('admin@crm.local', 'recrutador@crm.local', 'outra@crm.local');

-- Organizações e membros --------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('b0000000-0000-4000-8000-000000000001', 'Recrutamento Demo', 'recrutamento-demo'),
  ('b0000000-0000-4000-8000-000000000002', 'Outra Organização', 'outra-organizacao');

insert into public.organization_members (id, organization_id, user_id, role) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'recruiter'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'admin');

-- Cadastros de apoio da organização demo -------------------------------------
insert into public.regions (organization_id, name, sort_order)
select 'b0000000-0000-4000-8000-000000000001', r.name, r.ord
from (values ('Osasco', 0), ('Zona Oeste', 1), ('Zona Sul', 2), ('Centro', 3), ('ABC', 4)) as r(name, ord);

insert into public.segments (organization_id, name, sort_order)
select 'b0000000-0000-4000-8000-000000000001', s.name, s.ord
from (values ('Vendas', 0), ('Atendimento', 1), ('Administrativo', 2), ('Logística', 3)) as s(name, ord);

insert into public.managers (organization_id, name, phone) values
  ('b0000000-0000-4000-8000-000000000001', 'Carlos Mendes', '5511987650001'),
  ('b0000000-0000-4000-8000-000000000001', 'Fernanda Lima', '5511987650002'),
  ('b0000000-0000-4000-8000-000000000001', 'Ricardo Souza', '5511987650003');

-- CPF válido a partir de 9 dígitos (dígitos verificadores calculados)
create function pg_temp.cpf_from(base text) returns text language plpgsql as $$
declare
  s int := 0;
  d1 int;
  d2 int;
begin
  for i in 1..9 loop s := s + substr(base, i, 1)::int * (11 - i); end loop;
  d1 := 11 - (s % 11); if d1 >= 10 then d1 := 0; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(base, i, 1)::int * (12 - i); end loop;
  s := s + d1 * 2;
  d2 := 11 - (s % 11); if d2 >= 10 then d2 := 0; end if;
  return base || d1 || d2;
end;
$$;

-- Candidatos da organização demo ------------------------------------------------
with
org as (select 'b0000000-0000-4000-8000-000000000001'::uuid as id),
names as (
  select (row_number() over ())::int as n, name
  from unnest(array[
    'Ana Paula Ferreira', 'Bruno Henrique Costa', 'Camila Rodrigues', 'Diego Almeida',
    'Eduarda Santos', 'Felipe Oliveira', 'Gabriela Martins', 'Henrique Barbosa',
    'Isabela Carvalho', 'João Victor Ribeiro', 'Karina Gomes', 'Lucas Pereira',
    'Mariana Araújo', 'Nicolas Teixeira', 'Patrícia Moreira', 'Rafael Cardoso',
    'Sabrina Rocha', 'Thiago Nunes', 'Vanessa Dias', 'William Castro',
    'Yasmin Correia', 'Rodrigo Pinto', 'Juliana Freitas', 'Marcos Vieira'
  ]) as name
),
statuses as (select id, position from public.candidate_statuses where organization_id = (select id from org)),
regions as (select row_number() over (order by sort_order) as k, id from public.regions where organization_id = (select id from org)),
segments as (select row_number() over (order by sort_order) as k, id from public.segments where organization_id = (select id from org)),
sources as (select row_number() over (order by sort_order) as k, id from public.sources where organization_id = (select id from org)),
managers as (select row_number() over (order by name) as k, id from public.managers where organization_id = (select id from org))
insert into public.candidates (
  organization_id, full_name, phone, email, cpf, region_id, segment_id, availability,
  currently_working, source_id, manager_id, notes, status_id, interview_at, integration_date,
  documentation_status, course_status, responsible_member_id, created_by_member_id, created_at
)
select
  (select id from org),
  n.name,
  '55119' || lpad((70000000 + n.n * 1371)::text, 8, '0'),
  lower(translate(split_part(n.name, ' ', 1), 'áâãéêíóôõúçÁÉÍÓÚ', 'aaaeeioooucaeiou')) || '.' || n.n || '@exemplo.com',
  case when n.n % 3 = 0 then null else pg_temp.cpf_from(lpad((123456000 + n.n * 7919)::text, 9, '0')) end,
  (select id from regions where k = 1 + n.n % 5),
  (select id from segments where k = 1 + n.n % 4),
  (array['immediate', 'up_to_15_days', 'up_to_30_days', 'to_negotiate'])[1 + n.n % 4],
  n.n % 2 = 0,
  (select id from sources where k = 1 + n.n % 6),
  case when n.n % 5 = 0 then null else (select id from managers where k = 1 + n.n % 3) end,
  case when n.n % 4 = 0 then 'Candidato com boa comunicação; prefere período da manhã.' end,
  (select id from statuses where position = case
     when n.n <= 6 then 0
     when n.n <= 11 then 1
     when n.n <= 16 then 2
     when n.n <= 19 then 3
     when n.n <= 22 then 4
     else 5 end),
  case when n.n between 4 and 12 then date_trunc('hour', now()) + ((n.n - 8) * interval '1 day') + interval '10 hours' end,
  case when n.n between 12 and 16
       then (now() at time zone 'America/Sao_Paulo')::date - (n.n - 11) end,
  (array['pending', 'in_progress', 'complete'])[1 + n.n % 3],
  (array['not_started', 'in_progress', 'completed'])[1 + n.n % 3],
  case when n.n % 2 = 0 then 'c0000000-0000-4000-8000-000000000001'::uuid
       else 'c0000000-0000-4000-8000-000000000002'::uuid end,
  'c0000000-0000-4000-8000-000000000001'::uuid,
  now() - ((n.n * 3 - 2) * interval '1 day')
from names n;

-- Tarefas: atrasadas, hoje, próximas e concluídas ------------------------------
with c as (
  select id, row_number() over (order by created_at) as n, responsible_member_id
  from public.candidates
  where organization_id = 'b0000000-0000-4000-8000-000000000001'
),
today as (select (now() at time zone 'America/Sao_Paulo')::date as d)
insert into public.tasks (
  organization_id, candidate_id, type, title, description, due_date, due_time,
  responsible_member_id, priority, status, completed_at, created_by_member_id
)
select
  'b0000000-0000-4000-8000-000000000001', c.id, t.type, t.title, null,
  (select d from today) + t.offset_days, t.due_time, c.responsible_member_id, t.priority,
  t.status, case when t.status = 'done' then now() - interval '1 day' end,
  'c0000000-0000-4000-8000-000000000001'
from c
join (values
  (1, 'call', 'Ligar para confirmar interesse', -3, '09:00'::time, 'high', 'pending'),
  (2, 'whatsapp', 'Enviar mensagem com detalhes da vaga', -1, null, 'normal', 'pending'),
  (3, 'interview', 'Entrevista com o gerente', 0, '14:00'::time, 'high', 'pending'),
  (4, 'request_document', 'Solicitar RG e comprovante de residência', 0, null, 'normal', 'pending'),
  (5, 'follow_up', 'Retorno sobre a entrevista', 2, '11:00'::time, 'normal', 'pending'),
  (6, 'course', 'Acompanhar início do curso', 5, null, 'low', 'pending'),
  (7, 'referral', 'Encaminhar para o gerente', 1, null, 'normal', 'pending'),
  (8, 'email', 'Enviar e-mail de boas-vindas', -2, null, 'normal', 'done'),
  (9, 'call', 'Ligar para agendar integração', 3, '16:30'::time, 'normal', 'pending'),
  (10, 'custom', 'Conferir documentação', -5, null, 'low', 'done')
) as t(n, type, title, offset_days, due_time, priority, status) on t.n = c.n;

-- Organização isolada (testes de RLS) --------------------------------------------
insert into public.candidates (
  organization_id, full_name, phone, status_id, responsible_member_id, created_by_member_id
)
select
  'b0000000-0000-4000-8000-000000000002', 'Candidato da Outra Org', '5521999990000',
  (select id from public.candidate_statuses
    where organization_id = 'b0000000-0000-4000-8000-000000000002' and position = 0),
  'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003';
