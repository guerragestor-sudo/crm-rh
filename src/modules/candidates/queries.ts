import "server-only";

import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import { toRpcFilters, type CandidateFilters } from "./filters";
import type {
  CandidateDetail,
  CandidateListResult,
  CandidateListRow,
  CandidateOptions,
  HistoryEntry,
  SortKey,
} from "./types";

export const PAGE_SIZE = 25;

// Ao ordenar o resultado de uma função, o PostgREST exige a coluna no select:
// todas as colunas de SORTS precisam estar aqui.
const LIST_SELECT = `
  id, full_name, phone, email, created_at, status_changed_at, interview_at, integration_date, integration_planned_date,
  archived_at, sla_days,
  status:candidate_statuses(id, name, color),
  region:regions(name),
  manager:managers(id, name),
  source:sources(name),
  next_task
`;

const SORTS: Record<SortKey, { column: string; ascending: boolean }> = {
  recent: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  name: { column: "full_name", ascending: true },
  status_changed: { column: "status_changed_at", ascending: false },
  integration_recent: { column: "integration_date", ascending: false },
};

/** Lista paginada; a semântica dos filtros é a da função SQL filter_candidates. */
export async function listCandidates(params: {
  filters: CandidateFilters;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}): Promise<CandidateListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const sort = SORTS[params.sort ?? "recent"];
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .rpc("filter_candidates", { p_filters: toRpcFilters(params.filters) }, { count: "exact" })
    .select(LIST_SELECT)
    .order(sort.column, { ascending: sort.ascending })
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw fromDatabaseError(error, { op: "list_candidates" });
  return { rows: (data ?? []) as unknown as CandidateListRow[], total: count ?? 0, page, pageSize };
}

export async function getCandidateOptions(): Promise<CandidateOptions> {
  const supabase = await createClient();
  const [statuses, regions, segments, sources, managers, members] = await Promise.all([
    supabase.from("candidate_statuses").select("id, name, color, position, is_active").order("position"),
    supabase.from("regions").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("segments").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("sources").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("managers").select("id, name, phone, email, is_active").order("name"),
    supabase.from("organization_members").select("id, status, profiles(full_name)").eq("status", "active"),
  ]);

  for (const result of [statuses, regions, segments, sources, managers, members]) {
    if (result.error) throw fromDatabaseError(result.error, { op: "candidate_options" });
  }

  return {
    statuses: statuses.data ?? [],
    regions: regions.data ?? [],
    segments: segments.data ?? [],
    sources: sources.data ?? [],
    managers: managers.data ?? [],
    members: (members.data ?? []).map((member) => ({
      id: member.id,
      name: member.profiles?.full_name ?? "Usuário",
    })),
  };
}

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select(
      `id, full_name, phone, email, cpf, region_id, segment_id, availability, currently_working, source_id,
       manager_id, notes, status_id, status_changed_at, interview_at, integration_date, integration_planned_date,
       documentation_status,
       documentation_notes, course_status, course_notes, cavaplay, course_paid_by_cava, sla_days, sla_days_frozen,
       responsible_member_id, archived_at, created_at, updated_at,
       status:candidate_statuses(id, name, color),
       region:regions(name),
       segment:segments(name),
       source:sources(name),
       manager:managers(id, name, phone)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw fromDatabaseError(error, { op: "get_candidate" });
  }
  return data as unknown as CandidateDetail | null;
}

export async function getCandidateHistory(candidateId: string): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidate_history")
    .select(
      "id, action, field, old_value, new_value, reason, metadata, created_at, actor:organization_members(profiles(full_name))",
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(300);

  if (error) throw fromDatabaseError(error, { op: "candidate_history" });

  return (data ?? []).map((row) => {
    const actor = row.actor as { profiles: { full_name: string } | null } | null;
    return {
      id: row.id,
      action: row.action,
      field: row.field,
      old_value: row.old_value,
      new_value: row.new_value,
      reason: row.reason,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
      actor_name: actor?.profiles?.full_name ?? null,
    };
  });
}

export type IntegrationToConfirm = {
  id: string;
  full_name: string;
  integration_planned_date: string;
  status: { name: string; color: string } | null;
  manager: { name: string } | null;
};

/** Integrações combinadas para hoje ou antes e ainda não confirmadas (Agenda). */
export async function getIntegrationsToConfirm(today: string): Promise<IntegrationToConfirm[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("id, full_name, integration_planned_date, status:candidate_statuses(name, color), manager:managers(name)")
    .is("integration_date", null)
    .is("archived_at", null)
    .lte("integration_planned_date", today)
    .order("integration_planned_date", { ascending: true })
    .limit(100);
  if (error) throw fromDatabaseError(error, { op: "integrations_to_confirm" });
  return (data ?? []) as IntegrationToConfirm[];
}
