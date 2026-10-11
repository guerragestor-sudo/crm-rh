import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test("Kanban: arrastar e soltar muda o status e registra no histórico", async ({ page }) => {
  await page.goto("/kanban");
  const source = page.getByRole("region", { name: /^Seletiva:/ });
  const target = page.getByRole("region", { name: /^Parceiro:/ });
  const card = source.locator("article").filter({ hasText: "Felipe Oliveira" });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();

  const from = await card.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from!.x + 40, from!.y + 50);
  await page.mouse.down();
  await page.mouse.move(from!.x + 60, from!.y + 70, { steps: 5 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 120, { steps: 15 });
  await page.mouse.up();

  await expect(page.getByText("Felipe Oliveira → Parceiro")).toBeVisible();
  await expect(target.getByText("Felipe Oliveira")).toBeVisible();

  await target.getByRole("link", { name: "Felipe Oliveira" }).click();
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await expect(page.getByRole("tabpanel").getByText("Alterou o status")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Parceiro", { exact: true })).toBeVisible();
});

test("Kanban: cartão mostra gerente, região, próxima tarefa e tempo", async ({ page }) => {
  await page.goto("/kanban");
  const card = page.locator("article").filter({ hasText: "Juliana Freitas" }).first();
  await expect(card).toContainText("Atrasada");
  await expect(card).toContainText(/\d+ dias?/);
  await expect(card.getByRole("link", { name: "Abrir WhatsApp" })).toBeVisible();
});
