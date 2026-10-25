import { expect, test } from "@playwright/test";

import { login, USERS } from "./helpers";

test.describe("Autenticação e proteção de rotas", () => {
  test("visitante é levado ao login, preservando o destino", async ({ page }) => {
    await page.goto("/candidatos");
    await expect(page).toHaveURL(/\/login\?next=%2Fcandidatos/);
    await expect(page.getByRole("heading", { name: "CRM Recrutamento" })).toBeVisible();
  });

  test("senha errada mostra erro e não entra", async ({ page }) => {
    await login(page, USERS.admin.email, "senha-errada-123");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("validação do formulário de login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("login, redirecionamento para o destino e logout", async ({ page }) => {
    await page.goto("/agenda");
    await page.getByLabel("E-mail").fill(USERS.admin.email);
    await page.getByLabel("Senha").fill(process.env.E2E_PASSWORD ?? "CrmDemo2026!");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/agenda$/);

    // Um filtro salvo na lista é apagado ao sair (aparelho compartilhado).
    await page.goto("/candidatos?missing_phone=1");
    await expect(page.getByRole("button", { name: "Limpar filtros (1)" })).toBeVisible();
    const savedFilter = async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === "crm_filtros_candidatos");
    expect(await savedFilter()).toBe(true);

    await page.getByRole("button", { name: "Menu do usuário" }).first().click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await savedFilter()).toBe(false);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
  });

  test("APIs recusam acesso sem sessão", async ({ request }) => {
    const exportResponse = await request.post("/api/export", { data: { filters: {} } });
    expect(exportResponse.status()).toBe(401);
    const documentResponse = await request.get("/api/documentos/00000000-0000-4000-8000-000000000000");
    expect(documentResponse.status()).toBe(401);
  });
});

test.describe("Permissões do recrutador", () => {
  test.use({ storageState: USERS.recruiter.file });

  test("não acessa configurações nem arquiva candidatos", async ({ page }) => {
    await page.goto("/configuracoes");
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);

    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Bruno Henrique Costa" }).first().click();
    await expect(page.getByRole("heading", { name: "Bruno Henrique Costa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arquivar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  });
});
