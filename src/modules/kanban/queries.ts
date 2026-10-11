import "server-only";

import type { CandidateFilters } from "@/modules/candidates/filters";
import { listCandidates } from "@/modules/candidates/queries";

/** Limite de cartões carregados no quadro (o PostgREST também limita a 1000 linhas). */
export const KANBAN_LIMIT = 1000;

export async function getKanbanCandidates(filters: CandidateFilters) {
  return listCandidates({ filters, sort: "status_changed", page: 1, pageSize: KANBAN_LIMIT });
}
