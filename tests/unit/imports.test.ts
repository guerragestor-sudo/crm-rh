import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { guessMapping } from "@/modules/imports/fields";
import { cellToText, parseDelimited, readSpreadsheetFile, toTable } from "@/modules/imports/parse";
import {
  buildDrafts,
  collectUnknownValues,
  parseDateText,
  resolveRows,
  type RefOptions,
  type ResolveContext,
} from "@/modules/imports/resolve";

const TODAY = "2026-11-05";

const OPTIONS: RefOptions = {
  status: [
    { id: "00000000-0000-4000-8000-000000000001", name: "Seletiva", is_active: true },
    { id: "00000000-0000-4000-8000-000000000002", name: "Encaminhado", is_active: true },
    { id: "00000000-0000-4000-8000-000000000003", name: "Antigo", is_active: false },
  ],
  manager: [{ id: "00000000-0000-4000-8000-000000000011", name: "Leandro", is_active: true }],
  region: [{ id: "00000000-0000-4000-8000-000000000021", name: "Guarulhos", is_active: true }],
  source: [
    { id: "00000000-0000-4000-8000-000000000031", name: "Catho", is_active: true },
    { id: "00000000-0000-4000-8000-000000000032", name: "Indeed", is_active: true },
  ],
  segment: [],
};

function context(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    options: OPTIONS,
    choices: {},
    defaults: { statusId: OPTIONS.status[0].id, sourceId: "" },
    existing: { phones: {}, cpfs: {} },
    today: TODAY,
    canCreate: true,
    sourceLabel: "teste.csv",
    ...overrides,
  };
}

function resolveCsv(csv: string, overrides: Partial<ResolveContext> = {}, excluded = new Set<string>()) {
  const table = toTable("teste", parseDelimited(csv));
  const drafts = buildDrafts(table, guessMapping(table.headers), {});
  return { table, drafts, rows: resolveRows(drafts, excluded, context(overrides)) };
}

describe("leitura do arquivo", () => {
  it("CSV do Excel brasileiro: ;, BOM, aspas e quebra de linha dentro da célula", () => {
    const rows = parseDelimited('﻿Nome;Observação\r\n"Ana; Paula";"linha 1\nlinha 2"\r\nBia;"diz ""oi"""\r\n');
    expect(rows).toEqual([
      ["Nome", "Observação"],
      ["Ana; Paula", "linha 1\nlinha 2"],
      ["Bia", 'diz "oi"'],
    ]);
  });

  it("texto colado da planilha (tab) e vírgula", () => {
    expect(parseDelimited("Nome\tTelefone\nAna\t11 91111-2222")).toEqual([
      ["Nome", "Telefone"],
      ["Ana", "11 91111-2222"],
    ]);
    expect(parseDelimited("Nome,Telefone\nAna,11911112222")[1]).toEqual(["Ana", "11911112222"]);
  });

  it("células do Excel: data vira dd/mm/aaaa e número de telefone não vira notação científica", () => {
    expect(cellToText(new Date(Date.UTC(2026, 8, 30)))).toBe("30/09/2026");
    expect(cellToText(new Date(Date.UTC(2026, 8, 30, 14, 30)))).toBe("30/09/2026 14:30");
    expect(cellToText(11947627173)).toBe("11947627173");
    expect(cellToText(true)).toBe("Sim");
  });

  it(".xlsx com várias abas: título acima do cabeçalho, datas e telefone numérico", async () => {
    const bytes = readFileSync(path.resolve(import.meta.dirname, "../e2e/fixtures/esteira-teste.xlsx"));
    const file = new File([bytes], "esteira-teste.xlsx");
    const sheets = await readSpreadsheetFile(file);
    expect(sheets.map((sheet) => [sheet.name, sheet.rows.length])).toEqual([
      ["SETE.26", 1],
      ["OUT.26", 3],
    ]);
    const out = sheets[1];
    expect(out.headers).toEqual([
      "NOME CANDIDATO",
      "DATA ENTREVISTA",
      "GERENTE INDICAÇÃO",
      "TELEFONE",
      "STATUS",
      "DATA INTEGRAÇÃO",
      "CAVAPLAY 1.200",
    ]);
    expect(out.rows[0]).toEqual({
      line: 3,
      cells: ["Gabi Planilha", "20/10/2026", "Carlos Mendes", "11912340101", "Encaminhado", "27/10/2026", "SIM"],
    });
    expect(out.rows[1].cells[1]).toBe("22/10/2026 14:30");
  });

  it("acha o cabeçalho abaixo de um título e descarta linhas e colunas vazias", () => {
    const table = toTable("SETE.26", [
      ["Esteira de setembro", "", ""],
      ["", "NOME CANDIDATO", "TELEFONE", ""],
      ["", "Ana", "11911112222", ""],
      ["", "", "", ""],
      ["", "Bia", "", ""],
    ]);
    expect(table.headers).toEqual(["NOME CANDIDATO", "TELEFONE"]);
    expect(table.rows).toEqual([
      { line: 3, cells: ["Ana", "11911112222"] },
      { line: 5, cells: ["Bia", ""] },
    ]);
  });
});

describe("colunas", () => {
  it("reconhece a planilha ESTEIRA, o CSV do CRM e a lista do Indeed", () => {
    expect(guessMapping(["NOME CANDIDATO", "DATA ENTREVISTA", "GERENTE INDICAÇÃO", "CADASTRO+DOC", "CAPTAÇÃO MIDIA", "CAVAPLAY 1.200"]))
      .toEqual(["full_name", "interview_date", "manager", "documentation", "source", "cavaplay"]);
    expect(guessMapping(["Nome", "Telefone", "Entrevista", "Integração prevista", "Integração", "SLA (dias)", "Cadastro"]))
      .toEqual(["full_name", "phone", "interview_date", "integration_planned_date", "integration_date", "ignore", "created_date"]);
    expect(guessMapping(["Nome", "Telefone", "Cidade", "Vaga", "Status Indeed", "Arquivo"]))
      .toEqual(["full_name", "phone", "note", "note", "note", "ignore"]);
  });

  it("o mesmo campo em duas colunas: a segunda vai para a observação", () => {
    expect(guessMapping(["Nome", "Candidato", "Observação", "Obs"])).toEqual(["full_name", "note", "notes", "notes"]);
  });
});

describe("datas", () => {
  it("dd/mm sem ano usa o ano mais próximo de hoje", () => {
    expect(parseDateText("30/09", TODAY)).toEqual({ date: "2026-09-30", time: null });
    expect(parseDateText("10/01", "2026-12-20")).toEqual({ date: "2027-01-10", time: null });
    expect(parseDateText("20/12", "2027-01-05")).toEqual({ date: "2026-12-20", time: null });
  });

  it("aceita ano curto, ISO e hora; rejeita datas impossíveis e texto", () => {
    expect(parseDateText("30/09/26", TODAY)?.date).toBe("2026-09-30");
    expect(parseDateText("2026-10-15", TODAY)?.date).toBe("2026-10-15");
    expect(parseDateText("26/09/2026 14:30", TODAY)).toEqual({ date: "2026-09-26", time: "14:30" });
    expect(parseDateText("31/09", TODAY)).toBeNull();
    expect(parseDateText("Seletiva / Luiz", TODAY)).toBeNull();
  });
});

describe("prévia", () => {
  it("monta o candidato: contato normalizado, cadastros, datas e observação", () => {
    const { rows } = resolveCsv(
      [
        "Nome;Telefone;Status;Gerente;Região;Origem;Entrevista;Integração;Disponibilidade;Trabalha;Cavaplay;Vaga;Observação",
        "Ana Souza;(11) 91111-2222;encaminhado;leandro;Guarulhos;Catho;20/10;27/10;Imediata;Sim;sim;Corretor;mora perto",
      ].join("\n"),
    );
    const [ana] = rows;
    expect(ana.errors).toEqual([]);
    expect(ana.row).toMatchObject({
      full_name: "Ana Souza",
      phone: "5511911112222",
      status_id: OPTIONS.status[1].id,
      manager: { id: OPTIONS.manager[0].id },
      region: { id: OPTIONS.region[0].id },
      source: { id: OPTIONS.source[0].id },
      interview_date: "2026-10-20",
      created_date: "2026-10-20",
      integration_date: "2026-10-27",
      availability: "immediate",
      currently_working: true,
      cavaplay: true,
      course_paid_by_cava: false,
    });
    expect(ana.row.notes?.split("\n")).toEqual([
      "mora perto",
      "Vaga: Corretor",
      "Importado da planilha teste.csv (linha 2) em 05/11/2026.",
    ]);
  });

  it("integração futura vira Integração prevista; integração antes da entrevista bloqueia", () => {
    const { rows } = resolveCsv(
      ["Nome;Entrevista;Integração", "Ana;01/11;10/11", "Bia;20/10;10/10", "Caio;;03/11"].join("\n"),
    );
    expect(rows[0].row).toMatchObject({ integration_date: null, integration_planned_date: "2026-11-10", created_date: "2026-11-01" });
    expect(rows[0].warnings.join(" ")).toContain("Integração prevista");
    expect(rows[1].errors[0]).toContain("antes da entrevista");
    expect(rows[2].row).toMatchObject({ created_date: "2026-11-03", integration_date: "2026-11-03" });
  });

  it("entrevista futura: cadastro é hoje (o SLA não começa no futuro)", () => {
    const { rows } = resolveCsv(["Nome;Entrevista", "Ana;10/11/2026 14:00"].join("\n"));
    expect(rows[0].row).toMatchObject({ interview_date: "2026-11-10", interview_time: "14:00", created_date: null });
  });

  it("telefone inválido ou vazio não bloqueia: fica pendente e o número vai para a observação", () => {
    const { rows } = resolveCsv(["Nome;Telefone", "Ana;119665516336", "Bia;"].join("\n"));
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].row.phone).toBeNull();
    expect(rows[0].row.notes).toContain("Telefone na planilha (inválido): 119665516336");
    expect(rows[1].warnings[0]).toContain("telefone pendente");
  });

  it("bloqueia nome vazio, telefone repetido na planilha e telefone já cadastrado", () => {
    const { rows } = resolveCsv(
      ["Nome;Telefone", "Ana;11911112222", "Ana Paula;(11) 91111-2222", "X;11933334444", "Caio;11955556666"].join("\n"),
      { existing: { phones: { "5511955556666": { id: "c1", name: "Caio Antigo", archived: true } }, cpfs: {} } },
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors[0]).toContain("repetido na planilha (linha 2, Ana)");
    expect(rows[2].errors[0]).toContain("Nome vazio");
    expect(rows[3].errors[0]).toBe("Telefone já cadastrado no CRM: Caio Antigo (arquivado).");
  });

  it("linha desmarcada não conta como repetida", () => {
    const { rows } = resolveCsv(["Nome;Telefone", "Ana;11911112222", "Ana Paula;11911112222"].join("\n"), {}, new Set(["2"]));
    expect(rows[1].errors).toEqual([]);
  });

  it("status vazio usa o padrão; origem vazia usa a origem padrão", () => {
    const { rows } = resolveCsv(["Nome;Status;Origem", "Ana;;"].join("\n"), {
      defaults: { statusId: OPTIONS.status[1].id, sourceId: OPTIONS.source[1].id },
    });
    expect(rows[0].row).toMatchObject({ status_id: OPTIONS.status[1].id, source: { id: OPTIONS.source[1].id } });
  });
});

describe("nomes que não existem no CRM", () => {
  const csv = [
    "Nome;Status;Gerente;Região;Origem",
    "Ana;Encaminhado loja;Lendro;Osasco;Indicação",
    "Bia;Encaminhado loja;Renata;Guarulhos /Bom sucesso;Catho",
    "Caio;Inativo;Lendro;;",
    "Davi;Antigo;;;",
  ].join("\n");

  it("lista cada nome uma vez com a sugestão das regras da planilha", () => {
    const { drafts } = resolveCsv(csv);
    const unknown = collectUnknownValues(drafts, OPTIONS, true);
    const summary = unknown.map((item) => [item.field, item.raw, item.count, item.suggestion]);
    expect(summary).toEqual([
      ["status", "Encaminhado loja", 2, { kind: "existing", id: OPTIONS.status[1].id }],
      ["status", "Antigo", 1, { kind: "default" }],
      ["status", "Inativo", 1, { kind: "default" }],
      ["manager", "Lendro", 2, { kind: "existing", id: OPTIONS.manager[0].id }],
      ["manager", "Renata", 1, { kind: "create", name: "Renata" }],
      ["region", "Guarulhos /Bom sucesso", 1, { kind: "existing", id: OPTIONS.region[0].id }],
      ["region", "Osasco", 1, { kind: "create", name: "Osasco" }],
      ["source", "Indicação", 1, { kind: "create", name: "Indicação" }],
    ]);
  });

  it("erro de digitação sugere o cadastro parecido; nome curto só casa se for igual", () => {
    const table = toTable("t", parseDelimited(["Nome;Gerente;Status;Região", "Ana;Ricrdo Souza;Encaminahdo;ABD"].join("\n")));
    const drafts = buildDrafts(table, guessMapping(table.headers), {});
    const options = { ...OPTIONS, manager: [...OPTIONS.manager, { id: "m2", name: "Ricardo Souza", is_active: true }] };
    options.region = [...OPTIONS.region, { id: "r2", name: "ABC", is_active: true }];
    const suggestions = Object.fromEntries(collectUnknownValues(drafts, options, true).map((item) => [item.raw, item.suggestion]));
    expect(suggestions["Ricrdo Souza"]).toEqual({ kind: "existing", id: "m2" });
    expect(suggestions["Encaminahdo"]).toEqual({ kind: "existing", id: OPTIONS.status[1].id });
    expect(suggestions["ABD"]).toEqual({ kind: "create", name: "ABD" });
  });

  it("sem permissão de criar, a sugestão é deixar em branco", () => {
    const { drafts } = resolveCsv(csv);
    const renata = collectUnknownValues(drafts, OPTIONS, false).find((item) => item.raw === "Renata");
    expect(renata?.suggestion).toEqual({ kind: "blank" });
  });

  it("aplica a escolha e anota o texto original na observação", () => {
    const { rows } = resolveCsv(csv, {
      choices: { "manager:renata": { kind: "blank" }, "region:osasco": { kind: "existing", id: OPTIONS.region[0].id } },
    });
    expect(rows[0].row.manager).toEqual({ id: OPTIONS.manager[0].id });
    expect(rows[0].row.region).toEqual({ id: OPTIONS.region[0].id });
    expect(rows[0].row.source).toEqual({ new: "Indicação" });
    expect(rows[0].row.notes).toContain("Gerente na planilha: Lendro");
    expect(rows[0].row.notes).toContain("Região na planilha: Osasco");
    expect(rows[1].row.manager).toBeNull();
    expect(rows[1].row.notes).toContain("Gerente na planilha: Renata");
    expect(rows[1].row.status_id).toBe(OPTIONS.status[1].id);
    expect(rows[3].row.status_id).toBe(OPTIONS.status[0].id);
    expect(rows[3].row.notes).toContain("Status na planilha: Antigo");
  });

  it("edição na prévia vale mais que a planilha", () => {
    const table = toTable("t", parseDelimited(csv));
    const drafts = buildDrafts(table, guessMapping(table.headers), { "2": { full_name: "Ana Maria", manager: "Leandro" } });
    const [ana] = resolveRows(drafts, new Set(), context());
    expect(ana.row.full_name).toBe("Ana Maria");
    expect(ana.row.manager).toEqual({ id: OPTIONS.manager[0].id });
    expect(ana.row.notes).not.toContain("Gerente na planilha");
  });
});
