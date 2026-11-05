-- Novidades do app: cada usuário marca só o próprio "visto", sem voltar para trás.
begin;
create extension if not exists pgtap with schema extensions;
-- No Supabase remoto a CLI conecta como cli_login_postgres, sem acesso ao schema
-- "extensions" (onde fica o pgTAP): os testes rodam como postgres.
set local role postgres;
set local search_path to public, extensions;

select plan(9);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'k-admin@test.local', '{"full_name":"K Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'k-rec@test.local', '{"full_name":"K Recrutadora"}');
insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-0000000000c1', 'Org K', 'org-k-test');
insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-0000000000c1', '22222222-0000-4000-8000-0000000000c1', '11111111-0000-4000-8000-0000000000c1', 'admin'),
  ('33333333-0000-4000-8000-0000000000c2', '22222222-0000-4000-8000-0000000000c1', '11111111-0000-4000-8000-0000000000c2', 'recruiter');

-- Sem sessão não marca nada.
set local role anon;
select throws_ok($$ select public.mark_updates_seen(1) $$, '42501', null, 'anon não executa');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000c2","role":"authenticated"}', true);

select is(
  (select updates_seen from public.organization_members where id = '33333333-0000-4000-8000-0000000000c2'),
  null::integer, 'quem nunca viu começa nulo');
select is(public.mark_updates_seen(3), 3, 'recrutadora marca a novidade 3');
select is(public.mark_updates_seen(2), 3, 'marcar uma mais antiga não volta para trás');
select throws_ok($$ select public.mark_updates_seen(0) $$, '22023', null, 'id inválido é recusado');
select throws_ok(
  $$ update public.organization_members set updates_seen = 99 where id = '33333333-0000-4000-8000-0000000000c2' $$,
  '42501', null, 'a coluna não é gravada direto, só pela função');

set local role postgres;
select is(
  (select updates_seen from public.organization_members where id = '33333333-0000-4000-8000-0000000000c2'),
  3, 'gravou só o maior id visto');
select is(
  (select updates_seen from public.organization_members where id = '33333333-0000-4000-8000-0000000000c1'),
  null::integer, 'o administrador da mesma organização não foi afetado');

-- Usuário sem vínculo ativo não marca.
update public.organization_members set status = 'inactive' where id = '33333333-0000-4000-8000-0000000000c2';
set local role authenticated;
select throws_ok($$ select public.mark_updates_seen(4) $$, '42501', null, 'vínculo inativo não marca');

select * from finish();
rollback;
