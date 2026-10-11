import { expect, test } from "@playwright/test";

import { samplePdf, USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test("currículo: enviar, visualizar, baixar e substituir", async ({ page }) => {
  await page.goto("/candidatos");
  await page.getByRole("link", { name: "Isabela Carvalho" }).click();
  await page.getByRole("tab", { name: /Documentos/ }).click();

  await page.locator("#document-file").setInputFiles({
    name: "curriculo-isabela.pdf",
    mimeType: "application/pdf",
    buffer: samplePdf("v1"),
  });
  await expect(page.getByText("Documento anexado.")).toBeVisible();
  await expect(page.getByText("curriculo-isabela.pdf")).toBeVisible();
  await expect(page.getByRole("link", { name: "Currículo" })).toBeVisible();

  // Visualizar: link interno → URL assinada temporária do bucket privado
  const viewHref = await page.getByRole("link", { name: "Ver" }).first().getAttribute("href");
  const view = await page.request.get(viewHref!, { maxRedirects: 0 });
  expect(view.status()).toBe(302);
  expect(view.headers().location).toContain("token=");
  const file = await page.request.get(viewHref!);
  expect((await file.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Baixar
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar curriculo-isabela.pdf" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("curriculo-isabela.pdf");

  // Substituir
  await page.locator("#document-file").setInputFiles({
    name: "curriculo-isabela-v2.pdf",
    mimeType: "application/pdf",
    buffer: samplePdf("v2"),
  });
  await expect(page.getByText("Currículo substituído.")).toBeVisible();
  await expect(page.getByText(/versão anterior/)).toBeVisible();

  // Formato não aceito
  await page.locator("#document-file").setInputFiles({ name: "foto.heic", mimeType: "image/heic", buffer: Buffer.from("x") });
  await expect(page.getByText(/Formato não aceito/)).toBeVisible();

  await page.getByRole("tab", { name: /Histórico/ }).click();
  await expect(page.getByText("Anexou o documento curriculo-isabela.pdf")).toBeVisible();
  await expect(page.getByText("Substituiu o currículo por curriculo-isabela-v2.pdf")).toBeVisible();
});
