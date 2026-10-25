import { describe, expect, it } from "vitest";

import {
  candidateFormSchema,
  emptyCandidateForm,
  isoToLocalDateTime,
  localDateTimeToIso,
  toCandidateWrite,
} from "@/modules/candidates/schema";

const STATUS = "42a84824-34c8-4530-bd65-ade242ed7250";

describe("candidateFormSchema", () => {
  it("exige nome e status", () => {
    const result = candidateFormSchema.safeParse(emptyCandidateForm());
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["full_name", "status_id"]));
    expect(paths).not.toContain("phone");
  });

  it("aceita cadastro sem telefone e sem e-mail (telefone pendente)", () => {
    const values = { ...emptyCandidateForm(STATUS), full_name: "Maria Silva" };
    expect(candidateFormSchema.safeParse(values).success).toBe(true);
    expect(toCandidateWrite(values)).toMatchObject({ phone: null, email: null });
  });

  it("aceita cadastro mínimo (nome + telefone + status)", () => {
    const values = { ...emptyCandidateForm(STATUS), full_name: "Maria Silva", phone: "(11) 98888-7777" };
    expect(candidateFormSchema.safeParse(values).success).toBe(true);
  });

  it("rejeita CPF e telefone inválidos", () => {
    const values = {
      ...emptyCandidateForm(STATUS),
      full_name: "Maria Silva",
      phone: "1234",
      cpf: "111.111.111-11",
    };
    const result = candidateFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["phone", "cpf"]));
  });
});

describe("toCandidateWrite", () => {
  it("normaliza os campos para o banco", () => {
    const write = toCandidateWrite({
      ...emptyCandidateForm(STATUS),
      full_name: "  Maria   da  Silva ",
      phone: "(11) 98888-7777",
      email: "Maria@Exemplo.COM",
      cpf: "111.444.777-35",
      currently_working: "no",
      interview_at: "2026-10-08T14:30",
    });
    expect(write).toMatchObject({
      full_name: "Maria da Silva",
      phone: "5511988887777",
      email: "maria@exemplo.com",
      cpf: "11144477735",
      currently_working: false,
      cavaplay: false,
      course_paid_by_cava: false,
      region_id: null,
      interview_at: "2026-10-08T17:30:00.000Z",
    });
  });
});

describe("campos da Cava", () => {
  it("começam em Não e viram booleanos", () => {
    const base = { ...emptyCandidateForm(STATUS), full_name: "Maria Silva" };
    expect(base).toMatchObject({ cavaplay: "no", course_paid_by_cava: "no" });
    const write = toCandidateWrite({ ...base, cavaplay: "yes", course_paid_by_cava: "no" });
    expect(write).toMatchObject({ cavaplay: true, course_paid_by_cava: false });
  });

  it("rejeitam valores fora de sim/não", () => {
    const values = { ...emptyCandidateForm(STATUS), full_name: "Maria Silva", cavaplay: "talvez" };
    const result = candidateFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["cavaplay"]);
  });
});

describe("conversão de data/hora no fuso da organização", () => {
  it("faz ida e volta", () => {
    const iso = localDateTimeToIso("2026-03-01T09:15");
    expect(iso).toBe("2026-03-01T12:15:00.000Z");
    expect(isoToLocalDateTime(iso)).toBe("2026-03-01T09:15");
  });
});
