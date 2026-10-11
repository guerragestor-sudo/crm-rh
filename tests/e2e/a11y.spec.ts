import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

const PAGES = [
  "/inicio",
  "/candidatos",
  "/candidatos/novo",
  "/kanban",
  "/agenda",
  "/agenda?view=no_next_action",
  "/sla",
  "/relatorios",
  "/configuracoes",
];

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test("acessibilidade: login", async ({ page }) => {
  await page.goto("/login");
  expect(await scan(page)).toEqual([]);
});

test.describe("acessibilidade: páginas autenticadas", () => {
  test.use({ storageState: USERS.admin.file });

  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test("ficha do candidato", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Ana Paula Ferreira" }).click();
    await expect(page.getByRole("heading", { name: "Ana Paula Ferreira" })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});

test.describe("acessibilidade: celular", () => {
  test.use({ storageState: USERS.admin.file, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const path of ["/inicio", "/candidatos", "/candidatos/novo", "/kanban", "/agenda", "/relatorios"]) {
    test(`mobile ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }
});
