import { NextResponse, type NextRequest } from "next/server";

import { formatCpf } from "@/lib/cpf";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { candidateFiltersSchema, toRpcFilters } from "@/modules/candidates/filters";
import { AVAILABILITY_LABELS, COURSE_LABELS, DOCUMENTATION_LABELS } from "@/modules/candidates/labels";
import { toCsv } from "@/modules/exports/csv";
import { authorize } from "@/server/auth/session";
import { getAppContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { createClient } from "@/server/supabase/server";

const PAGE = 1000;
const MAX_ROWS = 20000;
const SELECT = `full_name, phone, email, cpf, availability, currently_working, notes, interview_at, integration_date,
  documentation_status, course_status, cavaplay, course_paid_by_cava, created_at, sla_days,
  status:candidate_statuses(name), region:regions(name), segment:segments(name), source:sources(name), manager:managers(name)`;

type Row = {
  full_name: string; phone: string | null; email: string | null; cpf: string | null; availability: string | null;
  currently_working: boolean | null; notes: string | null; interview_at: string | null; integration_date: string | null;
  documentation_status: string; course_status: string; cavaplay: boolean; course_paid_by_cava: boolean;
  created_at: string; sla_days: number;
  status: { name: string } | null; region: { name: string } | null; segment: { name: string } | null;
  source: { name: string } | null; manager: { name: string } | null;
};

/** Exporta exatamente o resultado dos filtros (mesma função SQL da lista). POST: filtros podem conter CPF/telefone. */
export async function POST(request: NextRequest) {
  try {
    await authorize("candidates.export");
    const body = await request.json().catch(() => null);
    const parsed = candidateFiltersSchema.safeParse(body?.filters ?? {});
    if (!parsed.success) return NextResponse.json({ error: "Filtros inválidos." }, { status: 400 });

    const supabase = await createClient();
    const context = await getAppContext();
    const rpcFilters = toRpcFilters(parsed.data);
    const rows: Row[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .rpc("filter_candidates", { p_filters: rpcFilters })
        .select(SELECT)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < PAGE) break;
    }

    const csv = toCsv(
      ["Nome", "Telefone", "E-mail", "CPF", "Região", "Ramo", "Disponibilidade", "Trabalha atualmente", "Origem",
        "Gerente", "Status", "Entrevista", "Integração", "SLA (dias)", "Documentação", "Curso", "Cavaplay",
        "Curso pago pela Cava", "Observação", "Cadastro"],
      rows.map((row) => [
        row.full_name, formatPhone(row.phone), row.email, row.cpf ? formatCpf(row.cpf) : "", row.region?.name,
        row.segment?.name, row.availability ? AVAILABILITY_LABELS[row.availability] : "",
        row.currently_working === null ? "" : row.currently_working ? "Sim" : "Não", row.source?.name,
        row.manager?.name, row.status?.name, formatDateTime(row.interview_at, context.timezone),
        formatDate(row.integration_date), row.sla_days, DOCUMENTATION_LABELS[row.documentation_status],
        COURSE_LABELS[row.course_status], row.cavaplay ? "Sim" : "Não", row.course_paid_by_cava ? "Sim" : "Não",
        row.notes, formatDateTime(row.created_at, context.timezone),
      ]),
    );

    await supabase.rpc("log_audit_event", {
      p_action: "data_export",
      p_entity_type: "candidates",
      p_metadata: { format: "csv", rows: rows.length, filters: Object.keys(rpcFilters).filter((key) => key !== "q") },
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="candidatos-${context.today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AppError && error.code === "FORBIDDEN") return NextResponse.json({ error: error.message }, { status: 403 });
    logger.error("export_failed");
    return NextResponse.json({ error: "Não foi possível exportar." }, { status: 500 });
  }
}
