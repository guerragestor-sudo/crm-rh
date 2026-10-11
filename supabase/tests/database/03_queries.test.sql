-- Filtros combinados, busca, duplicidade, dashboard e SLA: semântica e isolamento.
begin;
create extension if not exists pgtap with schema extensions;
-- No Supabase remoto a CLI conecta como cli_login_postgres, sem acesso ao schema
-- "extensions" (onde fica o pgTAP): os testes rodam como postgres.
set local role postgres;
set local search_path to public, extensions;

select plan(19);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'e-admin@test.local', '{"full_name":"E Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', 'f-admin@test.local', '{"full_name":"F Admin"}');
insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-0000000000e1', 'Org E', 'org-e-test'),
  ('22222222-0000-4000-8000-0000000000e2', 'Org F', 'org-f-test');
insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-0000000000e1', '22222222-0000-4000-8000-0000000000e1', '11111111-0000-4000-8000-0000000000e1', 'admin'),
  ('33333333-0000-4000-8000-0000000000e2', '22222222-0000-4000-8000-0000000000e2', '11111111-0000-4000-8000-0000000000e2', 'admin');

insert into public.regions (id, organization_id, name) values
  ('66666666-0000-4000-8000-0000000000e1', '22222222-0000-4000-8000-0000000000e1', 'Osasco'),
  ('66666666-0000-4000-8000-0000000000e2', '22222222-0000-4000-8000-0000000000e1', 'Centro');
insert into public.segments (id, organization_id, name) values
  ('77777777-0000-4000-8000-0000000000e1', '22222222-0000-4000-8000-0000000000e1', 'Vendas');

create temporary table ref on commit drop as
select
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000e1' and name = 'Seletiva') as seletiva,
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000e1' and name = 'Encaminhado') as encaminhado,
  (select id from public.sources where organization_id = '22222222-0000-4000-8000-0000000000e1' and name = 'Indicação') as indicacao,
  (select id from public.sources where organization_id = '22222222-0000-4000-8000-0000000000e1' and name = 'Facebook') as facebook;
grant select on ref to authenticated;

-- 4 candidatos na org E; só o primeiro atende Osasco + Encaminhado + Indicação + Vendas.
insert into public.candidates (organization_id, full_name, phone, email, region_id, segment_id, source_id, status_id, responsible_member_id, created_at, integration_date)
select '22222222-0000-4000-8000-0000000000e1', v.name, v.phone, v.email, v.region, v.segment, v.source, v.status, '33333333-0000-4000-8000-0000000000e1', now() - (v.age * interval '1 day'), v.integration
from (
  select 'José Ávila' as name, '5511911110001' as phone, 'jose@x.com' as email, '66666666-0000-4000-8000-0000000000e1'::uuid as region,
         '77777777-0000-4000-8000-0000000000e1'::uuid as segment, (select indicacao from ref) as source, (select encaminhado from ref) as status,
         10 as age, (now() at time zone 'America/Sao_Paulo')::date - 2 as integration
  union all select 'Maria Souza', '5511911110002', null, '66666666-0000-4000-8000-0000000000e1', '77777777-0000-4000-8000-0000000000e1', (select facebook from ref), (select encaminhado from ref), 20, (now() at time zone 'America/Sao_Paulo')::date - 4
  union all select 'Pedro Lima', '5511911110003', null, '66666666-0000-4000-8000-0000000000e2', '77777777-0000-4000-8000-0000000000e1', (select indicacao from ref), (select encaminhado from ref), 30, null
  union all select 'Ana Costa', '5511911110004', null, '66666666-0000-4000-8000-0000000000e1', null, (select indicacao from ref), (select seletiva from ref), 5, null
) v;

-- Candidato na org F com o mesmo telefone de José (não pode vazar para E).
insert into public.candidates (organization_id, full_name, phone, status_id, responsible_member_id)
values ('22222222-0000-4000-8000-0000000000e2', 'José da Org F', '5511911110001',
  (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000e2' and position = 0),
  '33333333-0000-4000-8000-0000000000e2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000e1","role":"authenticated"}', true);

select is((select count(*) from public.filter_candidates('{}')), 4::bigint, 'Sem filtros: só os candidatos ativos da própria organização');

select results_eq(
  $$ select full_name from public.filter_candidates(jsonb_build_object(
       'region_ids', jsonb_build_array('66666666-0000-4000-8000-0000000000e1'),
       'status_ids', jsonb_build_array((select encaminhado from ref)),
       'source_ids', jsonb_build_array((select indicacao from ref)),
       'segment_ids', jsonb_build_array('77777777-0000-4000-8000-0000000000e1'))) $$,
  $$ values ('José Ávila'::text) $$,
  'Filtros combinados (E): Osasco + Encaminhado + Indicação + Vendas');

select is((select count(*) from public.filter_candidates('{"q":"jose"}')), 1::bigint, 'Busca ignora acentos e maiúsculas');
select is((select count(*) from public.filter_candidates('{"q":"911110003"}')), 1::bigint, 'Busca por parte do telefone');
select is((select count(*) from public.filter_candidates('{"q":"jose@x"}')), 1::bigint, 'Busca por e-mail');
select is((select count(*) from public.filter_candidates('{"q":"100%"}')), 0::bigint, 'Curingas do LIKE são tratados como texto');
select is((select count(*) from public.filter_candidates('{"integration":"done"}')), 2::bigint, 'Filtro de integrados');
select is((select count(*) from public.filter_candidates('{"integration":"pending"}')), 2::bigint, 'Filtro de aguardando integração');
select is(
  (select count(*) from public.filter_candidates(jsonb_build_object(
     'created_from', ((now() at time zone 'America/Sao_Paulo')::date - 15)::text))),
  2::bigint, 'Período de cadastro');
select is((select count(*) from public.filter_candidates('{"no_next_action":true}')), 4::bigint, 'Sem tarefas: todos sem próxima ação');

-- Atrasadas x sem próxima ação: grupos separados.
insert into public.tasks (candidate_id, type, title, due_date)
select id, 'call', 'Ligação atrasada', current_date - 3 from public.candidates where full_name = 'José Ávila';
insert into public.tasks (candidate_id, type, title, due_date)
select id, 'call', 'Ligação futura', current_date + 3 from public.candidates where full_name = 'Maria Souza';

select is(
  (select array_agg(full_name order by full_name) from public.filter_candidates('{"no_next_action":true}')),
  array['Ana Costa', 'Pedro Lima'], 'Sem próxima ação: só quem não tem nenhuma tarefa pendente');
select is(
  (select array_agg(full_name) from public.filter_candidates('{"has_overdue_task":true}')),
  array['José Ávila'], 'Atrasadas: candidato com tarefa vencida (não aparece em sem próxima ação)');
select is(
  (public.dashboard_summary('{}') -> 'totals' ->> 'no_next_action')::int, 2, 'Dashboard usa a mesma regra');

select is(
  (select count(*) from public.find_candidate_duplicates(null, '5511911110001', null)),
  1::bigint, 'Duplicidade por telefone não enxerga outra organização');

select is(
  (public.dashboard_summary('{}') -> 'totals' ->> 'active')::int, 4, 'Dashboard: ativos');
select is(
  (public.dashboard_summary('{}') -> 'sla' ->> 'completed_count')::int, 2, 'Dashboard: integrados');
select is(
  (public.dashboard_summary('{}') -> 'sla' ->> 'median')::numeric, 12::numeric, 'Dashboard: SLA mediano (8 e 16 dias)');

select is(
  (select jsonb_agg(x ->> 'name' order by x ->> 'name') from jsonb_array_elements(public.sla_breakdown('{}', 'region')) x),
  '["Centro", "Osasco"]'::jsonb, 'SLA agrupado por região');

-- Organização F não vê nada da E
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select is((select count(*) from public.filter_candidates('{"q":"jose"}')), 1::bigint, 'Org F só encontra o próprio José');

select * from finish();
rollback;
