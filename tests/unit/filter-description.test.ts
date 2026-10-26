import { describe, expect, it } from "vitest";

import { describeFilters } from "@/modules/candidates/filter-description";

const option = (id: string, name: string) => ({ id, name, is_active: true });
const OPTIONS = {
  statuses: [{ ...option("s1", "Encaminhado"), color: "violet", position: 1 }],
  regions: [option("r1", "Lapa"), option("r2", "Guarulhos")],
  managers: [{ ...option("m1", "Simone"), phone: null, email: null }],
  sources: [option("o1", "Catho")],
  segments: [option("g1", "Imóveis")],
};

describe("describeFilters", () => {
  it("sem filtros: lista vazia", () => {
    expect(describeFilters({}, OPTIONS)).toEqual([]);
  });

  it("traduz ids, datas e opções para texto", () => {
    expect(
      describeFilters(
        {
          q: "maria 11999998888",
          region_ids: ["r1", "r2", "removida"],
          status_ids: ["s1"],
          manager_ids: ["m1"],
          created_from: "2026-10-01",
          created_to: "2026-10-26",
          integration_to: "2026-10-20",
          integration: "done",
          no_next_action: true,
          missing_phone: true,
          cavaplay: "yes",
          course_paid_by_cava: "no",
        },
        OPTIONS,
      ),
    ).toEqual([
      { label: "Status", value: "Encaminhado" },
      { label: "Região", value: "Lapa, Guarulhos" },
      { label: "Gerente", value: "Simone" },
      { label: "Cadastro", value: "01/10/2026 a 26/10/2026" },
      { label: "Data de integração", value: "até 20/10/2026" },
      { label: "Integração", value: "Integrados" },
      { label: "Acompanhamento", value: "Sem próxima ação, Telefone pendente" },
      { label: "Cavaplay", value: "Sim" },
      { label: "Curso pago pela Cava", value: "Não" },
    ]);
  });
});
