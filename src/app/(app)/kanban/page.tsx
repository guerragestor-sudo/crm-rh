import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { filtersFromSearchParams } from "@/modules/candidates/filters";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { searchParamsWithSaved } from "@/modules/candidates/saved-filters.server";
import { KanbanBoard } from "@/modules/kanban/components/kanban-board";
import { getKanbanCandidates, KANBAN_LIMIT } from "@/modules/kanban/queries";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Kanban" };

export default async function KanbanPage({ searchParams }: PageProps<"/kanban">) {
  await requireMember();
  const params = await searchParamsWithSaved("kanban", await searchParams);
  // O quadro já agrupa por status: filtro de status não se aplica aqui.
  const { status_ids: _ignored, ...filters } = filtersFromSearchParams(params);
  void _ignored;

  const [options, context, data] = await Promise.all([
    getCandidateOptions(),
    getAppContext(),
    getKanbanCandidates(filters),
  ]);

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Kanban"
        description="Mova candidatos entre os status (arrastando no computador ou pelo botão ⇄). Toda mudança fica no histórico."
      />
      <KanbanBoard
        key={JSON.stringify(filters)}
        rows={data.rows}
        total={data.total}
        limit={KANBAN_LIMIT}
        options={options}
        filters={filters}
        today={context.today}
        nowTime={context.nowTime}
        slaTarget={context.slaTargetDays}
      />
    </PageContainer>
  );
}
