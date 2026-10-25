import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  Hourglass,
  Plus,
  Timer,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatDays } from "@/lib/format";
import { UrlFilters } from "@/modules/candidates/components/url-filters";
import { countActiveFilters, filtersFromSearchParams } from "@/modules/candidates/filters";
import { getCandidateOptions } from "@/modules/candidates/queries";
import { BarList } from "@/modules/dashboard/components/bar-list";
import { MonthlyVolumeChart, SlaTrendChart } from "@/modules/dashboard/components/monthly-charts";
import { StatusDistribution } from "@/modules/dashboard/components/status-distribution";
import { getDashboardSummary } from "@/modules/dashboard/queries";
import { requireMember } from "@/server/auth/session";
import type { ReactNode } from "react";

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const metadata: Metadata = { title: "Início" };

export default async function HomePage({ searchParams }: PageProps<"/inicio">) {
  const member = await requireMember();
  const filters = filtersFromSearchParams(await searchParams);
  const [summary, options] = await Promise.all([getDashboardSummary(filters), getCandidateOptions()]);
  const filtered = countActiveFilters(filters) > 0;
  const { totals, sla } = summary;
  const firstName = member.fullName.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={filtered ? "Indicadores com os filtros aplicados." : "Resumo da sua operação de recrutamento."}
        actions={
          <>
            <UrlFilters
              value={filters}
              options={options}
              fields={["status", "region", "manager", "source", "segment", "created", "cava"]}
            />
            <Button asChild className="hidden h-10 sm:inline-flex">
              <Link href="/candidatos/novo">
                <Plus aria-hidden />
                Novo candidato
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Candidatos ativos" value={totals.active} icon={Users} href="/candidatos" />
        <StatCard label="Novos (7 dias)" value={totals.new_7_days} icon={UserPlus} />
        <StatCard
          label="Tarefas atrasadas"
          value={totals.overdue_tasks}
          icon={AlarmClock}
          tone={totals.overdue_tasks > 0 ? "danger" : "default"}
          href="/agenda?view=overdue"
        />
        <StatCard label="Tarefas de hoje" value={totals.today_tasks} icon={CalendarDays} href="/agenda?view=today" />
        <StatCard
          label="Entrevistas agendadas"
          value={totals.interviews_upcoming}
          hint={`${totals.interviews_today} hoje`}
          icon={CalendarClock}
        />
        <StatCard
          label="Integrações"
          value={totals.integrations}
          hint={`${totals.integrations_this_month} este mês`}
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label="Sem próxima ação"
          value={totals.no_next_action}
          icon={AlarmClock}
          tone={totals.no_next_action > 0 ? "warning" : "default"}
          href="/agenda?view=no_next_action"
        />
        <StatCard
          label="Aguardando integração"
          value={sla.waiting_count}
          hint={sla.waiting_avg === null ? undefined : `há ${formatDays(sla.waiting_avg)} em média`}
          icon={Hourglass}
          href="/sla"
        />
        <StatCard
          label="SLA médio"
          value={formatDays(sla.avg)}
          hint={`${sla.completed_count} integrados`}
          icon={Timer}
          href="/sla"
        />
        <StatCard
          label="SLA mediano"
          value={formatDays(sla.median)}
          hint={sla.min === null ? undefined : `de ${formatDays(sla.min)} a ${formatDays(sla.max)}`}
          icon={Timer}
          href="/sla"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Candidatos por status">
          <StatusDistribution items={summary.by_status} />
        </Panel>
        <Panel title="Candidatos por origem">
          <BarList items={summary.by_source} filterKey="source_ids" />
        </Panel>
        <Panel title="Candidatos por região">
          <BarList items={summary.by_region} filterKey="region_ids" />
        </Panel>
        <Panel title="Candidatos por gerente">
          <BarList items={summary.by_manager} filterKey="manager_ids" />
        </Panel>
        <Panel title="Novos candidatos e integrações por mês" description="Últimos 12 meses (pela data de cadastro e de integração).">
          <MonthlyVolumeChart data={summary.by_month} />
        </Panel>
        <Panel title="SLA por mês de integração" description="Dias entre cadastro e integração, dos integrados em cada mês.">
          <SlaTrendChart data={summary.by_month} />
        </Panel>
      </div>
    </PageContainer>
  );
}
