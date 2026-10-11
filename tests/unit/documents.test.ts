import { describe, expect, it } from "vitest";

import { formatBytes, validateDocumentFile } from "@/modules/documents/constants";

describe("validateDocumentFile", () => {
  it("aceita PDF, Word e imagens até 10 MB", () => {
    expect(validateDocumentFile({ size: 1000, type: "application/pdf" })).toBeNull();
    expect(validateDocumentFile({ size: 1000, type: "image/png" })).toBeNull();
    expect(
      validateDocumentFile({
        size: 1000,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBeNull();
  });

  it("recusa formato não suportado (ex.: HEIC do iPhone)", () => {
    expect(validateDocumentFile({ size: 1000, type: "image/heic" })).toMatch(/Formato/);
  });

  it("recusa arquivo vazio ou acima de 10 MB", () => {
    expect(validateDocumentFile({ size: 0, type: "application/pdf" })).toMatch(/vazio/);
    expect(validateDocumentFile({ size: 11 * 1024 * 1024, type: "application/pdf" })).toMatch(/10 MB/);
  });
});

describe("formatBytes", () => {
  it("formata tamanhos", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
