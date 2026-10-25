import { MapPin, UserRound } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";

import type { CandidateListRow } from "../types";
import { ContactActions } from "./contact-actions";
import { NextTaskLabel } from "./next-task-label";
import { SlaChip } from "./sla-chip";

export function CandidateCard({
  candidate,
  today,
  nowTime,
  slaTarget,
}: {
  candidate: CandidateListRow;
  today: string;
  nowTime: string;
  slaTarget: number | null;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs">
      <Link href={`/candidatos/${candidate.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-medium">{candidate.full_name}</h3>
          {candidate.status ? <StatusBadge name={candidate.status.name} color={candidate.status.color} /> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {candidate.region ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {candidate.region.name}
            </span>
          ) : null}
          {candidate.manager ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden />
              {candidate.manager.name}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <NextTaskLabel task={candidate.next_task ?? undefined} today={today} nowTime={nowTime} className="min-w-0" />
          <SlaChip days={candidate.sla_days} integrated={Boolean(candidate.integration_date)} target={slaTarget} />
        </div>
      </Link>
      <ContactActions phone={candidate.phone} email={candidate.email} className="mt-3 border-t pt-3" />
    </article>
  );
}
