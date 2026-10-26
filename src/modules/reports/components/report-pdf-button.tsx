"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { FilterLine } from "@/modules/candidates/filter-description";
import type { CandidateFilters } from "@/modules/candidates/filters";
import type { DashboardSummary } from "@/modules/dashboard/types";
import { logReportPdfExportAction } from "@/modules/exports/actions";

/** "26/10/2026 às 08:40" no fuso da organização. */
function nowLabel(timeZone: string) {
  const now = new Date();
  const date = now.toLocaleDateString("pt-BR", { timeZone });
  const time = now.toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

/**
 * Gera o relatório em PDF no navegador com os dados já carregados na página
 * (mesmos filtros). A biblioteca de PDF só é baixada ao clicar.
 */
export function ReportPdfButton({
  summary,
  filters,
  filterLines,
  organizationName,
  timezone,
}: {
  summary: DashboardSummary;
  filters: CandidateFilters;
  filterLines: FilterLine[];
  organizationName: string;
  timezone: string;
}) {
  const [loading, setLoading] = useState(false);

  async function exportPdf() {
    setLoading(true);
    try {
      const logged = await logReportPdfExportAction(filters);
      if (!logged.ok) {
        toast.error(logged.error.message);
        return;
      }
      const [{ pdf }, { ReportDocument, registerReportFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../report-pdf"),
      ]);
      registerReportFonts(window.location.origin);
      const blob = await pdf(
        <ReportDocument
          summary={summary}
          filters={filterLines}
          organizationName={organizationName}
          generatedAt={nowLabel(timezone)}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-${summary.today}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Relatório em PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="h-11 md:h-10"
      onClick={exportPdf}
      disabled={loading || summary.totals.active === 0}
      aria-label="Exportar PDF"
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
      <span className="hidden sm:inline" aria-hidden>
        Exportar PDF
      </span>
    </Button>
  );
}
