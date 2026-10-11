import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhone, whatsappHref } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normaliza celular com máscara", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("5511999998888");
  });

  it("aceita número já com DDI", () => {
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
  });

  it("aceita fixo com 8 dígitos", () => {
    expect(normalizePhone("11 3333-4444")).toBe("551133334444");
  });

  it("rejeita números inválidos", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("11 89999-8888")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formata celular e fixo", () => {
    expect(formatPhone("5511999998888")).toBe("(11) 99999-8888");
    expect(formatPhone("551133334444")).toBe("(11) 3333-4444");
  });
});

describe("whatsappHref", () => {
  it("monta o link do WhatsApp", () => {
    expect(whatsappHref("5511999998888")).toBe("https://wa.me/5511999998888");
  });
});
