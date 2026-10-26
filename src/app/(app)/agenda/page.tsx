import { CalendarCheck, CheckCircle2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { IntegrationsToConfirm } from "@/modules/candidates/components/integrations-to-confirm";
import { getCandidateOptions, getIntegrationsToConfirm } from "@/modules/candidates/queries";
import { NoNextActionList } from "@/modules/tasks/components/no-next-action-list";
import { TaskDialog } from "@/modules/tasks/components/task-dialog";
import { TaskList } from "@/modules/tasks/components/task-list";
import { AGENDA_VIEWS, type AgendaView } from "@/modules/tasks/labels";
import { getAgendaCounts, getAgendaTasks, getNoNextActionCandidates } from "@/modules/tasks/queries";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Agenda" };

const EMPTY: Record<AgendaView, { title: string; description: string }> = {
  overdue: { title: "Nenhuma tarefa atrasada", description: "Tudo em dia." },
  today: { title: "Nada para hoje", description: "Crie uma tarefa ou veja as próximas." },
  upcoming: { title: "Nenhuma tarefa futura", description: "Agende o próximo contato com seus candidatos." },
  done: { title: "Nenhuma tarefa concluída ainda", description: "As tarefas concluídas aparecem aqui." },
  no_next_action: {
    title: "Todos os candidatos têm próxima ação",
    description: "Cada candidato ativo tem pelo menos uma tarefa pendente.",
  },
};

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const member = await requireMember();
  const { view: viewParam } = await searchParams;
  const view = (AGENDA_VIEWS.some((item) => item.value === viewParam) ? viewParam : "today") as AgendaView;

  const context = await getAppContext();
  const [counts, options, tasks, candidates, integrations] = await Promise.all([
    getAgendaCounts(context),
    getCandidateOptions(),
    view === "no_next_action" ? Promise.resolve([]) : getAgendaTasks(view, context),
    view === "no_next_action" ? getNoNextActionCandidates() : Promise.resolve(null),
    view === "today" ? getIntegrationsToConfirm(context.today) : Promise.resolve([]),
  ]);

  const countFor = (value: AgendaView) => (value === "done" ? null : counts[value]);
  const itemProps = {
    today: context.today,
    nowTime: context.nowTime,
    timezone: context.timezone,
    members: options.members,
    defaultResponsibleId: member.memberId,
  };
  const isEmpty = view === "no_next_action" ? !candidates?.rows.length : tasks.length === 0;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Agenda"
        description="Suas tarefas e o próximo passo de cada candidato."
        actions={
          <TaskDialog
            today={context.today}
            members={options.members}
            defaultResponsibleId={member.memberId}
            trigger={
              <Button className="h-10">
                <Plus aria-hidden />
                Nova tarefa
              </Button>
            }
          />
        }
      />

      <nav aria-label="Visões da agenda" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {AGENDA_VIEWS.map((item) => {
          const active = item.value === view;
          const count = countFor(item.value);
          const alert = item.value === "overdue" && count && count > 0;
          return (
            <Link
              key={item.value}
              href={`/agenda?view=${item.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm",
                active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {item.label}
              {count !== null ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                    alert ? "bg-red-600 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <IntegrationsToConfirm
        rows={integrations}
        today={context.today}
        canWrite={can(member.role, "candidates.write")}
      />

      {isEmpty ? (
        <EmptyState
          icon={view === "done" ? CheckCircle2 : CalendarCheck}
          title={EMPTY[view].title}
          description={EMPTY[view].description}
        />
      ) : view === "no_next_action" && candidates ? (
        <NoNextActionList
          rows={candidates.rows}
          today={context.today}
          members={options.members}
          defaultResponsibleId={member.memberId}
          slaTarget={context.slaTargetDays}
        />
      ) : (
        <TaskList tasks={tasks} groupByDate={view === "upcoming"} {...itemProps} />
      )}
    </PageContainer>
  );
}
