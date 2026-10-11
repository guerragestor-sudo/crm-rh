-- Regras de negócio garantidas pelo banco: SLA congelado, tarefas, arquivamento, documentos.
begin;
create extension if not exists pgtap with schema extensions;
-- No Supabase remoto a CLI conecta como cli_login_postgres, sem acesso ao schema
-- "extensions" (onde fica o pgTAP): os testes rodam como postgres.
set local role postgres;
set local search_path to public, extensions;

select plan(18);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'd-admin@test.local', '{"full_name":"D Admin"}');
insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-0000000000d1', 'Org D', 'org-d-test');
insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-0000000000d1', '22222222-0000-4000-8000-0000000000d1', '11111111-0000-4000-8000-0000000000d1', 'admin');

-- Candidato "antigo" (criado há 10 dias), inserido sem sessão para simular histórico.
insert into public.candidates (id, organization_id, full_name, email, status_id, responsible_member_id, created_at)
values (
  '55555555-0000-4000-8000-0000000000d1', '22222222-0000-4000-8000-0000000000d1', 'Candidato SLA', 'sla@test.local',
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000d1' and position = 0),
  '33333333-0000-4000-8000-0000000000d1',
  now() - interval '10 days'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000d1","role":"authenticated"}', true);

-- SLA ------------------------------------------------------------------------
select is(
  (select sla_days_frozen from public.candidates where id = '55555555-0000-4000-8000-0000000000d1'),
  null::integer, 'Sem integração não há SLA congelado');

select throws_ok(
  $$ update public.candidates set integration_date = (now() at time zone 'America/Sao_Paulo')::date + 1
      where id = '55555555-0000-4000-8000-0000000000d1' $$,
  '23514', null, 'Integração não pode ser futura');

select throws_ok(
  $$ update public.candidates set integration_date = (now() at time zone 'America/Sao_Paulo')::date - 30
      where id = '55555555-0000-4000-8000-0000000000d1' $$,
  '23514', null, 'Integração não pode ser anterior ao cadastro');

update public.candidates
   set integration_date = (now() at time zone 'America/Sao_Paulo')::date - 2
 where id = '55555555-0000-4000-8000-0000000000d1';

select is(
  (select sla_days_frozen from public.candidates where id = '55555555-0000-4000-8000-0000000000d1'),
  ((now() at time zone 'America/Sao_Paulo')::date - 2) - ((now() - interval '10 days') at time zone 'America/Sao_Paulo')::date,
  'SLA congelado = integração − data local do cadastro');

select is(
  (select sla_days_frozen from public.candidates where id = '55555555-0000-4000-8000-0000000000d1'),
  8, 'SLA congelado em 8 dias');

-- Editar outro campo não altera o SLA congelado.
update public.candidates set notes = 'Observação nova' where id = '55555555-0000-4000-8000-0000000000d1';
select is(
  (select sla_days_frozen from public.candidates where id = '55555555-0000-4000-8000-0000000000d1'),
  8, 'SLA congelado não muda com outras edições');

select ok(
  exists (select 1 from public.candidate_history
          where candidate_id = '55555555-0000-4000-8000-0000000000d1' and action = 'integration_changed'),
  'Integração registrada no histórico');

select ok(
  exists (select 1 from public.candidate_history
          where candidate_id = '55555555-0000-4000-8000-0000000000d1' and action = 'updated' and field = 'notes'),
  'Edição de observação registrada no histórico');

-- Limpar a integração limpa o SLA congelado.
update public.candidates set integration_date = null where id = '55555555-0000-4000-8000-0000000000d1';
select is(
  (select sla_days_frozen from public.candidates where id = '55555555-0000-4000-8000-0000000000d1'),
  null::integer, 'Sem integração, SLA congelado é limpo');

-- Tarefas -------------------------------------------------------------------
insert into public.tasks (candidate_id, type, title, due_date)
values ('55555555-0000-4000-8000-0000000000d1', 'call', 'Ligar', current_date - 1);

select is(
  (select responsible_member_id from public.tasks where title = 'Ligar'),
  '33333333-0000-4000-8000-0000000000d1'::uuid, 'Responsável padrão da tarefa é quem criou');

update public.tasks set status = 'done' where title = 'Ligar';
select isnt(
  (select completed_at from public.tasks where title = 'Ligar'), null, 'Concluir preenche completed_at');

select is(
  (select completed_by_member_id from public.tasks where title = 'Ligar'),
  '33333333-0000-4000-8000-0000000000d1'::uuid, 'Concluir registra quem concluiu');

update public.tasks set status = 'pending' where title = 'Ligar';
select is(
  (select completed_at from public.tasks where title = 'Ligar'), null, 'Reabrir limpa completed_at');

select is(
  (select array_agg(action order by id) from public.candidate_history
    where candidate_id = '55555555-0000-4000-8000-0000000000d1' and action like 'task_%'),
  array['task_created', 'task_completed', 'task_reopened'], 'Ciclo da tarefa registrado no histórico');

select throws_ok(
  $$ delete from public.tasks where title = 'Ligar' $$, '42501', null, 'Tarefa não é excluída (cancela-se)');

-- Arquivamento (admin) ------------------------------------------------------
select lives_ok(
  $$ select public.archive_candidate('55555555-0000-4000-8000-0000000000d1') $$, 'Admin arquiva candidato');

select is(
  (select count(*) from public.audit_logs where entity_id = '55555555-0000-4000-8000-0000000000d1' and action = 'candidate_archived'),
  1::bigint, 'Arquivamento registrado na auditoria');

select throws_ok(
  $$ insert into public.tasks (candidate_id, type, title, due_date)
     values ('55555555-0000-4000-8000-0000000000d1', 'call', 'Arquivado', current_date) $$,
  '23514', null, 'Não cria tarefa para candidato arquivado');

select * from finish();
rollback;
