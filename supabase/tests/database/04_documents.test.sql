-- Storage privado e registro de documentos: isolamento por organização.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'g-admin@test.local', '{"full_name":"G Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', 'h-admin@test.local', '{"full_name":"H Admin"}');
insert into public.organizations (id, name, slug) values
  ('22222222-0000-4000-8000-0000000000f1', 'Org G', 'org-g-test'),
  ('22222222-0000-4000-8000-0000000000f2', 'Org H', 'org-h-test');
insert into public.organization_members (id, organization_id, user_id, role) values
  ('33333333-0000-4000-8000-0000000000f1', '22222222-0000-4000-8000-0000000000f1', '11111111-0000-4000-8000-0000000000f1', 'admin'),
  ('33333333-0000-4000-8000-0000000000f2', '22222222-0000-4000-8000-0000000000f2', '11111111-0000-4000-8000-0000000000f2', 'admin');
insert into public.candidates (id, organization_id, full_name, phone, status_id, responsible_member_id) values
  ('55555555-0000-4000-8000-0000000000f1', '22222222-0000-4000-8000-0000000000f1', 'Candidato G', '5511922220001',
   (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000f1' and position = 0),
   '33333333-0000-4000-8000-0000000000f1'),
  ('55555555-0000-4000-8000-0000000000f2', '22222222-0000-4000-8000-0000000000f2', 'Candidato H', '5511922220002',
   (select id from public.candidate_statuses where organization_id = '22222222-0000-4000-8000-0000000000f2' and position = 0),
   '33333333-0000-4000-8000-0000000000f2');

-- Arquivo já existente da organização H (criado como postgres).
insert into storage.objects (bucket_id, name) values
  ('candidate-files', '22222222-0000-4000-8000-0000000000f2/55555555-0000-4000-8000-0000000000f2/cv.pdf');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-0000000000f1","role":"authenticated"}', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('candidate-files', '22222222-0000-4000-8000-0000000000f1/55555555-0000-4000-8000-0000000000f1/cv.pdf',
             '11111111-0000-4000-8000-0000000000f1') $$,
  'G envia arquivo para o próprio candidato');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('candidate-files', '22222222-0000-4000-8000-0000000000f2/55555555-0000-4000-8000-0000000000f2/x.pdf',
             '11111111-0000-4000-8000-0000000000f1') $$,
  '42501', null, 'G não envia arquivo para a pasta da organização H');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('candidate-files', '22222222-0000-4000-8000-0000000000f1/55555555-0000-4000-8000-0000000000f2/x.pdf',
             '11111111-0000-4000-8000-0000000000f1') $$,
  '42501', null, 'G não usa candidato de H dentro da própria pasta');

select is_empty(
  $$ select 1 from storage.objects where name like '22222222-0000-4000-8000-0000000000f2/%' $$,
  'G não lista arquivos de H');

select lives_ok(
  $$ select public.register_candidate_document('55555555-0000-4000-8000-0000000000f1', 'resume', 'cv.pdf',
       '22222222-0000-4000-8000-0000000000f1/55555555-0000-4000-8000-0000000000f1/cv.pdf', 'application/pdf', 1000) $$,
  'G registra o documento enviado');

select is(
  (select count(*) from public.candidate_history
    where candidate_id = '55555555-0000-4000-8000-0000000000f1' and action = 'document_uploaded'),
  1::bigint, 'Upload registrado no histórico');

select throws_ok(
  $$ select public.register_candidate_document('55555555-0000-4000-8000-0000000000f2', 'resume', 'cv.pdf',
       '22222222-0000-4000-8000-0000000000f2/55555555-0000-4000-8000-0000000000f2/cv.pdf', 'application/pdf', 1000) $$,
  'P0002', null, 'G não registra documento em candidato de H');

select throws_ok(
  $$ insert into public.candidate_documents (organization_id, candidate_id, file_name, storage_path, mime_type, size_bytes)
     values ('22222222-0000-4000-8000-0000000000f1', '55555555-0000-4000-8000-0000000000f1', 'x.pdf',
             '22222222-0000-4000-8000-0000000000f1/55555555-0000-4000-8000-0000000000f1/x.pdf', 'application/pdf', 10) $$,
  '42501', null, 'Metadados só entram pela RPC');

select * from finish();
rollback;
