import { describe, expect, it } from "vitest";

import { formatCpf, isValidCpf } from "@/lib/cpf";

describe("isValidCpf", () => {
  it("aceita CPF válido com e sem máscara", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCpf("111.444.777-36")).toBe(false);
  });

  it("rejeita sequências repetidas e tamanho errado", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("1114447773")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("aplica a máscara", () => {
    expect(formatCpf("11144477735")).toBe("111.444.777-35");
  });

  it("devolve vazio para nulo", () => {
    expect(formatCpf(null)).toBe("");
  });
});
