# F11 — Checklist de deploy de produção

Siga na ordem. Marque cada item antes de passar para o próximo.

**Legenda:**
- 🔐 = **secreto**: nunca no chat, nunca em arquivo versionado, só no gerenciador de senhas ou no arquivo local indicado.
- 🌐 = **público por design**: vai para o navegador; a proteção dos dados é o RLS do banco.

---

## 0. Pré-requisitos

- [ ] Contas no **GitHub**, no **Supabase** e na **Vercel** (dá para entrar na Vercel com o GitHub).
- [ ] Docker aberto e Node 24 na máquina.
- [ ] Gerenciador de senhas à mão, para a senha do banco e a chave secreta.
- [ ] Na pasta do projeto, `npm run check` passando (usa só o banco local).

---

## 1. Criar o projeto no Supabase

1. [ ] supabase.com → **Dashboard → New project**.
2. [ ] **Name:** `crm-rh-prod`.
3. [ ] **Database Password:** clique em *Generate a password* e salve no gerenciador de senhas 🔐.
4. [ ] **Region: South America (São Paulo)**, `sa-east-1`. Motivos:
   - os dados pessoais dos candidatos ficam no Brasil, o que facilita a conformidade com a LGPD;
   - a Vercel vai rodar em São Paulo (`gru1`, já configurado em `vercel.json`), então cada consulta ao banco leva poucos milissegundos em vez de ~120 ms até os EUA;
   - quem usa o sistema está no Brasil.
5. [ ] **Plano:**
   - *Free* serve para o deploy e para o teste operacional com dados fictícios;
   - **mude para Pro antes de cadastrar dados reais**: ele tem backup diário, e o projeto Free pausa depois de 7 dias sem uso.
6. [ ] Aguarde "Project is ready".

### 1.1 Autenticação
7. [ ] **Authentication → Sign In / Providers → Email:**
   - habilitado;
   - **desligue "Allow new users to sign up"** (o acesso é só para usuários criados pelo administrador);
   - Save.
8. [ ] Mesma tela:
   - *Minimum password length* = **8**;
   - *Password requirements* = letras e números;
   - Save.
9. [ ] A *URL Configuration* fica para o passo 7, quando houver domínio.

### 1.2 Credenciais: onde estão e para onde vão

| Item | Onde encontrar | Tipo | Onde colocar |
|---|---|---|---|
| Project ref (ex.: `abcd1234efgh`) | Project Settings → General → Project ID | não secreto | comando `supabase link` |
| Project URL `https://<ref>.supabase.co` | Project Settings → Data API / API Keys | 🌐 | Vercel e `.env.prod-admin` |
| Publishable key `sb_publishable_…` | Project Settings → API Keys | 🌐 | Vercel |
| Secret key `sb_secret_…` | Project Settings → API Keys → Secret keys → *Reveal* | 🔐 (ignora o RLS) | **só** no `.env.prod-admin` do seu computador, temporariamente |
| Senha do banco | criada no item 3 | 🔐 | digitada no terminal quando o `supabase link` pedir |

**Nunca:**
- chave secreta na Vercel;
- segredo no chat;
- segredo em arquivo que vai para o git.

---

## 2. Configurar o projeto local para produção

1. [ ] Conecte a CLI ao projeto:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   ```
   - O `login` abre o navegador para autorizar.
   - O `link` pede a senha do banco 🔐. Ela fica guardada pela CLI em `supabase/.temp`, que não vai para o git.
2. [ ] Crie na raiz do projeto o arquivo **`.env.prod-admin`**. Ele é temporário e já está ignorado pelo git:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU_REF.supabase.co
   SUPABASE_SECRET_KEY=COLE_AQUI_A_SECRET_KEY
   ```
   - ⚠️ **Não** use o nome `.env.production.local`. O Next carrega esse arquivo automaticamente e os testes locais passariam a gravar no banco de produção.
   - O `.env.local` continua apontando para o Supabase local. **Não altere.**

---

## 3. Aplicar as migrations

1. [ ] Veja o que será aplicado:
   ```bash
   npx supabase db push --dry-run
   ```
   Deve listar **11 migrations**, de `20261008120000_foundation` até `20261009090000_no_next_action_rule`.
2. [ ] Aplique (confirme com `y`):
   ```bash
   npx supabase db push
   ```
3. [ ] Confira:
   ```bash
   npx supabase migration list --linked
   ```
   As colunas *Local* e *Remote* devem ser iguais nas 11 linhas.
4. [ ] No painel:
   - **Table Editor:** tabelas `candidates`, `tasks`, `candidate_history` etc., todas marcadas "RLS enabled";
   - **Storage:** bucket `candidate-files` com selo **Private**.

Se uma migration falhar: cada uma roda em transação, então a que falhou não fica aplicada pela metade. Não corrija pelo painel. Me mande a mensagem de erro e faremos uma nova migration.

---

## 4. Seeds

- [ ] **Não rode `supabase/seed.sql` em produção.** Ele cria usuários de teste com senha conhecida.
  - O `db push` não executa o seed. Só executaria com `--include-seed`, que **não deve ser usado**.
- Os dados iniciais de produção nascem sozinhos quando a organização é criada (passo 5):
  - **6 status** (Seletiva, Encaminhado, Parceiro, Não está trabalhando, Desistiu, Não retornou);
  - **6 origens** (Facebook, Instagram, WhatsApp, Indicação, Site, Outros);
  - as configurações da organização (fuso de São Paulo, meta de SLA em branco).
- [ ] **Regiões, ramos e gerentes** reais: cadastre pela tela **Configurações** depois do primeiro login.

---

## 5. Criar o primeiro administrador

Use o e-mail de **quem vai operar o CRM** (a recrutadora).

1. [ ] Rode:
   ```bash
   npm run create-admin:prod -- --email EMAIL_DA_RECRUTADORA --name "NOME COMPLETO" --org "NOME DA OPERAÇÃO"
   ```
2. [ ] Digite a senha duas vezes no terminal. Ela não aparece na tela e precisa ter no mínimo 8 caracteres, com letras e números.
3. [ ] Esperado: `✔ Organização "…" e administrador … criados.`
4. [ ] Confira no Supabase:
   - **Authentication → Users:** o usuário aparece como confirmado;
   - **Table Editor → organization_members:** `role = admin`.
5. [ ] **(Recomendado) Organização de testes "QA"**, para os testes do passo 8 não sujarem os dados reais:
   ```bash
   npm run create-admin:prod -- --email SEU_EMAIL+qa@SEU_DOMINIO --name "QA" --org "QA Testes"
   ```
6. [ ] **Apague o arquivo da chave secreta:**
   ```bash
   rm .env.prod-admin
   ```

> Limitação do MVP: cada execução do script cria uma organização nova com um administrador. Ainda não há tela para convidar uma segunda pessoa para a mesma organização. Se precisar, me avise.

---

## 6. Repositório (GitHub) e Vercel

### 6.1 Commit e repositório privado
1. [ ] Rode `git status` e confirme que **não** aparecem `.env.local`, `.env.prod-admin` nem `tests/e2e/.auth/`.
2. [ ] Faça o commit (posso fazer por você se pedir):
   ```bash
   git add -A
   ```
   ```bash
   git commit -m "CRM de Recrutamento — MVP v1"
   ```
3. [ ] Em github.com/new:
   - nome `crm-rh`;
   - **Private**;
   - sem README nem .gitignore;
   - *Create repository*.
4. [ ] Envie o código (pode pedir autenticação do GitHub):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/crm-rh.git
   ```
   ```bash
   git push -u origin main
   ```
   Alternativa, se você usa o `gh`: `gh repo create crm-rh --private --source=. --push`.

> O `supabase/seed.sql` contém a senha dos usuários de teste **locais**. Ela só vale no banco do seu computador e não existe em produção.

### 6.2 Importar na Vercel e primeiro deploy
1. [ ] vercel.com:
   - **Add New… → Project → Import Git Repository**;
   - autorize o GitHub;
   - escolha `crm-rh` → **Import**.
2. [ ] Configuração do projeto:
   - **Framework:** Next.js (detectado);
   - **Root Directory:** `./`;
   - comandos de instalação e build: o padrão.
3. [ ] **Environment Variables**, antes de clicar em Deploy. São **somente estas duas**:

   | Nome | Valor | Ambientes | Tipo |
   |---|---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Production, Preview | 🌐 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key | Production, Preview | 🌐 |

   ❌ Não crie `SUPABASE_SECRET_KEY` na Vercel: o app não usa essa chave.
4. [ ] **Plano:**
   - *Hobby* é restrito a uso não comercial;
   - para uso profissional, *Pro*.
5. [ ] Clique em **Deploy** e aguarde "Congratulations" (1 a 2 min). Se o build falhar, me envie o trecho de erro do log (o log não contém segredos).
6. [ ] Em Project → **Settings → Functions**, confirme a região **São Paulo (gru1)**. Ela vem do `vercel.json`.

A partir daqui, todo `git push` na `main` gera um novo deploy de produção.

---

## 7. Validar o domínio

1. [ ] Em Project → **Domains**, pegue a URL padrão `https://<projeto>.vercel.app`. Ao abrir, deve carregar a tela de login, com cadeado HTTPS.
2. [ ] Confira os cabeçalhos de segurança:
   ```bash
   curl -sI https://SEU_DOMINIO/login
   ```
   Devem aparecer `strict-transport-security`, `x-frame-options: DENY`, `x-content-type-options: nosniff` e `referrer-policy`.
3. [ ] **(Opcional) Domínio próprio:**
   - Settings → Domains → *Add* (ex.: `crm.seudominio.com.br`);
   - no registrador do domínio, crie o registro que a Vercel mostrar: `CNAME → cname.vercel-dns.com` para subdomínio, `A → 76.76.21.21` para domínio raiz;
   - aguarde "Valid Configuration" e o certificado.
4. [ ] Supabase → **Authentication → URL Configuration:**
   - **Site URL** = o domínio final;
   - **Redirect URLs** = `https://SEU_DOMINIO/**` (e também a URL `.vercel.app`);
   - Save.

---

## 8. Testes em produção (smoke test)

Faça os testes funcionais **logado na organização "QA Testes"** (passo 5.5). Os dados reais ficam limpos, e a QA serve para o teste manual de isolamento.

Para os comandos abaixo, guarde a chave pública só na sessão do terminal (é pública, mas não precisa ir para o chat):

```bash
export PUB=COLE_A_PUBLISHABLE_KEY_AQUI
```

### 8.1 Autenticação
- [ ] Aba anônima → `https://SEU_DOMINIO/candidatos` → vai para `/login?next=%2Fcandidatos`.
- [ ] Senha errada → "E-mail ou senha incorretos."
- [ ] Senha certa → volta para /candidatos, com nome e organização no menu.
- [ ] No celular:
  - login;
  - *Compartilhar → Adicionar à Tela de Início* (iPhone) ou *Instalar app* (Android).
- [ ] **Sair** → tela de login. Ao abrir `/inicio` de novo, pede login.
- [ ] API sem sessão é recusada (esperado: `401`):
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://SEU_DOMINIO/api/export
  ```
- [ ] Cadastro público desligado (esperado: mensagem de *signups not allowed*):
  ```bash
  curl -s https://SEU_REF.supabase.co/auth/v1/signup -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"teste@exemplo.com","password":"Teste12345"}'
  ```

### 8.2 RLS / isolamento
- [ ] **Testes automáticos no banco de produção:** rode `npx supabase test db --linked`.
  - Esperado: `All tests successful` (76 testes).
  - Cada arquivo roda numa transação desfeita no fim (`ROLLBACK`), então **nada fica gravado**.
  - Precisa do Docker aberto.
- [ ] Anônimo não lê dados. Esperado: erro de permissão (`42501`), **nunca** uma lista:
  ```bash
  curl -s "https://SEU_REF.supabase.co/rest/v1/candidates?select=id" -H "apikey: $PUB"
  ```
- [ ] Isolamento manual:
  - cadastre "Teste QA" na organização QA;
  - entre com o administrador real e busque "Teste QA" → **nenhum resultado**;
  - repita no sentido inverso.
- [ ] Supabase → **Advisors → Security Advisor** → nenhum item **ERROR**.

### 8.3 Storage / currículo
- [ ] Ficha → **Documentos** → envie um PDF (no celular, um arquivo ou uma foto JPG) → aparece como "atual".
- [ ] **Ver** → abre o arquivo. O endereço contém `/storage/v1/object/sign/…token=…`.
- [ ] Copie esse endereço, espere **2 minutos** e abra numa aba anônima → erro (link expirado).
- [ ] **Baixar** → o arquivo vem com o nome original.
- [ ] Envie outro currículo → o anterior vira "versão anterior".
- [ ] Supabase:
  - **Storage → candidate-files** está *Private*;
  - **Table Editor → audit_logs** tem `document_view` e `document_download`.

### 8.4 Funcional
- [ ] **Cadastro:**
  - rápido no celular (só nome e telefone → *Salvar*);
  - completo no desktop;
  - CPF repetido é **bloqueado**; telefone repetido só **avisa**;
  - os botões *Ligar* e *WhatsApp* abrem os apps.
- [ ] **Edição:**
  - status e gerente com motivo;
  - data da entrevista;
  - tudo aparece no **Histórico** com antes, depois, usuário e horário.
- [ ] **Kanban:**
  - arrastar no desktop;
  - botão ⇄ no celular;
  - a mudança aparece no histórico.
- [ ] **Agenda:**
  - tarefa "Amanhã" → aparece em *Próximas*;
  - tarefa "Hoje" → concluir → aparece em *Concluídas*;
  - tarefa com data passada → aparece em *Atrasadas* e **não** em *Sem próxima ação*.
- [ ] **SLA:**
  - data de integração = hoje → a ficha mostra "SLA (concluído)";
  - aparece em *Integrações mais recentes*;
  - data futura é recusada.
- [ ] **Dashboard:** os números batem com a lista filtrada; o filtro por gerente funciona.
- [ ] **Exportação:** Relatórios → filtrar → *Exportar CSV* → abre no Excel com acentos corretos, com o mesmo número de linhas do contador.
- [ ] **Configurações** (na organização real): cadastre as regiões, os ramos e os gerentes reais.

---

## 9. Rollback

### Aplicação (Vercel): segundos, sem perda de dados
- [ ] Vercel → **Deployments** → último deploy bom → **⋯ → Promote to Production** (*Instant Rollback*). Pela CLI: `npx vercel rollback`.
- Variável de ambiente errada:
  1. corrija em Settings → Environment Variables;
  2. em **Deployments → ⋯ → Redeploy** (a variável só passa a valer depois do redeploy).
- Pelo git: `git revert <commit>` e `git push`. A Vercel publica a versão revertida.

### Banco (Supabase): as migrations só avançam
- **Primeiro deploy (sem dados reais):** se o banco ficar inconsistente, o caminho mais limpo é:
  1. criar outro projeto Supabase;
  2. repetir os passos 1 a 5;
  3. trocar as duas variáveis na Vercel e fazer *Redeploy*.
- **Com dados reais:**
  - antes de **cada** nova migration, faça backup. São dados pessoais: guarde fora do git e fora de nuvens públicas.
    ```bash
    npx supabase db dump --linked -f backup-estrutura-AAAA-MM-DD.sql
    ```
    ```bash
    npx supabase db dump --linked --data-only -f backup-dados-AAAA-MM-DD.sql
    ```
  - correções são feitas com uma **nova migration** de reversão, nunca editando o banco à mão;
  - no plano **Pro**, o backup diário pode ser restaurado em Database → Backups.
- As migrations atuais só adicionam estrutura, então voltar a aplicação para o deploy anterior não quebra o banco.

---

## 10. Depois do deploy (fora deste checklist)

Fazer um teste operacional real, com 10 a 20 candidatos no fluxo verdadeiro:

> cadastro → origem → gerente → status → documento → tarefa → entrevista → integração → SLA

Anotar onde há demora, cliques demais e informação faltando. Isso gera a **V2**.

Continuam fora: WhatsApp em massa, discador, IA, automações complexas, cobrança e SaaS comercial.
