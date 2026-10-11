import "server-only";

import type { CandidateFilters } from "@/modules/candidates/filters";
import { toRpcFilters } from "@/modules/candidates/filters";
import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import type { DashboardSummary } from "./types";

export async function getDashboardSummary(filters: CandidateFilters = {}): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", { p_filters: toRpcFilters(filters) });
  if (error) throw fromDatabaseError(error, { op: "dashboard_summary" });
  return data as unknown as DashboardSummary;
}
