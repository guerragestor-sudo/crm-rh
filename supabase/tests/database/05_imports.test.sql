-- Importação de planilha pelo app: gravação em lote, data de cadastro, desfazer e isolamento.
begin;
create extension if not exists pgtap with schema extensions;
-- No Supabase remoto a CLI conecta como cli_login_postgres, sem acesso ao schema
-- "extensions" (onde fica o pgTAP): os testes rodam como postgres.
set local role postgres;
set local search_path to public, extensions;

select plan(26);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'i-admin@test.local', '{"full_name":"I Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'i-rec@test.local', '{"full_name":"I Recrutadora"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'i-rec2@test.local', '{"full_name":"I Recrutador 2"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', 'j-admin@test.local', '{"full_name":"J Admin"}');
insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-0000000000b1', 'Org I', 'org-i-test'),
  ('22222222-0000-4000-8000-0000000000b2', 'Org J', 'org-j-test');
insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-0000000000b1', '22222222-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000b1', 'admin'),
  ('33333333-0000-4000-8000-0000000000b2', '22222222-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000b2', 'recruiter'),
  ('33333333-0000-4000-8000-0000000000b3', '22222222-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000b3', 'recruiter'),
  ('33333333-0000-4000-8000-0000000000b4', '22222222-0000-4000-8000-0000000000b2', '11111111-0000-4000-8000-0000000000b4', 'admin');

-- Candidato já existente na org I (telefone que a planilha vai repetir).
insert into public.candidates (organization_id, full_name, phone, status_id, responsible_member_id) values
  ('22222222-0000-4000-8000-0000000000b1', 'Já Cadastrado', '5511933330001',
   (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000b1' and position = 0),
   '33333333-0000-4000-8000-0000000000b1');

create temporary table ref on commit drop as
select
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000b1' and position = 0) as status_i,
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000b2' and position = 0) as status_j,
  date_trunc('second', now() - interval '10 days') as ten_days_ago,
  ((now() - interval '10 days') at time zone 'America/Sao_Paulo')::date + 7 as integration;
grant select on ref to authenticated;

-- -----------------------------------------------------------------------------
-- Importar (recrutadora I2)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

select lives_ok(
  $$ select public.import_candidates('esteira.xlsx', jsonb_build_array(
       jsonb_build_object('full_name', 'Imp Um', 'phone', '5511933330010', 'status_id', (select status_i from ref),
                          'created_at', (select ten_days_ago from ref), 'integration_date', (select integration from ref),
                          'cavaplay', true),
       jsonb_build_object('full_name', 'Imp Dois', 'status_id', (select status_i from ref), 'notes', 'Vaga: Corretor')
     )) $$,
  'Recrutadora importa duas linhas de uma vez');

select is((select count(*) from public.candidates where import_id is not null), 2::bigint, 'As duas linhas ficam marcadas com a importação');

select is(
  (select created_at from public.candidates where full_name = 'Imp Um'),
  (select ten_days_ago from ref),
  'A data de cadastro vem da planilha (entrevista), não do momento da importação');

select is((select sla_days_frozen from public.candidates where full_name = 'Imp Um'), 7, 'SLA congelado conta da data de cadastro importada');

select ok(
  (select created_at > now() - interval '1 minute' from public.candidates where full_name = 'Imp Dois'),
  'Sem data na planilha: cadastro = agora');

select results_eq(
  $$ select file_name, row_count, created_by_member_id from public.candidate_imports $$,
  $$ values ('esteira.xlsx'::text, 2, '33333333-0000-4000-8000-0000000000b2'::uuid) $$,
  'Importação registrada com arquivo, quantidade e autora');

select is(
  (select count(*) from public.candidates
    where import_id is not null and created_by_member_id = '33333333-0000-4000-8000-0000000000b2'
      and responsible_member_id = '33333333-0000-4000-8000-0000000000b2' and cavaplay = (full_name = 'Imp Um')),
  2::bigint,
  'Autor e responsável = quem importou; campos sim/não gravados');

select is(
  (select count(*) from public.candidate_history h join public.candidates c on c.id = h.candidate_id
    where c.import_id is not null and h.action = 'created'),
  2::bigint,
  'Cada candidato importado ganha o registro de criação no histórico');

select throws_ok(
  $$ insert into public.candidates (full_name, status_id, import_id)
     values ('Forjado', (select status_i from ref), (select id from public.candidate_imports limit 1)) $$,
  '42501', null, 'Insert direto não pode marcar import_id (e assim não pode retroagir a data de cadastro)');

select throws_ok(
  $$ select public.import_candidates('x.csv', jsonb_build_array(
       jsonb_build_object('full_name', 'Status alheio', 'status_id', (select status_j from ref)))) $$,
  '22023', null, 'Status de outra organização é recusado');

select throws_ok(
  $$ select public.import_candidates('x.csv', jsonb_build_array(
       jsonb_build_object('full_name', 'Futuro', 'status_id', (select status_i from ref), 'created_at', now() + interval '2 days'))) $$,
  '22023', null, 'Data de cadastro futura é recusada');

select throws_ok(
  $$ select public.import_candidates('x.csv', jsonb_build_array(
       jsonb_build_object('full_name', 'Novo ok', 'phone', '5511933330099', 'status_id', (select status_i from ref)),
       jsonb_build_object('full_name', 'Repetido', 'phone', '5511933330001', 'status_id', (select status_i from ref)))) $$,
  '23505', null, 'Telefone já cadastrado derruba a importação inteira');

select is((select count(*) from public.candidates where full_name = 'Novo ok'), 0::bigint, 'Entram todos ou nenhum');

select throws_ok(
  $$ select public.import_candidates('x.csv', '[]'::jsonb) $$,
  '22023', null, 'Importação vazia é recusada');

select lives_ok(
  $$ insert into public.tasks (candidate_id, type, title, due_date)
     values ((select id from public.candidates where full_name = 'Imp Um'), 'call', 'Ligar importado', current_date) $$,
  'Tarefa criada num candidato importado');

-- -----------------------------------------------------------------------------
-- Isolamento e permissão para desfazer
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000b4","role":"authenticated"}', true);
select is((select count(*) from public.candidate_imports), 0::bigint, 'Org J não vê importações da org I');

select throws_ok(
  format('select public.undo_candidate_import(%L)', (select id from public.candidate_imports limit 1)),
  'P0002', null, 'Org J não desfaz importação da org I');

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select throws_ok(
  format('select public.undo_candidate_import(%L)', (select id from public.candidate_imports limit 1)),
  '42501', null, 'Outro recrutador (não admin, não autor) não desfaz');

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select is(
  public.undo_candidate_import((select id from public.candidate_imports limit 1)),
  2,
  'Quem importou desfaz: apaga os 2 candidatos');

select ok(
  not exists (select 1 from public.candidates where full_name in ('Imp Um', 'Imp Dois'))
  and not exists (select 1 from public.tasks where title = 'Ligar importado')
  and (select undone_at is not null and undone_by_member_id = '33333333-0000-4000-8000-0000000000b2' from public.candidate_imports),
  'Candidatos, tarefas e histórico removidos; importação marcada como desfeita');

select throws_ok(
  format('select public.undo_candidate_import(%L)', (select id from public.candidate_imports limit 1)),
  '22023', null, 'Não desfaz duas vezes');

-- Segunda importação: documento anexado e prazo de 7 dias.
select lives_ok(
  $$ select public.import_candidates('indeed.csv', jsonb_build_array(
       jsonb_build_object('full_name', 'Imp Três', 'phone', '5511933330030', 'status_id', (select status_i from ref)))) $$,
  'Segunda importação');

set local role postgres;
insert into public.candidate_documents (organization_id, candidate_id, file_name, storage_path, mime_type, size_bytes)
select c.organization_id, c.id, 'cv.pdf', c.organization_id || '/' || c.id || '/cv.pdf', 'application/pdf', 100
from public.candidates c where c.full_name = 'Imp Três';
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  format('select public.undo_candidate_import(%L)', (select id from public.candidate_imports where file_name = 'indeed.csv')),
  '22023', null, 'Com documento anexado, não desfaz');

set local role postgres;
delete from public.candidate_documents where file_name = 'cv.pdf';
update public.candidate_imports set created_at = now() - interval '8 days' where file_name = 'indeed.csv';
set local role authenticated;
select throws_ok(
  format('select public.undo_candidate_import(%L)', (select id from public.candidate_imports where file_name = 'indeed.csv')),
  '22023', null, 'Depois de 7 dias, não desfaz');

set local role postgres;
update public.candidate_imports set created_at = now() where file_name = 'indeed.csv';
set local role authenticated;
select is(
  public.undo_candidate_import((select id from public.candidate_imports where file_name = 'indeed.csv')),
  1,
  'Administrador desfaz importação de outra pessoa');

set local role postgres;
select results_eq(
  $$ select action, count(*) from public.audit_logs
      where organization_id = '22222222-0000-4000-8000-0000000000b1' and entity_type = 'candidate_import'
      group by action order by action $$,
  $$ values ('data_import'::text, 2::bigint), ('data_import_undone'::text, 2::bigint) $$,
  'Importações e desfazer ficam na auditoria');

select * from finish();
rollback;
