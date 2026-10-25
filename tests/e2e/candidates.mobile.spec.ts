import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, uniqueSuffix, USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test.describe("Celular: cadastro e ficha do candidato", () => {
  test("validação mostra erros nos campos obrigatórios", async ({ page }) => {
    await page.goto("/candidatos/novo");
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Informe o nome completo.")).toBeVisible();
    // Telefone e e-mail são opcionais (sem telefone: "telefone pendente").
    await expect(page.getByText("Informe telefone ou e-mail.")).toHaveCount(0);
  });

  test("telefone repetido é bloqueado (aviso e servidor)", async ({ page }) => {
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill("Outra Pessoa Mesmo Telefone");
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 97000-1371");
    await page.getByLabel("E-mail").focus();
    await expect(page.getByText(/Telefone já cadastrado para/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ana Paula Ferreira" })).toBeVisible();

    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Telefone já cadastrado.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/candidatos\/novo$/);
  });

  test("cadastro sem telefone fica com 'Telefone pendente' e aparece no filtro", async ({ page }) => {
    const name = `Sem Telefone ${uniqueSuffix()}`;
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill(name);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Telefone pendente").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ligar" })).toHaveCount(0);

    await page.goto("/candidatos?missing_phone=1");
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana Paula Ferreira/ })).toHaveCount(0);
  });

  test("CPF repetido é bloqueado (aviso e servidor)", async ({ page }) => {
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill("Pessoa Duplicada");
    await page.getByLabel("Telefone / WhatsApp").fill("11977776666");
    await page.getByLabel("CPF").fill("12346391905");
    await page.getByLabel("E-mail").focus();
    await expect(page.getByText(/CPF já cadastrado para/)).toBeVisible();

    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("CPF já cadastrado.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/candidatos\/novo$/);
  });

  test("fluxo 'Recebi um novo candidato': cadastro rápido, status, gerente, tarefa e histórico", async ({ page }) => {
    const name = `Teste Mobile ${uniqueSuffix()}`;
    // Telefone único por execução (telefone repetido bloqueia o cadastro).
    const phone = `1195${uniqueSuffix()}4`;
    await page.goto("/candidatos/novo");
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("Telefone / WhatsApp").fill(phone);
    await page.getByLabel("E-mail").fill(`um.email.muito.comprido.para.testar.quebra.${uniqueSuffix()}@empresa-exemplo.com.br`);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ligar" })).toHaveAttribute("href", `tel:+55${phone}`);
    await expect(page.getByRole("link", { name: "Abrir WhatsApp" }).first()).toHaveAttribute(
      "href",
      `https://wa.me/55${phone}`,
    );
    await expectNoHorizontalOverflow(page);

    // Status com motivo
    await page.getByRole("button", { name: "Alterar status" }).click();
    await page.getByRole("radio", { name: /Encaminhado/ }).click();
    await page.getByLabel("Motivo (opcional)").fill("Aprovado na seletiva");
    await page.getByRole("button", { name: "Salvar status" }).click();
    await expect(page.getByText("Status atualizado.")).toBeVisible();

    // Gerente com motivo
    await page.getByRole("button", { name: "Alterar gerente" }).click();
    await page.getByLabel("Gerente", { exact: true }).selectOption({ label: "Carlos Mendes" });
    await page.getByLabel("Motivo (opcional)").fill("Mora perto da equipe");
    await page.getByRole("button", { name: "Salvar gerente" }).click();
    await expect(page.getByText("Gerente atualizado.")).toBeVisible();

    // Próxima tarefa
    await page.getByRole("button", { name: "Nova tarefa" }).first().click();
    await page.getByRole("button", { name: "Amanhã" }).click();
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(page.getByText("Tarefa criada.")).toBeVisible();

    // Histórico
    await page.getByRole("tab", { name: /Histórico/ }).click();
    const history = page.getByRole("tabpanel");
    await expect(history.getByText("Alterou o status")).toBeVisible();
    await expect(history.getByText("Motivo: Aprovado na seletiva")).toBeVisible();
    await expect(history.getByText("Alterou o gerente")).toBeVisible();
    await expect(history.getByText("Motivo: Mora perto da equipe")).toBeVisible();
    await expect(history.getByText(/Criou a tarefa/)).toBeVisible();
    await expect(history.getByText("Cadastrou o candidato (status Seletiva)")).toBeVisible();
  });

  test("busca por telefone formatado e navegação inferior", async ({ page }) => {
    await page.goto("/candidatos");
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Buscar candidatos").fill("(11) 97000-1371");
    await expect(page.getByText("1 candidato encontrado")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana Paula Ferreira/ }).first()).toBeVisible();
    expect(page.url()).not.toContain("97000");

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await nav.getByRole("link", { name: "Agenda" }).click();
    await expect(page).toHaveURL(/\/agenda/);
  });

  test("Kanban no celular: abas por status e mover pelo menu", async ({ page }) => {
    await page.goto("/kanban");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("tab", { name: /Seletiva/ }).click();
    const card = page.getByRole("tabpanel").locator("article").filter({ hasText: "Camila Rodrigues" });
    await card.getByRole("button", { name: "Mover Camila Rodrigues" }).click();
    await page.getByRole("menuitem", { name: "Encaminhado" }).click();
    await expect(page.getByText("Camila Rodrigues → Encaminhado")).toBeVisible();
    await page.getByRole("tab", { name: /Encaminhado/ }).click();
    await expect(page.getByRole("tabpanel").getByText("Camila Rodrigues")).toBeVisible();
  });

  test("páginas principais sem rolagem horizontal", async ({ page }) => {
    for (const path of ["/inicio", "/agenda", "/agenda?view=no_next_action", "/sla", "/relatorios", "/configuracoes"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
