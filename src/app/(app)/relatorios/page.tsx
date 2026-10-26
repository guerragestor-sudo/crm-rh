import { FileDown } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatDays, formatNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { UrlFilters } from "@/modules/candidates/components/url-filters";
import { describeFilters } from "@/modules/candidates/filter-description";
import { countActiveFilters, filtersFromSearchParams } from "@/modules/candidates/filters";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { BarList } from "@/modules/dashboard/components/bar-list";
import { StatusDistribution } from "@/modules/dashboard/components/status-distribution";
import { getDashboardSummary } from "@/modules/dashboard/queries";
import { ExportButton } from "@/modules/exports/export-button";
import { ReportPdfButton } from "@/modules/reports/components/report-pdf-button";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const member = await requireMember();
  const filters = filtersFromSearchParams(await searchParams);
  const [summary, options, context] = await Promise.all([
    getDashboardSummary(filters),
    getCandidateOptions(),
    getAppContext(),
  ]);
  const canExport = can(member.role, "candidates.export");
  const { totals, sla } = summary;
  const activeFilters = countActiveFilters(filters);

  return (
    <PageContainer>
      <PageHeader
        title="Relatórios"
        description={
          activeFilters > 0
            ? `${activeFilters} ${activeFilters === 1 ? "filtro aplicado" : "filtros aplicados"}. A exportação traz exatamente este resultado.`
            : "Combine filtros (região, status, gerente, período…) e exporte o resultado em PDF ou CSV."
        }
        actions={
          <>
            <UrlFilters
              value={filters}
              options={options}
              fields={[
                "status",
                "region",
                "manager",
                "source",
                "segment",
                "created",
                "integration_period",
                "integration",
                "tasks",
                "cava",
              ]}
            />
            {canExport ? (
              <ReportPdfButton
                summary={summary}
                filters={filters}
                filterLines={describeFilters(filters, options)}
                organizationName={member.organizationName}
                timezone={context.timezone}
              />
            ) : null}
            {canExport ? <ExportButton filters={filters} total={totals.active} /> : null}
          </>
        }
      />

      {totals.active === 0 ? (
        <EmptyState
          icon={FileDown}
          title="Nenhum candidato com esses filtros"
          description="Ajuste os filtros para gerar o relatório."
        />
      ) : (
        <>
          <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Candidatos" value={formatNumber(totals.active)} />
            <StatCard label="Integrados" value={formatNumber(totals.integrations)} />
            <StatCard label="SLA médio" value={formatDays(sla.avg)} hint={`mediano ${formatDays(sla.median)}`} />
            <StatCard label="Aguardando integração" value={formatNumber(sla.waiting_count)} />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
              <h2 className="mb-4 text-sm font-semibold">Por status</h2>
              <StatusDistribution items={summary.by_status} />
            </section>
            <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
              <h2 className="mb-4 text-sm font-semibold">Por gerente</h2>
              <BarList items={summary.by_manager} filterKey="manager_ids" />
            </section>
            <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
              <h2 className="mb-4 text-sm font-semibold">Por região</h2>
              <BarList items={summary.by_region} filterKey="region_ids" />
            </section>
            <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
              <h2 className="mb-4 text-sm font-semibold">Por origem</h2>
              <BarList items={summary.by_source} filterKey="source_ids" />
            </section>
          </div>
        </>
      )}
    </PageContainer>
  );
}
