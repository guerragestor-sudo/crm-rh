import "server-only";

import { toRpcFilters, type CandidateFilters } from "@/modules/candidates/filters";
import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

export const SLA_GROUPS = [
  { value: "status", label: "Status" },
  { value: "region", label: "Região" },
  { value: "source", label: "Origem" },
  { value: "manager", label: "Gerente" },
  { value: "segment", label: "Ramo" },
  { value: "month", label: "Mês de integração" },
] as const;

export type SlaGroup = (typeof SLA_GROUPS)[number]["value"];

export type SlaBreakdownRow = {
  key: string | null;
  name: string;
  completed_count: number;
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  waiting_count: number;
  waiting_avg: number | null;
};

export async function getSlaBreakdown(filters: CandidateFilters, group: SlaGroup): Promise<SlaBreakdownRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sla_breakdown", {
    p_filters: toRpcFilters(filters),
    p_group_by: group,
  });
  if (error) throw fromDatabaseError(error, { op: "sla_breakdown" });
  return (data ?? []) as unknown as SlaBreakdownRow[];
}
