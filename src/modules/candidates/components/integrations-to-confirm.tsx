import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

import type { IntegrationToConfirm } from "../queries";
import { ConfirmIntegrationDialog } from "./confirm-integration-dialog";
import { PlannedIntegrationChip } from "./planned-integration-chip";

/** Agenda (Hoje): integrações combinadas que chegaram e ainda não foram confirmadas. */
export function IntegrationsToConfirm({
  rows,
  today,
  canWrite,
}: {
  rows: IntegrationToConfirm[];
  today: string;
  canWrite: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="integrations-to-confirm" className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <h2 id="integrations-to-confirm" className="text-sm font-semibold">
        Integrações para confirmar ({rows.length})
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Combinadas para hoje ou antes. Confirme o dia em que cada candidato começou.
      </p>
      <ul className="mt-2 divide-y divide-amber-200/70">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <Link href={`/candidatos/${row.id}`} className="font-medium hover:text-primary hover:underline">
                {row.full_name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PlannedIntegrationChip date={row.integration_planned_date} today={today} />
                {row.status ? <StatusBadge name={row.status.name} color={row.status.color} /> : null}
                {row.manager ? <span>{row.manager.name}</span> : null}
              </div>
            </div>
            {canWrite ? (
              <ConfirmIntegrationDialog
                candidateId={row.id}
                candidateName={row.full_name}
                plannedDate={row.integration_planned_date}
                today={today}
                trigger={
                  <Button size="sm" className="h-9 shrink-0" aria-label={`Confirmar integração de ${row.full_name}`}>
                    Confirmar
                  </Button>
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
