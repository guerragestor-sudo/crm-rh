import { FileSpreadsheet, Link2, ListChecks, Undo2, type LucideIcon } from "lucide-react";

import { can, type MemberRole, type Permission } from "@/lib/permissions";

/**
 * Novidades do app: aparecem num pop-up rápido depois do login, uma vez por
 * usuário (o "visto" fica no banco, então vale para celular e computador), e
 * ficam reunidas na página /novidades (menu do usuário → Novidades).
 *
 * Como publicar uma novidade: acrescente um item NO TOPO de RELEASES com o
 * próximo id (nunca reutilize nem mude um id já publicado), 2 a 4 cartões
 * curtos, no máximo 2 frases cada, na língua de quem usa o app, sem termos
 * técnicos. Use `permission` quando a novidade só faz sentido para quem pode
 * usá-la.
 */

export type UpdateCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export type Release = {
  /** Sequencial e crescente. É o que o banco guarda como "visto". */
  id: number;
  /** Data de publicação (yyyy-mm-dd). Quem entrou no CRM depois não recebe o pop-up. */
  date: string;
  title: string;
  /** Só aparece para quem tem esta permissão. */
  permission?: Permission;
  cards: UpdateCard[];
  /** Botão para experimentar a novidade (no último cartão e na página de novidades). */
  action?: { label: string; href: string };
};

export const RELEASES: readonly Release[] = [
  {
    id: 1,
    date: "2026-11-05",
    title: "Importar planilha",
    permission: "candidates.write",
    cards: [
      {
        icon: FileSpreadsheet,
        title: "Cadastre vários candidatos de uma vez",
        body: "Em Candidatos, toque em Importar planilha. Use o arquivo .xlsx (no Google Planilhas: Arquivo → Fazer download → Microsoft Excel) ou copie as células e cole.",
      },
      {
        icon: ListChecks,
        title: "Confira e corrija antes de gravar",
        body: "A prévia mostra cada linha e você edita direto nela. Linhas com problema, como telefone que já está no CRM, ficam de fora até serem corrigidas.",
      },
      {
        icon: Link2,
        title: "Nomes que o CRM ainda não conhece",
        body: "Se a planilha traz um gerente, região ou origem novos, você liga a um que já existe ou cria um novo. Erros de digitação ganham sugestão.",
      },
      {
        icon: Undo2,
        title: "Errou? Dá para desfazer",
        body: "Em Importações recentes, Desfazer apaga os candidatos daquela importação em até 7 dias, se nenhum tiver documento anexado.",
      },
    ],
    action: { label: "Abrir Importar planilha", href: "/candidatos/importar" },
  },
];

/** Quantas novidades não vistas entram no pop-up de uma vez (as mais novas). */
export const MAX_RELEASES_IN_POPUP = 3;

/** Novidades que a pessoa pode ver (pela permissão), da mais nova para a mais antiga. */
export function releasesFor(role: MemberRole, releases: readonly Release[] = RELEASES): Release[] {
  return releases
    .filter((release) => !release.permission || can(role, release.permission))
    .sort((a, b) => b.id - a.id);
}

/**
 * Novidades do pop-up: ainda não vistas, publicadas a partir do dia em que a
 * pessoa entrou no CRM (quem chega agora não recebe o histórico inteiro).
 */
export function unseenReleases(
  input: { role: MemberRole; seen: number | null; memberSince: string },
  releases: readonly Release[] = RELEASES,
): Release[] {
  const seen = input.seen ?? 0;
  return releasesFor(input.role, releases)
    .filter((release) => release.id > seen && release.date >= input.memberSince)
    .slice(0, MAX_RELEASES_IN_POPUP);
}
