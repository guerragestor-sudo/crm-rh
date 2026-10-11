import { expect, type Page } from "@playwright/test";

/** Usuários do seed LOCAL (supabase/seed.sql). Nunca existem em produção. */
export const USERS = {
  admin: { email: "admin@crm.local", file: "tests/e2e/.auth/admin.json" },
  recruiter: { email: "recrutador@crm.local", file: "tests/e2e/.auth/recruiter.json" },
} as const;

export const SEED_PASSWORD = process.env.E2E_PASSWORD ?? "CrmDemo2026!";

export async function login(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Garante que a página não tem rolagem horizontal (layout quebrado no celular). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "a página não deve rolar na horizontal").toBeLessThanOrEqual(1);
}

/** PDF mínimo válido para testes de upload. */
export function samplePdf(label = "Currículo de teste") {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n% ${label}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
  );
}

export function uniqueSuffix() {
  return `${Date.now()}`.slice(-6);
}
