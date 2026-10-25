# Decisões — CRM de Recrutamento

Registro curto das decisões vigentes. Data de referência: 08/10/2026.

## Produto

| ID | Decisão |
|---|---|
| P1 | Status operacionais: Seletiva, Encaminhado, Parceiro, Não está trabalhando, Desistiu, Não retornou. **Sem categoria** (open/won/lost): nenhuma regra do sistema depende do status. Novos status = nova linha em `candidate_statuses`. |
| P2 | Candidato **ativo** = não arquivado (`archived_at is null`), independente do status. |
| P3 | **Atrasadas** e **Sem próxima ação** são grupos separados (ajuste de 09/10/2026). Atrasada = candidato com tarefa `pending` cujo prazo já passou. Sem próxima ação = candidato ativo **sem nenhuma** tarefa `pending`. Quem tem tarefa atrasada aparece só em "Atrasadas". |
| P4 | **SLA** em dias civis no fuso da organização. Concluído: `integration_date − data local de created_at`. Em andamento: `hoje − data local de created_at`. Ao preencher a integração, o valor é **congelado** em `sla_days_frozen`; corrigir a data recalcula e registra no histórico. |
| P5 | `integration_date` não pode ser futura nem anterior à data de cadastro (o SLA perderia sentido). |
| P6 | `manager_id` = gerente para quem o candidato será direcionado. Após o cadastro, gerente e status só mudam pelas RPCs `change_candidate_manager` / `change_candidate_status`, que registram anterior, novo, autor, data/hora e motivo. |
| P7 | **Duplicidade pelo telefone** (ajuste de 24/10/2026): telefone repetido bloqueia (único por organização), porque nem todo candidato envia documentos no início. CPF, quando preenchido, também bloqueia. E-mail repetido só gera aviso. Telefone e e-mail são opcionais: sem telefone, a ficha mostra **Telefone pendente** e aparece no filtro de mesmo nome. |
| P8 | Tarefas têm data livre (sem cadência). Não são excluídas: são canceladas. |
| P9 | Diretores e gerentes não têm login no MVP. Uso próprio do recrutador (Admin). |

## Arquitetura e segurança

| ID | Decisão |
|---|---|
| A1 | Next.js 16 com **Cache Components desligado**: app 100% autenticado e nenhum dado de organização pode ir para cache compartilhado. Páginas autenticadas são dinâmicas. |
| A2 | Segurança em camadas: `proxy.ts` só renova sessão/redireciona; páginas, Server Actions e Route Handlers validam a sessão (`getClaims`) e a permissão; o **RLS** do Postgres isola por organização. |
| A3 | `organization_id`, autor e datas de criação são definidos por trigger a partir da sessão; o cliente não tem privilégio de gravar essas colunas (GRANT por coluna). |
| A4 | FKs compostas `(organization_id, x_id)` em toda referência entre tabelas de negócio: impossível apontar para registro de outra organização. |
| A5 | Funções `SECURITY DEFINER` só no schema `private` (não exposto), com `search_path = ''`; a API usa wrappers `SECURITY INVOKER` em `public`. |
| A6 | Histórico (`candidate_history`) e auditoria (`audit_logs`) são somente acréscimo: escritos por triggers/funções privadas; usuários só leem. |
| A7 | Arquivos no bucket privado `candidate-files` (`{org}/{candidato}/{arquivo}`); download por URL assinada de curta duração. |
| A8 | `service_role`/chave secreta nunca é usada pelo app; só pelo script `create-admin`. |
| A9 | `text + CHECK` em vez de ENUM; `timestamptz` para momentos, `date` para datas civis. |
| A10 | Logs estruturados sem dados pessoais (apenas ids e códigos). |
