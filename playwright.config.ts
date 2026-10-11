import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o BUILD DE PRODUÇÃO (next start) e o Supabase local recém-resetado.
 * Rode com `npm run test:e2e` (faz db reset + build + testes).
 * Usa o Google Chrome instalado na máquina (channel "chrome").
 */
const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /.*\.mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
