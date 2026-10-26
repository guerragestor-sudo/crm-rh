import { expect, test } from "@playwright/test";

import { uniqueSuffix, USERS } from "./helpers";

test.use({ storageState: USERS.admin.file });

test.describe("Desktop: lista, filtros, edição e erros", () => {
  test("filtros combinados refletem na URL e na contagem", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("button", { name: "Zona Sul" }).click();
    await sheet.getByRole("button", { name: "Ricardo Souza" }).click();
    await sheet.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/region_ids=.*manager_ids=|manager_ids=.*region_ids=/);
    // Espera a busca terminar (a lista expõe aria-busy enquanto carrega).
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByText(/^\d+ candidatos? encontrados?$/)).toBeVisible();
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count, "o seed tem candidatos da Zona Sul com o gerente Ricardo Souza").toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      await expect(rows.nth(index)).toContainText("Zona Sul");
      await expect(rows.nth(index)).toContainText("Ricardo Souza");
    }
  });

  test("edição completa: entrevista, integração congela o SLA e histórico", async ({ page }) => {
    const name = `Teste Desktop ${uniqueSuffix()}`;
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("E-mail").fill(`teste.${uniqueSuffix()}@exemplo.com`);
    await page.getByLabel("Região").selectOption({ label: "Centro" });
    await page.getByLabel("Origem / captação").selectOption({ label: "Indicação" });
    await page.getByRole("radiogroup", { name: "Trabalha atualmente?" }).getByRole("radio", { name: "Sim" }).click();
    await page.getByRole("button", { name: "Cadastrar candidato" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Data da entrevista").fill("2026-12-01T10:30");
    const today = await page.getByLabel("Data de integração").getAttribute("max");
    await page.getByLabel("Data de integração").fill(today!);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("SLA (concluído)")).toBeVisible();
    await expect(page.getByText("01/12/2026 10:30")).toBeVisible();
    await page.getByRole("tab", { name: /Histórico/ }).click();
    await expect(page.getByText("Agendou entrevista para 01/12/2026 10:30")).toBeVisible();
    await expect(page.getByText(/Registrou integração em .* · SLA 0 dias/)).toBeVisible();
  });

  test("Cavaplay e curso pago pela Cava: sim/não na ficha, no histórico e no filtro", async ({ page }) => {
    const name = `Teste Cava ${uniqueSuffix()}`;
    await page.goto("/candidatos/novo");
    await page.getByLabel("Nome completo").fill(name);
    await expect(page.getByRole("radiogroup", { name: "Cavaplay?" }).getByRole("radio", { name: "Não" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radiogroup", { name: "Cavaplay?" }).getByRole("radio", { name: "Sim" }).click();
    await page.getByRole("button", { name: "Cadastrar candidato" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await expect(page.getByText("Cavaplay", { exact: true }).locator("..")).toContainText("Sim");
    await expect(page.getByText("Curso pago pela Cava", { exact: true }).locator("..")).toContainText("Não");

    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByRole("radiogroup", { name: "Curso pago pela Cava?" }).getByRole("radio", { name: "Sim" }).click();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Curso pago pela Cava", { exact: true }).locator("..")).toContainText("Sim");
    await page.getByRole("tab", { name: /Histórico/ }).click();
    await expect(page.getByRole("tabpanel").getByText("Alterou curso pago pela Cava")).toBeVisible();

    // Filtro: Cavaplay = Sim mostra o novo candidato; Não esconde.
    await page.goto("/candidatos");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("group", { name: "Cavaplay" }).getByRole("button", { name: "Sim" }).click();
    await sheet.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/cavaplay=yes/);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Diego Almeida" })).toHaveCount(0);

    await page.goto("/candidatos?cavaplay=no");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Diego Almeida" })).toBeVisible();
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  });

  test("integração prevista: data futura vira prevista, aparece na Agenda e é confirmada", async ({ page }) => {
    const name = `Teste Prevista ${uniqueSuffix()}`;
    const br = (iso: string) => iso.split("-").reverse().join("/");
    await page.goto("/candidatos/novo");
    const today = (await page.getByLabel("Data de integração").getAttribute("max"))!;
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    // Data futura na integração: aviso no campo, sem ir ao servidor, e atalho para a prevista.
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("Data de integração").fill(tomorrowIso);
    await page.getByRole("button", { name: "Cadastrar candidato" }).click();
    await expect(page.getByText(/Data futura: use “Integração prevista”/)).toBeVisible();
    await expect(page).toHaveURL(/\/candidatos\/novo$/);
    await page.getByRole("button", { name: "Mover para integração prevista" }).click();
    await expect(page.getByLabel("Integração prevista")).toHaveValue(tomorrowIso);
    await expect(page.getByLabel("Data de integração")).toHaveValue("");
    await page.getByRole("button", { name: "Cadastrar candidato" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    const detailUrl = page.url();
    await expect(page.getByText(`Prevista ${br(tomorrowIso)}`)).toBeVisible();
    await page.goto("/candidatos?integration=planned");
    await expect(page.getByRole("link", { name }).first()).toBeVisible();

    // Combinada para hoje: aparece na Agenda para confirmar.
    await page.getByRole("link", { name }).first().click();
    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Integração prevista").fill(today);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(`Prevista ${br(today)}`)).toBeVisible();

    await page.goto("/agenda");
    const block = page.getByRole("region", { name: /Integrações para confirmar/ });
    await expect(block.getByRole("link", { name })).toBeVisible();
    await block.getByRole("button", { name: `Confirmar integração de ${name}` }).click();
    const dialog = page.getByRole("dialog", { name: "Confirmar integração" });
    await expect(dialog.getByLabel("Dia em que começou")).toHaveValue(today);
    await dialog.getByRole("button", { name: "Confirmar integração" }).click();
    await expect(page.getByText(`Integração de ${name} confirmada em ${br(today)}.`)).toBeVisible();
    await expect(page.getByRole("link", { name })).toHaveCount(0);

    // Na ficha: integração registrada, SLA congelado, prevista some; histórico com as duas etapas.
    await page.goto(detailUrl);
    await expect(page.getByText("SLA (concluído)")).toBeVisible();
    await expect(page.getByText(/^Prevista /)).toHaveCount(0);
    await page.getByRole("tab", { name: /Histórico/ }).click();
    await expect(page.getByRole("tabpanel").getByText("Alterou integração prevista").first()).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText(/Registrou integração em/)).toBeVisible();
  });

  test("integração futura é barrada no próprio campo (o banco também barra)", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Diego Almeida" }).click();
    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Data de integração").evaluate((input: HTMLInputElement) => input.removeAttribute("max"));
    await page.getByLabel("Data de integração").fill("2099-01-01");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(/Data futura: use “Integração prevista”/)).toBeVisible();
    await expect(page.getByLabel("Data de integração")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/editar$/);
  });

  test("candidato inexistente mostra página de não encontrado", async ({ page }) => {
    await page.goto("/candidatos/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.goto("/candidatos/nao-e-um-id");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("busca sem resultados mostra estado vazio", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByLabel("Buscar candidatos").fill("zzzz-ninguem-com-esse-nome");
    await expect(page.getByText("Nenhum candidato encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await expect(page.getByText("Nenhum candidato encontrado")).toHaveCount(0);
  });

  test("arquivar e restaurar (admin)", async ({ page }) => {
    await page.goto("/candidatos");
    await page.getByRole("link", { name: "Eduarda Santos" }).click();
    await page.getByRole("button", { name: "Arquivar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Arquivar" }).click();
    await expect(page.getByText(/Candidato arquivado em/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText(/Candidato arquivado em/)).toHaveCount(0);
  });
});
