import { FileSpreadsheet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { MAX_RELEASES_IN_POPUP, RELEASES, releasesFor, unseenReleases, type Release } from "@/modules/updates/releases";

const card = { icon: FileSpreadsheet, title: "Cartão", body: "Texto." };
const release = (id: number, date: string, extra: Partial<Release> = {}): Release => ({
  id,
  date,
  title: `Novidade ${id}`,
  cards: [card, card],
  ...extra,
});

describe("conteúdo das novidades (releases.ts)", () => {
  it("ids únicos, positivos e do mais novo para o mais antigo", () => {
    const ids = RELEASES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it("datas válidas e na mesma ordem dos ids", () => {
    for (const item of RELEASES) expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = RELEASES.map((item) => item.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("cada novidade tem de 2 a 4 cartões curtos", () => {
    for (const item of RELEASES) {
      expect(item.cards.length, item.title).toBeGreaterThanOrEqual(2);
      expect(item.cards.length, item.title).toBeLessThanOrEqual(4);
      for (const entry of item.cards) {
        expect(entry.title.length, entry.title).toBeLessThanOrEqual(60);
        expect(entry.body.length, entry.title).toBeLessThanOrEqual(220);
      }
      if (item.action) expect(item.action.href).toMatch(/^\//);
    }
  });
});

describe("quem vê o pop-up", () => {
  const list = [
    release(4, "2026-12-20", { permission: "settings.manage" }),
    release(3, "2026-12-10"),
    release(2, "2026-11-20"),
    release(1, "2026-11-05"),
  ];

  it("quem nunca viu recebe as mais novas, até o limite", () => {
    const result = unseenReleases({ role: "admin", seen: null, memberSince: "2026-10-11" }, list);
    expect(result.map((item) => item.id)).toEqual([4, 3, 2].slice(0, MAX_RELEASES_IN_POPUP));
  });

  it("não repete o que já foi visto", () => {
    expect(unseenReleases({ role: "admin", seen: 3, memberSince: "2026-10-11" }, list).map((item) => item.id)).toEqual([4]);
    expect(unseenReleases({ role: "admin", seen: 4, memberSince: "2026-10-11" }, list)).toEqual([]);
  });

  it("quem entrou depois não recebe as novidades antigas", () => {
    const result = unseenReleases({ role: "admin", seen: null, memberSince: "2026-12-01" }, list);
    expect(result.map((item) => item.id)).toEqual([4, 3]);
  });

  it("novidade com permissão só aparece para quem pode usar", () => {
    expect(unseenReleases({ role: "recruiter", seen: 2, memberSince: "2026-10-11" }, list).map((item) => item.id)).toEqual([3]);
    expect(releasesFor("recruiter", list).map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it("a importação de planilha aparece para administrador e recrutador", () => {
    for (const role of ["admin", "recruiter"] as const) {
      expect(unseenReleases({ role, seen: null, memberSince: "2026-10-11" }).map((item) => item.title)).toContain(
        "Importar planilha",
      );
    }
  });
});
