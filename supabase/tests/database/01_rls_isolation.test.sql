-- Isolamento entre organizações, privilégios por coluna e papéis.
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- -----------------------------------------------------------------------------
-- Fixtures (como postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a-admin@test.local', '{"full_name":"A Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'a-rec@test.local', '{"full_name":"A Recrutador"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'b-admin@test.local', '{"full_name":"B Admin"}');

insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-00000000000a', 'Org A', 'org-a-test'),
  ('22222222-0000-4000-8000-00000000000b', 'Org B', 'org-b-test');

insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'admin'),
  ('33333333-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000b', 'recruiter'),
  ('33333333-0000-4000-8000-00000000000c', '22222222-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000c', 'admin');

insert into public.managers (id, organization_id, name) values
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000a', 'Gerente A1'),
  ('44444444-0000-4000-8000-0000000000a2', '22222222-0000-4000-8000-00000000000a', 'Gerente A2'),
  ('44444444-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-00000000000b', 'Gerente B');

insert into public.candidates (id, organization_id, full_name, phone, cpf, status_id, manager_id, responsible_member_id)
values
  ('55555555-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000a', 'Candidato A', '5511900000001', '11144477735',
   (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-00000000000a' and position = 0),
   '44444444-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-00000000000a'),
  ('55555555-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-00000000000b', 'Candidato B', '5511900000002', null,
   (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-00000000000b' and position = 0),
   null, '33333333-0000-4000-8000-00000000000c');

-- Ids de referência para os testes
create temporary table ids on commit drop as
select
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-00000000000a' and position = 1) as status_a2,
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-00000000000b' and position = 1) as status_b2;
grant select on ids to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Admin da organização A
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*) from public.candidates where organization_id in ('22222222-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000b')),
  1::bigint, 'A vê somente candidatos da própria organização');

select is_empty(
  $$ select 1 from public.candidates where id = '55555555-0000-4000-8000-00000000000b' $$,
  'A não lê candidato da organização B pelo id');

select is((select count(*) from public.candidate_statuses), 6::bigint, 'A vê apenas os 6 status da própria organização');

select is((select count(*) from public.managers), 2::bigint, 'A vê apenas gerentes da própria organização');

select is_empty(
  $$ select 1 from public.candidate_history where candidate_id = '55555555-0000-4000-8000-00000000000b' $$,
  'A não lê histórico de candidato de B');

select throws_ok(
  $$ insert into public.candidates (organization_id, full_name, phone, status_id)
     values ('22222222-0000-4000-8000-00000000000b', 'Intruso', '5511900000009', (select status_b2 from ids)) $$,
  '42501', null, 'organization_id não pode ser enviado pelo cliente');

select lives_ok(
  $$ insert into public.candidates (full_name, phone, status_id)
     values ('Novo A', '5511900000003', (select status_a2 from ids)) $$,
  'A cria candidato e a organização vem da sessão');

select is(
  (select organization_id from public.candidates where full_name = 'Novo A'),
  '22222222-0000-4000-8000-00000000000a'::uuid, 'Candidato criado ficou na organização A');

select throws_ok(
  $$ insert into public.candidates (full_name, phone, status_id)
     values ('Status de B', '5511900000004', (select status_b2 from ids)) $$,
  '23503', null, 'FK composta impede usar status de outra organização');

select lives_ok(
  $$ update public.candidates set full_name = 'Hack' where id = '55555555-0000-4000-8000-00000000000b' $$,
  'Update em candidato de B não falha, mas não encontra linhas (verificado como B)');

select throws_ok(
  $$ update public.candidates set status_id = (select status_a2 from ids) where id = '55555555-0000-4000-8000-00000000000a' $$,
  '42501', null, 'status_id não pode ser alterado diretamente');

select throws_ok(
  $$ update public.candidates set manager_id = null where id = '55555555-0000-4000-8000-00000000000a' $$,
  '42501', null, 'manager_id não pode ser alterado diretamente');

select lives_ok(
  $$ select public.change_candidate_status('55555555-0000-4000-8000-00000000000a', (select status_a2 from ids), 'Passou na seletiva') $$,
  'RPC altera o status do próprio candidato');

select results_eq(
  $$ select action, old_value, new_value, reason, actor_member_id
       from public.candidate_history
      where candidate_id = '55555555-0000-4000-8000-00000000000a' and action = 'status_changed' $$,
  $$ values ('status_changed'::text, 'Seletiva'::text, 'Encaminhado'::text, 'Passou na seletiva'::text,
             '33333333-0000-4000-8000-00000000000a'::uuid) $$,
  'Mudança de status registrada com anterior, novo, motivo e autor');

select throws_ok(
  $$ select public.change_candidate_status('55555555-0000-4000-8000-00000000000b', (select status_a2 from ids), null) $$,
  'P0002', null, 'RPC de status não alcança candidato de B');

select lives_ok(
  $$ select public.change_candidate_manager('55555555-0000-4000-8000-00000000000a', '44444444-0000-4000-8000-0000000000a2', 'Mudou de região') $$,
  'RPC altera o gerente');

select results_eq(
  $$ select old_value, new_value, reason, actor_member_id
       from public.candidate_history
      where candidate_id = '55555555-0000-4000-8000-00000000000a' and action = 'manager_changed' $$,
  $$ values ('Gerente A1'::text, 'Gerente A2'::text, 'Mudou de região'::text,
             '33333333-0000-4000-8000-00000000000a'::uuid) $$,
  'Troca de gerente registrada com anterior, novo, motivo e autor');

select throws_ok(
  $$ select public.change_candidate_manager('55555555-0000-4000-8000-00000000000a', '44444444-0000-4000-8000-00000000000b', null) $$,
  '22023', null, 'Não aceita gerente de outra organização');

select throws_ok(
  $$ insert into public.candidate_history (organization_id, candidate_id, action)
     values ('22222222-0000-4000-8000-00000000000a', '55555555-0000-4000-8000-00000000000a', 'updated') $$,
  '42501', null, 'Histórico não aceita inserção direta');

select throws_ok(
  $$ delete from public.candidate_history where candidate_id = '55555555-0000-4000-8000-00000000000a' $$,
  '42501', null, 'Histórico não pode ser apagado');

select throws_ok(
  $$ delete from public.candidates where id = '55555555-0000-4000-8000-00000000000a' $$,
  '42501', null, 'Candidato não pode ser excluído pela API');

select throws_ok(
  $$ insert into public.candidates (full_name, phone, cpf, status_id)
     values ('CPF repetido', '5511900000005', '11144477735', (select status_a2 from ids)) $$,
  '23505', null, 'CPF repetido na mesma organização é bloqueado');

select throws_ok(
  $$ insert into public.tasks (candidate_id, type, title, due_date)
     values ('55555555-0000-4000-8000-00000000000b', 'call', 'Tarefa indevida', current_date) $$,
  '23503', null, 'Não cria tarefa para candidato de outra organização');

select is(
  (select private.can_access_candidate_file(
     '22222222-0000-4000-8000-00000000000b/55555555-0000-4000-8000-00000000000b/x.pdf', false)),
  false, 'Storage: A não acessa arquivo no caminho de B');

select is(
  (select private.can_access_candidate_file(
     '22222222-0000-4000-8000-00000000000a/55555555-0000-4000-8000-00000000000a/x.pdf', true)),
  true, 'Storage: A acessa o caminho do próprio candidato');

-- -----------------------------------------------------------------------------
-- Recrutador da organização A
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.regions (name) values ('Região indevida') $$,
  '42501', null, 'Recrutador não altera configurações');

select throws_ok(
  $$ select public.archive_candidate('55555555-0000-4000-8000-00000000000a') $$,
  '42501', null, 'Recrutador não arquiva candidato');

select is((select count(*) from public.audit_logs), 0::bigint, 'Recrutador não lê a auditoria');

-- -----------------------------------------------------------------------------
-- Admin da organização B
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000c","role":"authenticated"}', true);

select is(
  (select count(*) from public.candidates where organization_id in ('22222222-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000b')),
  1::bigint, 'B vê somente o próprio candidato');

select is(
  (select full_name from public.candidates where id = '55555555-0000-4000-8000-00000000000b'),
  'Candidato B', 'Candidato de B não foi alterado por A');

-- -----------------------------------------------------------------------------
-- Anônimo
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select 1 from public.candidates $$,
  '42501', null, 'Usuário anônimo não acessa candidatos');

select * from finish();
rollback;
