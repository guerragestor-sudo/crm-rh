import { ArrowLeft, CalendarClock, ListTodo, Pencil, FileText, Plus, Timer, UserCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, formatDays } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ArchiveButton } from "@/modules/candidates/components/archive-button";
import { CandidateDetails } from "@/modules/candidates/components/candidate-details";
import { ChangeManagerDialog } from "@/modules/candidates/components/change-manager-dialog";
import { ChangeStatusDialog } from "@/modules/candidates/components/change-status-dialog";
import { ContactActions } from "@/modules/candidates/components/contact-actions";
import { HistoryTimeline } from "@/modules/candidates/components/history-timeline";
import { getCandidate, getCandidateHistory, getCandidateOptions } from "@/modules/candidates/queries";
import { DocumentList } from "@/modules/documents/components/document-list";
import { DocumentUpload } from "@/modules/documents/components/document-upload";
import { getCandidateDocuments } from "@/modules/documents/queries";
import { NextTaskLabel } from "@/modules/candidates/components/next-task-label";
import { TaskDialog } from "@/modules/tasks/components/task-dialog";
import { TaskList } from "@/modules/tasks/components/task-list";
import { getCandidateTasks } from "@/modules/tasks/queries";
import { requireMember } from "@/server/auth/session";
import { getAppContext } from "@/server/context";

export const metadata: Metadata = { title: "Candidato" };

function SummaryItem({
  icon: Icon,
  label,
  children,
  action,
}: {
  icon: typeof Timer;
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </p>
        <div className="mt-1 truncate text-sm font-medium">{children}</div>
      </div>
      {action}
    </div>
  );
}

export default async function CandidatePage({ params }: PageProps<"/candidatos/[id]">) {
  const member = await requireMember();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [candidate, history, options, context, documents, tasks] = await Promise.all([
    getCandidate(id),
    getCandidateHistory(id),
    getCandidateOptions(),
    getAppContext(),
    getCandidateDocuments(id),
    getCandidateTasks(id),
  ]);
  if (!candidate) notFound();

  const archived = Boolean(candidate.archived_at);
  const canWrite = can(member.role, "candidates.write") && !archived;
  const responsible = options.members.find((item) => item.id === candidate.responsible_member_id);
  const currentResume = documents.find((document) => document.document_type === "resume" && document.is_current);
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const nextTask = pendingTasks[0];
  const canTask = can(member.role, "tasks.write") && !archived;
  const newTaskButton = (label: string, className?: string) => (
    <TaskDialog
      today={context.today}
      members={options.members}
      defaultResponsibleId={member.memberId}
      candidate={{ id: candidate.id, full_name: candidate.full_name }}
      trigger={
        <Button variant="secondary" size="sm" className={className ?? "h-9 w-full"}>
          <Plus aria-hidden />
          {label}
        </Button>
      }
    />
  );

  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/candidatos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Candidatos
      </Link>

      {archived ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>Candidato arquivado em {formatDateTime(candidate.archived_at, context.timezone)}. Somente leitura.</span>
          {can(member.role, "candidates.archive") ? <ArchiveButton candidateId={candidate.id} archived /> : null}
        </div>
      ) : null}

      <header className="space-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{candidate.full_name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {candidate.status ? <StatusBadge name={candidate.status.name} color={candidate.status.color} /> : null}
              <span>Cadastrado em {formatDateTime(candidate.created_at, context.timezone).slice(0, 10)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {canWrite ? (
              <Button asChild variant="outline" className="h-10">
                <Link href={`/candidatos/${candidate.id}/editar`}>
                  <Pencil aria-hidden />
                  Editar
                </Link>
              </Button>
            ) : null}
            {!archived && can(member.role, "candidates.archive") ? (
              <ArchiveButton candidateId={candidate.id} archived={false} />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.phone || candidate.email ? (
            <ContactActions phone={candidate.phone} email={candidate.email} size="lg" showLabels className="flex-wrap" />
          ) : null}
          {currentResume ? (
            <Button asChild variant="outline" className="h-11">
              <a href={`/api/documentos/${currentResume.id}`} target="_blank" rel="noopener noreferrer">
                <FileText aria-hidden />
                Currículo
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        <SummaryItem
          icon={UserRound}
          label="Status"
          action={
            canWrite ? (
              <ChangeStatusDialog
                candidateId={candidate.id}
                currentStatusId={candidate.status_id}
                statuses={options.statuses}
                trigger={
                  <Button variant="secondary" size="sm" className="h-9 w-full">
                    Alterar status
                  </Button>
                }
              />
            ) : null
          }
        >
          {candidate.status?.name}
        </SummaryItem>
        <SummaryItem
          icon={UserRound}
          label="Gerente"
          action={
            canWrite ? (
              <ChangeManagerDialog
                candidateId={candidate.id}
                currentManagerId={candidate.manager_id}
                managers={options.managers}
                trigger={
                  <Button variant="secondary" size="sm" className="h-9 w-full">
                    Alterar gerente
                  </Button>
                }
              />
            ) : null
          }
        >
          {candidate.manager?.name ?? <span className="text-muted-foreground">Sem gerente</span>}
        </SummaryItem>
        <SummaryItem icon={Timer} label={candidate.integration_date ? "SLA (concluído)" : "Tempo na operação"}>
          {formatDays(candidate.sla_days)}
        </SummaryItem>
        <SummaryItem icon={CalendarClock} label="Entrevista">
          {candidate.interview_at ? (
            formatDateTime(candidate.interview_at, context.timezone)
          ) : (
            <span className="text-muted-foreground">Não agendada</span>
          )}
        </SummaryItem>
        <SummaryItem icon={ListTodo} label="Próxima tarefa" action={canTask ? newTaskButton("Nova tarefa") : null}>
          <NextTaskLabel
            task={nextTask ? { ...nextTask, due_time: nextTask.due_time } : undefined}
            today={context.today}
            nowTime={context.nowTime}
            className="text-sm"
          />
        </SummaryItem>
        <SummaryItem icon={UserCheck} label="Integração">
          {candidate.integration_date ? (
            formatDate(candidate.integration_date)
          ) : (
            <span className="text-muted-foreground">Aguardando</span>
          )}
        </SummaryItem>
      </section>

      <Tabs defaultValue="details" className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
          <TabsTrigger value="details">
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tarefas ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documentos ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Histórico ({history.length})
          </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details">
          <CandidateDetails candidate={candidate} responsibleName={responsible?.name ?? null} timezone={context.timezone} />
        </TabsContent>
        <TabsContent value="tasks" className="space-y-3">
          {canTask ? <div className="flex justify-end">{newTaskButton("Nova tarefa", "h-10")}</div> : null}
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma tarefa. Agende o próximo contato.
            </p>
          ) : (
            <TaskList
              tasks={tasks}
              today={context.today}
              nowTime={context.nowTime}
              timezone={context.timezone}
              members={options.members}
              defaultResponsibleId={member.memberId}
              showCandidate={false}
            />
          )}
        </TabsContent>
        <TabsContent value="documents" className="space-y-3">
          {canWrite && can(member.role, "documents.write") ? (
            <DocumentUpload
              organizationId={member.organizationId}
              candidateId={candidate.id}
              hasResume={Boolean(currentResume)}
            />
          ) : null}
          <DocumentList documents={documents} timezone={context.timezone} />
        </TabsContent>
        <TabsContent value="history">
          <div className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <HistoryTimeline entries={history} timezone={context.timezone} />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
