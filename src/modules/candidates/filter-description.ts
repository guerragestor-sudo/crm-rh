import { formatDate } from "@/lib/format";

import type { CandidateFilters } from "./filters";
import type { CandidateOptions, Option } from "./types";

export type FilterLine = { label: string; value: string };

type ListOptions = Pick<CandidateOptions, "statuses" | "regions" | "managers" | "sources" | "segments">;

const LISTS = [
  ["status_ids", "statuses", "Status"],
  ["region_ids", "regions", "Região"],
  ["manager_ids", "managers", "Gerente"],
  ["source_ids", "sources", "Origem"],
  ["segment_ids", "segments", "Ramo"],
] as const;

function names(ids: string[] | undefined, items: Option[]) {
  return (ids ?? []).map((id) => items.find((item) => item.id === id)?.name).filter(Boolean).join(", ");
}

function period(from: string | undefined, to: string | undefined) {
  if (from && to) return `${formatDate(from)} a ${formatDate(to)}`;
  if (from) return `a partir de ${formatDate(from)}`;
  if (to) return `até ${formatDate(to)}`;
  return "";
}

const yesNo = (value: "yes" | "no") => (value === "yes" ? "Sim" : "Não");

/**
 * Filtros em texto legível (cabeçalho do relatório em PDF), na mesma ordem do
 * painel de filtros. O texto livre da busca não entra (pode ter dado pessoal).
 */
export function describeFilters(filters: CandidateFilters, options: ListOptions): FilterLine[] {
  const lines: FilterLine[] = [];
  for (const [key, optionKey, label] of LISTS) {
    const value = names(filters[key], options[optionKey]);
    if (value) lines.push({ label, value });
  }
  const created = period(filters.created_from, filters.created_to);
  if (created) lines.push({ label: "Cadastro", value: created });
  const integrated = period(filters.integration_from, filters.integration_to);
  if (integrated) lines.push({ label: "Data de integração", value: integrated });
  if (filters.integration) {
    lines.push({ label: "Integração", value: filters.integration === "done" ? "Integrados" : "Aguardando integração" });
  }
  const followUp = [
    filters.has_overdue_task ? "Com tarefa atrasada" : "",
    filters.no_next_action ? "Sem próxima ação" : "",
    filters.missing_phone ? "Telefone pendente" : "",
  ].filter(Boolean);
  if (followUp.length) lines.push({ label: "Acompanhamento", value: followUp.join(", ") });
  if (filters.cavaplay) lines.push({ label: "Cavaplay", value: yesNo(filters.cavaplay) });
  if (filters.course_paid_by_cava) lines.push({ label: "Curso pago pela Cava", value: yesNo(filters.course_paid_by_cava) });
  if (filters.archived) lines.push({ label: "Situação", value: "Somente arquivados" });
  return lines;
}
