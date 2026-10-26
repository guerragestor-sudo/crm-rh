"use client";

import { MapPin, MoreHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ContactActions } from "@/modules/candidates/components/contact-actions";
import { PlannedIntegrationChip } from "@/modules/candidates/components/planned-integration-chip";
import { isOverdue, NextTaskLabel } from "@/modules/candidates/components/next-task-label";
import { SlaChip } from "@/modules/candidates/components/sla-chip";
import type { CandidateListRow } from "@/modules/candidates/types";
import { cn } from "@/lib/utils";

export function KanbanCard({
  candidate,
  today,
  nowTime,
  slaTarget,
  moveMenu,
  dragging,
}: {
  candidate: CandidateListRow;
  today: string;
  nowTime: string;
  slaTarget: number | null;
  moveMenu?: ReactNode;
  dragging?: boolean;
}) {
  const overdue = candidate.next_task ? isOverdue(candidate.next_task, today, nowTime) : false;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs",
        overdue && "border-l-4 border-l-red-500",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/candidatos/${candidate.id}`}
          className="min-w-0 font-medium leading-snug hover:text-primary hover:underline"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {candidate.full_name}
        </Link>
        {moveMenu ?? <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          {candidate.region?.name ?? "Sem região"}
        </span>
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" aria-hidden />
          {candidate.manager?.name ?? "Sem gerente"}
        </span>
        {!candidate.integration_date && candidate.integration_planned_date ? (
          <PlannedIntegrationChip date={candidate.integration_planned_date} today={today} />
        ) : null}
      </div>
      <NextTaskLabel task={candidate.next_task ?? undefined} today={today} nowTime={nowTime} className="mt-2 flex" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <SlaChip days={candidate.sla_days} integrated={Boolean(candidate.integration_date)} target={slaTarget} />
        <div onPointerDown={(event) => event.stopPropagation()}>
          <ContactActions phone={candidate.phone} email={null} className="gap-1 [&_a]:h-8 [&_a]:w-8" />
        </div>
      </div>
    </article>
  );
}
