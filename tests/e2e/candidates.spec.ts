import { expect, test } from "@playwright/test";

import { uniqueSuffix, USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test.describe("Desktop: lista, filtros, edição e erros", () => {
  test("filtros combinados refletem na URL e na contagem", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("button", { name: "Zona Sul" }).click();
    await sheet.getByRole("button", { name: "Ricardo Souza" }).click();
    await sheet.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/region_ids=.*manager_ids=|manager_ids=.*region_ids=/);
    // Espera a busca terminar (a lista expõe aria-busy enquanto carrega).
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByText(/^\d+ candidatos? encontrados?$/)).toBeVisible();
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count, "o seed tem candidatos da Zona Sul com o gerente Ricardo Souza").toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      await expect(rows.nth(index)).toContainText("Zona Sul");
      await expect(rows.nth(index)).toContainText("Ricardo Souza");
    }
  });

  test("edição completa: entrevista, integração congela o SLA e histórico", async ({ page }) => {
    const name = `Teste Desktop ${uniqueSuffix()}`;
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("E-mail").fill(`teste.${uniqueSuffix()}@exemplo.com`);
    await page.getByLabel("Região").selectOption({ label: "Centro" });
    await page.getByLabel("Origem / captação").selectOption({ label: "Indicação" });
    await page.getByRole("radio", { name: "Sim" }).click();
    await page.getByRole("button", { name: "Cadastrar candidato" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Data da entrevista").fill("2026-12-01T10:30");
    const today = await page.getByLabel("Data de integração").getAttribute("max");
    await page.getByLabel("Data de integração").fill(today!);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("SLA (concluído)")).toBeVisible();
    await expect(page.getByText("01/12/2026 10:30")).toBeVisible();
    await page.getByRole("tab", { name: /Histórico/ }).click();
    await expect(page.getByText("Agendou entrevista para 01/12/2026 10:30")).toBeVisible();
    await expect(page.getByText(/Registrou integração em .* · SLA 0 dias/)).toBeVisible();
  });

  test("integração futura é recusada pelo servidor", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Diego Almeida" }).click();
    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Data de integração").evaluate((input: HTMLInputElement) => input.removeAttribute("max"));
    await page.getByLabel("Data de integração").fill("2099-01-01");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("A data de integração não pode ser futura")).toBeVisible();
  });

  test("candidato inexistente mostra página de não encontrado", async ({ page }) => {
    await page.goto("/candidatos/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.goto("/candidatos/nao-e-um-id");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("busca sem resultados mostra estado vazio", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByLabel("Buscar candidatos").fill("zzzz-ninguem-com-esse-nome");
    await expect(page.getByText("Nenhum candidato encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await expect(page.getByText("Nenhum candidato encontrado")).toHaveCount(0);
  });

  test("arquivar e restaurar (admin)", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Eduarda Santos" }).click();
    await page.getByRole("button", { name: "Arquivar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Arquivar" }).click();
    await expect(page.getByText(/Candidato arquivado em/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText(/Candidato arquivado em/)).toHaveCount(0);
  });
});
