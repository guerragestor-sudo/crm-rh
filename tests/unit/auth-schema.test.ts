import { describe, expect, it } from "vitest";

import { loginSchema, safeNextPath } from "@/modules/auth/schema";

describe("loginSchema", () => {
  it("normaliza o e-mail", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Exemplo.com ", password: "x" });
    expect(parsed.email).toBe("admin@exemplo.com");
  });

  it("exige e-mail válido e senha", () => {
    const result = loginSchema.safeParse({ email: "invalido", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("aceita caminho interno", () => {
    expect(safeNextPath("/candidatos?status=1")).toBe("/candidatos?status=1");
  });

  it("bloqueia redirecionamento externo", () => {
    expect(safeNextPath("https://malicioso.com")).toBeNull();
    expect(safeNextPath("//malicioso.com")).toBeNull();
    expect(safeNextPath("/\\malicioso.com")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
