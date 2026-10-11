import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test("dashboard com indicadores, gráficos e filtro", async ({ page }) => {
  await page.goto("/inicio");
  for (const label of ["Candidatos ativos", "Tarefas atrasadas", "Sem próxima ação", "SLA médio", "SLA mediano"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  for (const title of ["Candidatos por status", "Candidatos por origem", "Candidatos por região", "Candidatos por gerente"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  await page.getByRole("button", { name: /Filtros/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ricardo Souza" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Indicadores com os filtros aplicados.")).toBeVisible();
});

test("SLA: indicadores e agrupamentos", async ({ page }) => {
  await page.goto("/sla");
  await expect(page.getByText("Menor SLA")).toBeVisible();
  await page.getByRole("link", { name: "Gerente", exact: true }).click();
  await expect(page).toHaveURL(/agrupar=manager/);
  await expect(page.getByRole("heading", { name: "SLA por gerente" })).toBeVisible();
  await page.getByRole("link", { name: "Mês de integração" }).click();
  await expect(page.getByRole("heading", { name: "SLA por mês de integração" })).toBeVisible();
});

test("exportação CSV respeita os filtros", async ({ page }) => {
  await page.goto("/relatorios");
  await page.getByRole("button", { name: /Filtros/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fernanda Lima" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/manager_ids=/);
  const total = Number(await page.locator('[data-stat="Candidatos"] [data-stat-value]').textContent());
  expect(total).toBeGreaterThan(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  const content = await readFile((await download.path())!, "utf8");
  const lines = content.trim().split(/\r\n/);
  expect(lines[0]).toContain("Nome;Telefone;E-mail;CPF");
  expect(lines.length - 1).toBe(total);
  for (const line of lines.slice(1)) expect(line).toContain("Fernanda Lima");
});
