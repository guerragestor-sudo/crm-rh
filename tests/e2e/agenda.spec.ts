import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test.describe("Agenda", () => {
  test("atrasadas e sem próxima ação são grupos separados", async ({ page }) => {
    await page.goto("/agenda?view=overdue");
    await expect(page.getByText("Juliana Freitas")).toBeVisible();
    const overdueNames = await page.locator("main li a[href^='/candidatos/']").allTextContents();
    expect(overdueNames.length).toBeGreaterThan(0);

    await page.getByRole("link", { name: /Sem próxima ação/ }).click();
    await expect(page).toHaveURL(/view=no_next_action/);
    const noActionNames = await page.locator("main li a[href^='/candidatos/']").allTextContents();
    for (const name of overdueNames) {
      expect(noActionNames, `${name} tem tarefa atrasada e não pode estar em "Sem próxima ação"`).not.toContain(name);
    }
  });

  test("criar tarefa para hoje, concluir e ver em concluídas", async ({ page }) => {
    await page.goto("/agenda?view=today");
    await page.getByRole("button", { name: "Nova tarefa" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Buscar candidato").fill("Gabriela");
    await dialog.getByRole("button", { name: "Gabriela Martins" }).click();
    await dialog.getByRole("button", { name: "Solicitar documento" }).click();
    await expect(dialog.getByLabel("Título")).toHaveValue("Solicitar documentos de Gabriela");
    await dialog.getByRole("button", { name: "Hoje", exact: true }).click();
    await dialog.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(page.getByText("Tarefa criada.")).toBeVisible();

    const item = page.locator("main li").filter({ hasText: "Solicitar documentos de Gabriela" });
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: /^Concluir:/ }).click();
    await expect(page.getByText("Tarefa concluída.")).toBeVisible();

    await page.getByRole("link", { name: "Concluídas" }).click();
    await expect(page.locator("main li").filter({ hasText: "Solicitar documentos de Gabriela" })).toBeVisible();
  });

  test("reagendar tarefa pelo menu", async ({ page }) => {
    await page.goto("/agenda?view=upcoming");
    const item = page.locator("main li").filter({ hasText: "Acompanhar início do curso" });
    await item.getByRole("button", { name: /Ações da tarefa/ }).click();
    await page.getByRole("menuitem", { name: "Editar / reagendar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Em 7 dias" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Tarefa atualizada.")).toBeVisible();
  });
});
