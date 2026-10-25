import { CheckCircle2, Hourglass, Target, Timer, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UrlFilters } from "@/modules/candidates/components/url-filters";
import { filtersFromSearchParams, filtersToSearchParams } from "@/modules/candidates/filters";
import { getCandidateOptions, listCandidates } from "@/modules/candidates/queries";
import { getDashboardSummary } from "@/modules/dashboard/queries";
import { SlaBreakdown } from "@/modules/sla/components/sla-breakdown";
import { SlaCandidateList } from "@/modules/sla/components/sla-candidate-list";
import { getSlaBreakdown, SLA_GROUPS, type SlaGroup } from "@/modules/sla/queries";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "SLA" };

export default async function SlaPage({ searchParams }: PageProps<"/sla">) {
  await requireMember();
  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const groupParam = typeof params.agrupar === "string" ? params.agrupar : "status";
  const group = (SLA_GROUPS.some((item) => item.value === groupParam) ? groupParam : "status") as SlaGroup;

  const [context, options, summary, breakdown, waiting, integrated] = await Promise.all([
    getAppContext(),
    getCandidateOptions(),
    getDashboardSummary(filters),
    getSlaBreakdown(filters, group),
    listCandidates({ filters: { ...filters, integration: "pending" }, sort: "oldest", pageSize: 15 }),
    listCandidates({ filters: { ...filters, integration: "done" }, sort: "integration_recent", pageSize: 15 }),
  ]);
  const { sla } = summary;
  const filterQuery = filtersToSearchParams(filters);

  return (
    <PageContainer>
      <PageHeader
        title="SLA"
        description="Tempo do cadastro até a integração, em dias, no fuso da organização."
        actions={
          <UrlFilters
            value={filters}
            options={options}
            fields={["status", "region", "manager", "source", "segment", "created", "integration_period", "cava"]}
            preserve={["agrupar"]}
          />
        }
      />

      <section aria-label="Indicadores de SLA" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="SLA médio" value={formatDays(sla.avg)} hint={`${sla.completed_count} integrados`} icon={Timer} />
        <StatCard label="SLA mediano" value={formatDays(sla.median)} icon={Timer} />
        <StatCard label="Menor SLA" value={formatDays(sla.min)} icon={TrendingDown} tone="success" />
        <StatCard label="Maior SLA" value={formatDays(sla.max)} icon={TrendingUp} />
        <StatCard
          label="Aguardando integração"
          value={sla.waiting_count}
          hint={sla.waiting_avg === null ? undefined : `média ${formatDays(sla.waiting_avg)} · mediana ${formatDays(sla.waiting_median)}`}
          icon={Hourglass}
        />
        {context.slaTargetDays !== null ? (
          <StatCard
            label={`Acima da meta (${context.slaTargetDays} dias)`}
            value={sla.above_target ?? 0}
            icon={Target}
            tone={(sla.above_target ?? 0) > 0 ? "danger" : "default"}
          />
        ) : (
          <StatCard
            label="Meta de SLA"
            value="—"
            hint="Sem meta definida (Configurações › SLA)"
            icon={Target}
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">SLA por {SLA_GROUPS.find((item) => item.value === group)?.label.toLowerCase()}</h2>
          <nav aria-label="Agrupar por" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {SLA_GROUPS.map((item) => {
              const query = new URLSearchParams(filterQuery);
              query.set("agrupar", item.value);
              const active = item.value === group;
              return (
                <Link
                  key={item.value}
                  href={`/sla?${query.toString()}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm",
                    active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <SlaBreakdown rows={breakdown} group={group} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Hourglass className="size-4 text-muted-foreground" aria-hidden />
            Aguardando integração há mais tempo
          </h2>
          <SlaCandidateList
            rows={waiting.rows}
            timezone={context.timezone}
            slaTarget={context.slaTargetDays}
            emptyText="Nenhum candidato aguardando integração."
          />
        </section>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-4 text-green-600" aria-hidden />
            Integrações mais recentes
          </h2>
          <SlaCandidateList
            rows={integrated.rows}
            timezone={context.timezone}
            slaTarget={context.slaTargetDays}
            emptyText="Nenhuma integração registrada."
          />
        </section>
      </div>
    </PageContainer>
  );
}
