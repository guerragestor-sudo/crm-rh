import "server-only";

import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

export type RecentImport = {
  id: string;
  file_name: string;
  row_count: number;
  created_at: string;
  created_by_member_id: string;
  undone_at: string | null;
  /** Passou o prazo de 7 dias para desfazer (o banco confere de novo). */
  expired: boolean;
};

const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Últimas importações da organização (para conferir e desfazer). */
export async function getRecentImports(limit = 10): Promise<RecentImport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidate_imports")
    .select("id, file_name, row_count, created_at, created_by_member_id, undone_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw fromDatabaseError(error, { op: "recent_imports" });
  const now = Date.now();
  return (data ?? []).map((item) => ({ ...item, expired: now - Date.parse(item.created_at) >= UNDO_WINDOW_MS }));
}
