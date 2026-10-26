import { describe, expect, it } from "vitest";

import {
  filtersFromSearchParams,
  filtersToSearchParams,
  hasFilterParams,
  normalizeSearchText,
  toRpcFilters,
  withSavedParams,
} from "@/modules/candidates/filters";

const A = "4e5d6f76-44d2-4056-8ff8-ad810d5f5028";
const B = "f3b8b344-a057-4b64-8553-ac12547db7ac";

describe("filtros de candidatos", () => {
  it("faz ida e volta pela URL sem perder filtros", () => {
    const filters = {
      region_ids: [A],
      status_ids: [B],
      created_from: "2026-01-01",
      no_next_action: true,
      missing_phone: true,
      integration: "pending" as const,
      cavaplay: "yes" as const,
      course_paid_by_cava: "no" as const,
    };
    const params = filtersToSearchParams(filters);
    expect(filtersFromSearchParams(params)).toEqual(filters);
  });

  it("nunca coloca o texto livre na URL", () => {
    const params = filtersToSearchParams({ q: "123.456.789-09", region_ids: [A] });
    expect(params.toString()).not.toContain("123");
    expect(params.has("q")).toBe(false);
  });

  it("ignora valores inválidos vindos da URL", () => {
    const filters = filtersFromSearchParams({
      region_ids: "nao-e-uuid",
      created_from: "2026-13-45",
      cavaplay: "talvez",
      status_ids: B,
    });
    expect(filters).toEqual({ status_ids: [B] });
  });

  it("normaliza busca numérica para dígitos", () => {
    expect(normalizeSearchText("(11) 97000-1371")).toBe("11970001371");
    expect(normalizeSearchText("Ana Paula")).toBe("Ana Paula");
    expect(normalizeSearchText("ana@x.com")).toBe("ana@x.com");
    expect(normalizeSearchText("   ")).toBeUndefined();
  });

  it("monta o payload da RPC sem chaves vazias", () => {
    expect(toRpcFilters({ q: "  ", status_ids: [], archived: false, region_ids: [A] })).toEqual({ region_ids: [A] });
  });

  it("filtro salvo só vale quando a URL não traz filtro", () => {
    const saved = filtersToSearchParams({ region_ids: [A], cavaplay: "yes" });
    saved.set("sort", "oldest");
    const savedText = saved.toString();

    // Voltou pelo menu: URL vazia → usa o salvo (com ordenação).
    const restored = withSavedParams({}, savedText);
    expect(filtersFromSearchParams(restored)).toEqual({ region_ids: [A], cavaplay: "yes" });
    expect(restored.sort).toBe("oldest");

    // Cookie codificado (como o navegador grava) também funciona.
    expect(filtersFromSearchParams(withSavedParams({}, encodeURIComponent(savedText)))).toEqual({
      region_ids: [A],
      cavaplay: "yes",
    });

    // Link com filtro explícito vence o salvo.
    expect(withSavedParams({ missing_phone: "1" }, savedText)).toEqual({ missing_phone: "1" });
    expect(withSavedParams({ sort: "name" }, savedText)).toEqual({ sort: "name" });
    expect(withSavedParams({}, undefined)).toEqual({});
  });

  it("filtro salvo adulterado é descartado", () => {
    expect(filtersFromSearchParams(withSavedParams({}, "region_ids=nao-e-uuid&cavaplay=talvez"))).toEqual({});
    expect(withSavedParams({}, "%E0%A4%A")).toEqual({});
  });

  it("aceita o filtro de integração prevista", () => {
    expect(filtersFromSearchParams({ integration: "planned" })).toEqual({ integration: "planned" });
  });

  it("detecta se a URL já tem filtro ou ordenação", () => {
    expect(hasFilterParams({})).toBe(false);
    expect(hasFilterParams({ q: "maria" })).toBe(false);
    expect(hasFilterParams({ status_ids: B })).toBe(true);
    expect(hasFilterParams(new URLSearchParams("course_paid_by_cava=no"))).toBe(true);
  });
});
