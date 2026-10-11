import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

import type { CandidateListRow } from "../types";
import { ContactActions } from "./contact-actions";
import { NextTaskLabel } from "./next-task-label";
import { SlaChip } from "./sla-chip";

export function CandidateTable({
  rows,
  today,
  nowTime,
  slaTarget,
  timezone,
}: {
  rows: CandidateListRow[];
  today: string;
  nowTime: string;
  slaTarget: number | null;
  timezone: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Candidato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Região</TableHead>
            <TableHead>Gerente</TableHead>
            <TableHead>Próxima ação</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead className="pr-4 text-right">Contato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell className="max-w-64 pl-4">
                <Link href={`/candidatos/${candidate.id}`} className="block font-medium hover:text-primary hover:underline">
                  <span className="block truncate">{candidate.full_name}</span>
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {candidate.phone ? formatPhone(candidate.phone) : candidate.email}
                  {" · "}
                  {formatDateTime(candidate.created_at, timezone).slice(0, 10)}
                </span>
              </TableCell>
              <TableCell>
                {candidate.status ? <StatusBadge name={candidate.status.name} color={candidate.status.color} /> : null}
              </TableCell>
              <TableCell className="text-sm">{candidate.region?.name ?? "—"}</TableCell>
              <TableCell className="text-sm">{candidate.manager?.name ?? "—"}</TableCell>
              <TableCell className="max-w-56">
                <NextTaskLabel task={candidate.next_task ?? undefined} today={today} nowTime={nowTime} />
              </TableCell>
              <TableCell>
                <SlaChip days={candidate.sla_days} integrated={Boolean(candidate.integration_date)} target={slaTarget} />
              </TableCell>
              <TableCell className="pr-4">
                <ContactActions phone={candidate.phone} email={candidate.email} className="justify-end" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
