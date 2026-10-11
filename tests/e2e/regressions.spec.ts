import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test.describe("Regressões encontradas no teste de produção", () => {
  test("janela de status rola em tela baixa e o botão Salvar fica alcançável", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 380 });
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Bruno Henrique Costa" }).first().click();
    await page.getByRole("button", { name: "Alterar status" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Encaminhado/ }).click();
    const save = dialog.getByRole("button", { name: "Salvar status" });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await save.click();
    await expect(page.getByText("Status atualizado.")).toBeVisible();
  });

  test("edição já vem preenchida no HTML do servidor (sem piscar vazio)", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Ana Paula Ferreira" }).first().click();
    const editHref = await page.getByRole("link", { name: "Editar" }).getAttribute("href");
    const html = await (await page.request.get(editHref!)).text();
    expect(html).toMatch(/id="full_name"[^>]*value="Ana Paula Ferreira"|value="Ana Paula Ferreira"[^>]*id="full_name"/);
    expect(html).toMatch(/<option[^>]*selected=""[^>]*>Seletiva<\/option>|<option[^>]*value="[^"]+"[^>]*selected[^>]*>Seletiva/);
  });

  test("rótulo acessível do novo ramo usa o gênero certo", async ({ page }) => {
    await page.goto("/configuracoes?tab=segments");
    await expect(page.getByLabel("Novo ramo")).toBeVisible();
    await page.goto("/configuracoes?tab=regions");
    await expect(page.getByLabel("Nova região")).toBeVisible();
  });

  test("SLA por gerente usa 'Sem gerente', como o Dashboard", async ({ page }) => {
    await page.goto("/sla?agrupar=manager");
    await expect(page.getByRole("heading", { name: "SLA por gerente" })).toBeVisible();
    await expect(page.locator("main table").getByText("Sem gerente", { exact: true })).toBeVisible();
    await expect(page.locator("main table").getByText("Não informado", { exact: true })).toHaveCount(0);
  });
});
