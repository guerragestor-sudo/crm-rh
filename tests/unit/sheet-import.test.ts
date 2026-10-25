import { describe, expect, it } from "vitest";

import { normalizePhone as appNormalizePhone } from "@/lib/phone";

import {
  COLUMNS,
  mapAvailability,
  mapCourse,
  mapDocumentation,
  mapManager,
  mapRegion,
  mapSegment,
  mapSource,
  mapStatus,
  mapWorking,
  normalizePhone,
  parseDayMonth,
  parseSheet,
  yearFromTabName,
} from "../../scripts/lib/sheet-import.mjs";

const HEADER = ["", ...Object.values(COLUMNS)];

/** Linha da planilha a partir dos campos informados (demais vazios). */
function row(fields: Partial<Record<keyof typeof COLUMNS, string>>) {
  return ["", ...Object.keys(COLUMNS).map((key) => fields[key as keyof typeof COLUMNS] ?? "")];
}

const OPTIONS = { tab: "SETE.26", year: 2026, today: "2026-10-24", importDate: "2026-10-24" };

describe("telefone", () => {
  it("normaliza igual ao app (o índice único compara o telefone normalizado)", () => {
    const samples = [
      "11947627173",
      "11 94745-0965",
      "(11) 98987-9228",
      "+55 11 99999-8888",
      "011999998888",
      "77981459321",
      "1133334444",
      "119665516336",
      "11833334444",
      "",
      "abc",
    ];
    for (const sample of samples) expect(normalizePhone(sample)).toBe(appNormalizePhone(sample));
  });
});

describe("datas", () => {
  it("lê dd/mm com o ano da aba e rejeita datas impossíveis", () => {
    expect(yearFromTabName("SETE.26")).toBe(2026);
    expect(parseDayMonth("30/09", 2026)).toBe("2026-09-30");
    expect(parseDayMonth("1/10", 2026)).toBe("2026-10-01");
    expect(parseDayMonth("31/09", 2026)).toBeNull();
    expect(parseDayMonth("Seletiva / Luiz", 2026)).toBeNull();
    expect(parseDayMonth("-", 2026)).toBeNull();
  });
});

describe("mapeamentos", () => {
  it("status: padrão, novos, agrupados e vazio", () => {
    expect(mapStatus("Parceiro")).toMatchObject({ name: "Parceiro", original: null });
    expect(mapStatus("Não esta trabalhando fora")).toMatchObject({ name: "Não está trabalhando" });
    expect(mapStatus("Não tem perfil")).toMatchObject({ name: "Sem perfil" });
    expect(mapStatus("Integraçao ok / verificar se vai ser cavaplay")).toMatchObject({ name: "Ativo" });
    expect(mapStatus(" Ativo- incentivo loja")).toMatchObject({ name: "Ativo", original: "Ativo- incentivo loja" });
    expect(mapStatus("Esta na Quantum")).toMatchObject({ name: "Desistiu" });
    expect(mapStatus("Declinou ")).toMatchObject({ name: "Desistiu" });
    expect(mapStatus("não tem interesse")).toMatchObject({ name: "Desistiu" });
    expect(mapStatus("ainda em atualização de cadastro")).toMatchObject({ name: "Encaminhado" });
    expect(mapStatus("Encaminhado Gerente / Diretor")).toMatchObject({ name: "Encaminhado" });
    expect(mapStatus("Seletiva -  esta de mudança")).toMatchObject({ name: "Seletiva" });
    expect(mapStatus("")).toMatchObject({ name: "Seletiva" });
    expect(mapStatus("", { working: "Ativo Lapa" })).toMatchObject({ name: "Ativo" });
    expect(mapStatus("algo novo")).toMatchObject({ name: null, original: "algo novo" });
  });

  it("gerente: corrige digitação e guarda combinações na observação", () => {
    expect(mapManager("Lendro")).toEqual({ name: "Leandro", original: null });
    expect(mapManager("VANESSA/")).toEqual({ name: "Vanessa", original: null });
    expect(mapManager("RENATA / Lenadro")).toEqual({ name: "Renata", original: "RENATA / Lenadro" });
    expect(mapManager("Davi/Luis")).toEqual({ name: "Davi", original: "Davi / Luis" });
    expect(mapManager(".")).toEqual({ name: null, original: null });
    expect(mapManager("-")).toEqual({ name: null, original: null });
  });

  it("região: bairro vai para a observação", () => {
    expect(mapRegion("Guarulhos /Bom sucesso")).toEqual({ name: "Guarulhos", original: "Guarulhos / Bom sucesso" });
    expect(mapRegion("Guarulho")).toEqual({ name: "Guarulhos", original: null });
    expect(mapRegion("Lageado Zona Leste")).toEqual({ name: "Zona Leste", original: "Lageado Zona Leste" });
    expect(mapRegion("Lapa")).toEqual({ name: "Lapa", original: null });
  });

  it("origem: agrupa variações", () => {
    expect(mapSource("CATHO DISAPRO")).toEqual({ name: "Catho", original: null });
    expect(mapSource("Catho / ARICANDUVA")).toEqual({ name: "Catho", original: "Catho / ARICANDUVA" });
    expect(mapSource("DISPARO GRUPOS DE VAGS")).toEqual({ name: "Grupos de vagas", original: null });
    expect(mapSource("Disparo grupos MRV")).toMatchObject({ name: "Grupos de vagas", original: "Disparo grupos MRV" });
    expect(mapSource("indicação")).toEqual({ name: "Indicação", original: null });
    expect(mapSource(" PARA CAD. ARICANDUVA")).toEqual({ name: "Outros", original: "PARA CAD. ARICANDUVA" });
    expect(mapSource("")).toEqual({ name: null, original: null });
  });

  it("ramo, disponibilidade, trabalha, cadastro e curso", () => {
    expect(mapSegment("Imoveis Cury")).toEqual({ name: "Imóveis", original: "Imoveis Cury" });
    expect(mapSegment("Videomaker")).toEqual({ name: null, original: "Videomaker" });
    expect(mapAvailability("avaliar")).toEqual({ value: "to_negotiate", original: null });
    expect(mapAvailability("parceria")).toEqual({ value: null, original: "parceria" });
    expect(mapWorking("Não trabalha")).toEqual({ value: false, original: null });
    expect(mapWorking("Seguro desemprego")).toEqual({ value: false, original: "Seguro desemprego" });
    expect(mapWorking("Corretor")).toEqual({ value: true, original: "Corretor" });
    expect(mapWorking("Estudante")).toEqual({ value: null, original: "Estudante" });
    expect(mapDocumentation("ok")).toEqual({ status: "complete", notes: null });
    expect(mapDocumentation("Cad. Imob")).toEqual({ status: "in_progress", notes: "Cad. Imob" });
    expect(mapCourse("Doc Faltante")).toEqual({ status: "in_progress", notes: "Doc Faltante" });
    expect(mapCourse("-")).toEqual({ status: "not_started", notes: null });
  });
});

describe("parseSheet", () => {
  it("monta o candidato com datas, observação e telefone pendente", () => {
    const [record] = parseSheet(
      [
        HEADER,
        row({
          name: "Renato ",
          interview: "26/09",
          manager: "RENATA / Lenadro",
          documentation: "ok",
          course: "ok",
          region: "Guarulhos",
          source: "CATHO / CAVAPLAY",
          availability: "avaliar",
          integration: "29/09",
          working: "Corretor",
          phone: "119665516336",
          notes: "mora em guarulhos",
          status: "Encaminhado loja",
          coursePaid: "SIM",
        }),
      ],
      OPTIONS,
    );
    expect(record.errors).toEqual([]);
    expect(record.refs).toEqual({ status: "Encaminhado", manager: "Renata", region: "Guarulhos", source: "Catho", segment: null });
    expect(record.candidate).toMatchObject({
      full_name: "Renato",
      phone: null,
      availability: "to_negotiate",
      currently_working: true,
      created_date: "2026-09-26",
      interview_date: "2026-09-26",
      integration_date: "2026-09-29",
      documentation_status: "complete",
      course_status: "completed",
      course_notes: "Curso pago pela Cava: sim",
    });
    expect(record.candidate.notes.split("\n")).toEqual([
      "mora em guarulhos",
      "Trabalha: Corretor",
      "Status na planilha: Encaminhado loja",
      "Gerente na planilha: RENATA / Lenadro",
      "Captação na planilha: CATHO / CAVAPLAY",
      "Telefone na planilha (inválido): 119665516336",
      "Importado da planilha (aba SETE.26, linha 2) em 24/10/2026.",
    ]);
    expect(record.warnings.join(" ")).toContain("telefone pendente");
  });

  it("sem data de entrevista usa a integração; sem datas usa a importação", () => {
    const records = parseSheet(
      [
        HEADER,
        row({ name: "Iziz", interview: "Seletiva / Luiz", integration: "26/09", phone: "11957226725", status: "Ativo" }),
        row({ name: "Maria Clara", phone: "11 98987-9228", working: "Ativo Guarulhos" }),
      ],
      OPTIONS,
    );
    expect(records[0].candidate).toMatchObject({ interview_date: null, created_date: "2026-09-26" });
    expect(records[0].candidate.notes).toContain("Data de entrevista na planilha: Seletiva / Luiz");
    expect(records[1].candidate).toMatchObject({ created_date: "2026-10-24", phone: "5511989879228" });
    expect(records[1].refs.status).toBe("Ativo");
  });

  it("bloqueia telefone repetido na planilha, datas futuras e status desconhecido", () => {
    const records = parseSheet(
      [
        HEADER,
        row({ name: "Ana", interview: "01/10", phone: "11911112222", status: "Seletiva" }),
        row({ name: "Ana Paula", interview: "02/10", phone: "(11) 91111-2222", status: "Seletiva" }),
        row({ name: "Bia", interview: "30/10", phone: "11911113333", status: "Seletiva" }),
        row({ name: "Caio", interview: "01/10", integration: "20/09", phone: "11911114444", status: "xyz" }),
        row({}),
      ],
      OPTIONS,
    );
    expect(records).toHaveLength(4);
    expect(records[0].errors).toEqual([]);
    expect(records[1].errors[0]).toContain("telefone repetido na planilha (mesmo da linha 2");
    expect(records[2].errors[0]).toContain("entrevista no futuro");
    expect(records[3].errors).toEqual(
      expect.arrayContaining([expect.stringContaining("antes da entrevista"), expect.stringContaining("status não reconhecido")]),
    );
  });
});
