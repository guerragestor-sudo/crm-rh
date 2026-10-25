import { expect, test, type Page } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

async function filterByRegion(page: Page, region: string) {
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtros" });
  await sheet.getByRole("button", { name: region }).click();
  await sheet.getByRole("button", { name: "Aplicar" }).click();
}

test.describe("Filtro salvo ao voltar da ficha", () => {
  test("lista: abrir candidato e voltar mantém o filtro; 'Limpar filtros' volta à lista normal", async ({ page }) => {
    await page.goto("/candidatos");
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);
    await filterByRegion(page, "Zona Sul");
    await expect(page).toHaveURL(/region_ids=/);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const filteredCount = await page.getByText(/^\d+ candidatos? encontrados?$/).textContent();

    // Abre um candidato e volta pelo link "Candidatos" (sem filtro no endereço).
    await page.locator("tbody tr").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/candidatos\/[0-9a-f-]{36}$/);
    await page.locator("main").getByRole("link", { name: "Candidatos", exact: true }).click();

    await expect(page).toHaveURL(/\/candidatos\?region_ids=/);
    await expect(page.getByText(filteredCount!)).toBeVisible();
    const rows = page.locator("tbody tr");
    for (let index = 0; index < (await rows.count()); index++) {
      await expect(rows.nth(index)).toContainText("Zona Sul");
    }

    // Limpar: volta à lista normal e esquece o filtro salvo.
    await page.getByRole("button", { name: "Limpar filtros (1)" }).click();
    await expect(page).toHaveURL(/\/candidatos$/);
    await expect(page.getByText(/^\d+ candidatos?$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);

    // Depois de limpar, abrir um candidato e voltar mostra a lista normal.
    await page.locator("tbody tr").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/candidatos\/[0-9a-f-]{36}$/);
    await page.locator("main").getByRole("link", { name: "Candidatos", exact: true }).click();
    await expect(page).toHaveURL(/\/candidatos$/);
    await expect(page.getByText(/^\d+ candidatos?$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);
  });

  test("lista: primeira carga com filtro salvo e depois limpar, abrir e voltar", async ({ page }) => {
    await page.goto("/candidatos");
    await filterByRegion(page, "Zona Sul");
    await expect(page).toHaveURL(/region_ids=/);

    await page.goto("/candidatos");
    await expect(page).toHaveURL(/\/candidatos\?region_ids=/);
    await page.getByRole("button", { name: "Limpar filtros (1)" }).click();
    await expect(page).toHaveURL(/\/candidatos$/);

    await page.locator("tbody tr").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/candidatos\/[0-9a-f-]{36}$/);
    await page.getByRole("navigation").getByRole("link", { name: "Candidatos" }).first().click();
    await expect(page).toHaveURL(/\/candidatos$/);
    await expect(page.getByText(/^\d+ candidatos?$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);
  });

  test("link com filtro explícito vence o filtro salvo", async ({ page }) => {
    await page.goto("/candidatos");
    await filterByRegion(page, "Zona Sul");
    await expect(page).toHaveURL(/region_ids=/);

    await page.goto("/candidatos?missing_phone=1");
    await expect(page).toHaveURL(/\/candidatos\?missing_phone=1$/);
    await expect(page.getByRole("button", { name: "Limpar filtros (1)" })).toBeVisible();
  });

  test("Kanban: voltar da ficha mantém o filtro; 'Limpar filtros' remove", async ({ page }) => {
    await page.goto("/kanban");
    await filterByRegion(page, "Zona Sul");
    await expect(page).toHaveURL(/\/kanban\?region_ids=/);

    // Abre um cartão e volta pelo menu lateral.
    await page.locator("article").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/candidatos\/[0-9a-f-]{36}$/);
    await page.getByRole("navigation").getByRole("link", { name: "Kanban" }).first().click();
    await expect(page).toHaveURL(/\/kanban\?region_ids=/);
    await expect(page.getByText("Zona Oeste")).toHaveCount(0);

    await page.getByRole("button", { name: "Limpar filtros (1)" }).click();
    await expect(page).toHaveURL(/\/kanban$/);
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);
    await expect(page.getByText("Zona Oeste").filter({ visible: true }).first()).toBeVisible();

    // Primeira carga com filtro salvo e depois limpar (caso do cache de navegação).
    await filterByRegion(page, "Zona Sul");
    await expect(page).toHaveURL(/\/kanban\?region_ids=/);
    await page.goto("/kanban");
    await expect(page).toHaveURL(/\/kanban\?region_ids=/);
    await page.getByRole("button", { name: "Limpar filtros (1)" }).click();
    await expect(page).toHaveURL(/\/kanban$/);
    await expect(page.getByText("Zona Oeste").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar filtros/ })).toHaveCount(0);
  });
});
