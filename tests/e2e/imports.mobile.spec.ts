import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test("celular: colar da planilha mostra a prévia sem quebrar o layout", async ({ page }) => {
  await page.goto("/candidatos");
  await page.getByRole("link", { name: "Importar planilha" }).click();
  await page.getByRole("button", { name: "Colar da planilha" }).click();
  await page.getByLabel(/copie e cole aqui/).fill("NOME CANDIDATO\tTELEFONE\tSTATUS\nPaula Colada\t11 91234-0401\tSeletiva");
  await page.getByRole("button", { name: "Ver prévia" }).click();

  await expect(page.getByRole("heading", { name: "Prévia (1 linha)" })).toBeVisible();
  await expect(page.getByLabel("Nome da linha 2")).toHaveValue("Paula Colada");
  await expect(page.getByRole("button", { name: "Importar 1 candidato" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});
