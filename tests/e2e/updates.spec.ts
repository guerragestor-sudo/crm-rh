import { expect, test } from "@playwright/test";

import { login } from "./helpers";

// "outra@crm.local" (seed) nunca viu as novidades; admin e recrutador do seed já viram todas.
test("novidades: pop-up depois do login, uma vez só, e a página Novidades no menu", async ({ page }) => {
  await login(page, "outra@crm.local");
  await expect(page).toHaveURL(/\/inicio$/);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Novidade no CRM");
  await expect(dialog).toContainText(/1 de \d+/);

  // Avança até o fim e fecha.
  for (let step = 0; step < 10 && (await dialog.getByRole("button", { name: "Próximo" }).isVisible()); step += 1) {
    await dialog.getByRole("button", { name: "Próximo" }).click();
  }
  await dialog.getByRole("button", { name: "Voltar" }).click();
  await dialog.getByRole("button", { name: "Próximo" }).click();
  await dialog.getByRole("button", { name: "Entendi" }).click();
  await expect(dialog).toBeHidden();

  // Não volta a aparecer (o "visto" fica no banco).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Continua disponível em Novidades, no menu do usuário.
  await page.getByRole("button", { name: "Menu do usuário" }).filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: "Novidades" }).click();
  await expect(page).toHaveURL(/\/novidades$/);
  await expect(page.getByRole("heading", { name: "Importar planilha" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir Importar planilha" })).toBeVisible();
});
