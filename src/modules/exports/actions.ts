"use server";

import { candidateFiltersSchema, toRpcFilters } from "@/modules/candidates/filters";
import { authorize } from "@/server/auth/session";
import { fromDatabaseError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

/**
 * Registra na auditoria a exportação do relatório em PDF (gerado no navegador),
 * com a mesma permissão da exportação CSV. Sem registro, o PDF não é gerado.
 */
export async function logReportPdfExportAction(input: unknown): Promise<ActionResult> {
  try {
    await authorize("candidates.export");
    const parsed = candidateFiltersSchema.safeParse(input);
    const filters = parsed.success ? Object.keys(toRpcFilters(parsed.data)).filter((key) => key !== "q") : [];
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_audit_event", {
      p_action: "data_export",
      p_entity_type: "report",
      p_metadata: { format: "pdf", filters },
    });
    if (error) throw fromDatabaseError(error, { op: "log_report_pdf" });
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
