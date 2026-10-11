# CRM de Recrutamento

CRM mobile-first para gestão de candidatos: cadastro, status operacionais, Kanban,
agenda de tarefas, SLA de integração, dashboard e exportação.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase
(Auth, Postgres com RLS, Storage privado) · Vercel.

## Rodando localmente

Pré-requisitos: Node 24+, Docker em execução.

```bash
npm install
npm run db:start      # sobe o Supabase local (Docker)
npm run db:reset      # aplica migrations + seed de desenvolvimento
cp .env.example .env.local   # preencha com os valores de `npx supabase status`
npm run dev
```

Usuários de teste do ambiente local: ver o cabeçalho de `supabase/seed.sql`.

## Verificação

```bash
npm run check   # typecheck + lint + testes unitários + testes de banco (RLS) + build
```

| Comando | O que faz |
|---|---|
| `npm run typecheck` | Gera os tipos de rota e roda o TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |
| `npm run db:test` | Testes pgTAP: RLS, isolamento entre organizações, regras de negócio |
| `npm run db:types` | Regera `src/types/database.ts` a partir do banco local |
| `npm run test:e2e` | Reseta o banco local, faz o build de produção e roda os E2E (Playwright + Chrome; desktop, celular e acessibilidade) |

## Estrutura

```
supabase/migrations   schema, RLS, triggers e RPCs (fonte da verdade das regras)
supabase/tests        testes pgTAP
supabase/seed.sql     dados de desenvolvimento (nunca em produção)
src/app               rotas (finas: delegam para os módulos)
src/modules/<domínio> schema (Zod) · actions · service · queries · components
src/server            Supabase server client, sessão/autorização, erros, logger
src/lib               funções puras (CPF, telefone, permissões, datas)
scripts/              create-admin (1º administrador por ambiente)
docs/DECISIONS.md     decisões de arquitetura e de produto
```

## Produção

Passo a passo completo em [docs/DEPLOY.md](docs/DEPLOY.md).
