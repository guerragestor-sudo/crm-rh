import { Plus } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ContactActions } from "@/modules/candidates/components/contact-actions";
import { SlaChip } from "@/modules/candidates/components/sla-chip";
import type { CandidateListRow, MemberOption } from "@/modules/candidates/types";

import { TaskDialog } from "./task-dialog";

export function NoNextActionList({
  rows,
  today,
  members,
  defaultResponsibleId,
  slaTarget,
}: {
  rows: CandidateListRow[];
  today: string;
  members: MemberOption[];
  defaultResponsibleId: string;
  slaTarget: number | null;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((candidate) => (
        <li key={candidate.id} className="rounded-xl border bg-card p-3 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/candidatos/${candidate.id}`} className="font-medium hover:text-primary hover:underline">
                {candidate.full_name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {candidate.status ? <StatusBadge name={candidate.status.name} color={candidate.status.color} /> : null}
                <span>Nenhuma tarefa pendente</span>
              </div>
            </div>
            <SlaChip days={candidate.sla_days} integrated={Boolean(candidate.integration_date)} target={slaTarget} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <ContactActions phone={candidate.phone} email={candidate.email} />
            <TaskDialog
              today={today}
              members={members}
              defaultResponsibleId={defaultResponsibleId}
              candidate={{ id: candidate.id, full_name: candidate.full_name }}
              trigger={
                <Button className="h-9">
                  <Plus aria-hidden />
                  Criar tarefa
                </Button>
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
