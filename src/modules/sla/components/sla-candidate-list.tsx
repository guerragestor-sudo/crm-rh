import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { SlaChip } from "@/modules/candidates/components/sla-chip";
import type { CandidateListRow } from "@/modules/candidates/types";

export function SlaCandidateList({
  rows,
  timezone,
  slaTarget,
  emptyText,
}: {
  rows: CandidateListRow[];
  timezone: string;
  slaTarget: number | null;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y rounded-xl border bg-card shadow-xs">
      {rows.map((candidate) => (
        <li key={candidate.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/candidatos/${candidate.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
              {candidate.full_name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {candidate.status ? <StatusBadge name={candidate.status.name} color={candidate.status.color} /> : null}
              <span>Cadastro {formatDateTime(candidate.created_at, timezone).slice(0, 10)}</span>
              {candidate.integration_date ? <span>· Integração {formatDate(candidate.integration_date)}</span> : null}
              {candidate.manager ? <span>· {candidate.manager.name}</span> : null}
            </div>
          </div>
          <SlaChip days={candidate.sla_days} integrated={Boolean(candidate.integration_date)} target={slaTarget} />
        </li>
      ))}
    </ul>
  );
}
