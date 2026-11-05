import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { USERS } from "./helpers";

// Playwright roda a partir da raiz do projeto (ver playwright.config.ts).
const XLSX = path.resolve("tests/e2e/fixtures/esteira-teste.xlsx");

/** Busca na lista de candidatos (o texto da busca nunca vai para a URL). */
async function search(page: Page, text: string) {
  await page.goto("/candidatos");
  await page.getByLabel("Buscar candidatos").fill(text);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function csv(lines: string[]) {
  return { name: "lista.csv", mimeType: "text/csv", buffer: Buffer.from(`﻿${lines.join("\r\n")}\r\n`) };
}

test.describe("Importar planilha (administrador)", () => {
  test.use({ storageState: USERS.admin.file });

  test(".xlsx com abas: escolhe a aba, corrige na prévia, importa e desfaz", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Importar planilha" }).click();
    await expect(page).toHaveURL(/\/candidatos\/importar$/);

    await page.getByLabel("Arquivo da planilha").setInputFiles(XLSX);
    await expect(page.getByText("esteira-teste.xlsx")).toBeVisible();
    await page.getByLabel("Aba da planilha").selectOption({ label: "Aba OUT.26 (3)" });
    await expect(page.getByRole("heading", { name: "Prévia (3 linhas)" })).toBeVisible();

    // Erro de digitação no gerente: sugere o cadastro parecido.
    await expect(page.getByLabel(/Gerente “Fernnda Lima”/)).toHaveValue(/^id:/);
    await expect(page.getByLabel(/Gerente “Fernnda Lima”/).locator("option:checked")).toHaveText("Fernanda Lima");

    // Datas e telefone vindos do Excel.
    await expect(page.getByLabel("Data da entrevista da linha 3")).toHaveValue("20/10/2026");
    await expect(page.getByLabel("Telefone da linha 3")).toHaveValue("11912340101");
    await expect(page.getByLabel("Data da entrevista da linha 4")).toHaveValue("22/10/2026 14:30");

    // Edição na prévia.
    await page.getByLabel("Nome da linha 5").fill("Iris Planilha Editada");
    await page.getByLabel("Status da linha 4").selectOption({ label: "Encaminhado" });

    await page.getByRole("button", { name: "Importar 3 candidatos" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Importar 3 candidatos?");
    await confirm.getByRole("button", { name: "Importar" }).click();
    await expect(page.getByRole("heading", { name: "3 candidatos importados" })).toBeVisible();

    await search(page, "Planilha");
    await expect(page.getByText("Iris Planilha Editada").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Gabi Planilha").filter({ visible: true }).first()).toBeVisible();

    // Desfazer pela lista de importações recentes.
    await page.goto("/candidatos/importar");
    const recent = page.getByRole("region", { name: "Importações recentes" });
    await expect(recent).toContainText("esteira-teste.xlsx, aba OUT.26");
    await recent.getByRole("button", { name: "Desfazer" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer importação" }).click();
    await expect(page.getByText("Importação desfeita: 3 candidatos apagados.")).toBeVisible();
    await expect(recent).toContainText("desfeita em");

    await search(page, "Planilha");
    await expect(page.getByText("Nenhum candidato encontrado").filter({ visible: true }).first()).toBeVisible();
  });

  test("CSV: linha com problema fica de fora até ser corrigida", async ({ page }) => {
    await page.goto("/candidatos/importar");
    await page.getByLabel("Arquivo da planilha").setInputFiles(
      csv([
        "Nome;Telefone;Status;Vaga",
        "Kaua Csv;11 91234-0301;Seletiva;Corretor",
        "Lara Csv;(11) 91234-0301;Seletiva;Consultor",
        ";11 91234-0303;;",
        "Mara Csv;11 97000-1371;;",
      ]),
    );
    await expect(page.getByRole("radio", { name: "Problema (3)" })).toBeVisible();
    await expect(page.getByText("Telefone repetido na planilha (linha 2, Kaua Csv).")).toBeVisible();
    await expect(page.getByText(/Telefone já cadastrado no CRM:/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar 1 candidato" })).toBeEnabled();

    await page.getByLabel("Telefone da linha 3").fill("11 91234-0302");
    await page.getByLabel("Nome da linha 4").fill("Nina Csv");
    await expect(page.getByLabel("Importar linha 5 (Mara Csv)")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Importar 3 candidatos" })).toBeEnabled();

    await page.getByRole("button", { name: "Importar 3 candidatos" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Importar" }).click();
    await expect(page.getByRole("heading", { name: "3 candidatos importados" })).toBeVisible();

    // A coluna "Vaga" foi para a observação.
    await search(page, "Lara Csv");
    await page.getByRole("link", { name: /Lara Csv/ }).filter({ visible: true }).first().click();
    await expect(page.getByText("Vaga: Consultor")).toBeVisible();

    // Limpeza: desfaz pela lista.
    await page.goto("/candidatos/importar");
    await page.getByRole("region", { name: "Importações recentes" }).getByRole("button", { name: "Desfazer" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer importação" }).click();
    await expect(page.getByText("Importação desfeita: 3 candidatos apagados.")).toBeVisible();
  });
});

test.describe("Importar planilha (recrutador)", () => {
  test.use({ storageState: USERS.recruiter.file });

  test("nome novo não pode ser criado: a opção é ligar a um existente ou deixar em branco", async ({ page }) => {
    await page.goto("/candidatos/importar");
    await page.getByLabel("Arquivo da planilha").setInputFiles(csv(["Nome;Região", "Olga Csv;Região Inexistente"]));
    const select = page.getByLabel(/Região “Região Inexistente”/);
    await expect(select.locator("option:checked")).toHaveText("Deixar em branco");
    await expect(select.locator("option", { hasText: "Criar" })).toHaveCount(0);
  });
});
