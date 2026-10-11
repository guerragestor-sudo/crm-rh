import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  ListPlus,
  Pencil,
  RotateCcw,
  UserCheck,
  UserRoundCog,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

import { FIELD_LABELS, historyValueLabel } from "../labels";
import type { HistoryEntry } from "../types";

type Rendered = { icon: LucideIcon; tone: string; title: string; change?: { from: string | null; to: string | null } };

function display(entry: HistoryEntry, value: string | null) {
  if (value === null) return null;
  if (entry.field === "phone") return formatPhone(value);
  return historyValueLabel(entry.field, value);
}

function render(entry: HistoryEntry): Rendered {
  const from = display(entry, entry.old_value);
  const to = display(entry, entry.new_value);
  const field = FIELD_LABELS[entry.field ?? ""] ?? entry.field ?? "";

  switch (entry.action) {
    case "created":
      return { icon: CircleDot, tone: "text-primary", title: `Cadastrou o candidato${to ? ` (status ${to})` : ""}` };
    case "status_changed":
      return { icon: CircleDot, tone: "text-violet-600", title: "Alterou o status", change: { from, to } };
    case "manager_changed":
      return { icon: UserRoundCog, tone: "text-blue-600", title: "Alterou o gerente", change: { from: from ?? "Sem gerente", to: to ?? "Sem gerente" } };
    case "responsible_changed":
      return { icon: UserRoundCog, tone: "text-blue-600", title: "Alterou o responsável", change: { from, to } };
    case "interview_changed":
      if (!to) return { icon: CalendarClock, tone: "text-amber-600", title: `Removeu a entrevista de ${from}` };
      if (!from) return { icon: CalendarClock, tone: "text-amber-600", title: `Agendou entrevista para ${to}` };
      return { icon: CalendarClock, tone: "text-amber-600", title: "Reagendou a entrevista", change: { from, to } };
    case "integration_changed": {
      const sla = entry.metadata.sla_days_frozen;
      if (!to) return { icon: UserCheck, tone: "text-green-600", title: `Removeu a integração de ${from}` };
      return {
        icon: UserCheck,
        tone: "text-green-600",
        title: `Registrou integração em ${to}${typeof sla === "number" ? ` · SLA ${sla} ${sla === 1 ? "dia" : "dias"}` : ""}`,
        change: from ? { from, to } : undefined,
      };
    }
    case "archived":
      return { icon: Archive, tone: "text-muted-foreground", title: "Arquivou o candidato" };
    case "restored":
      return { icon: ArchiveRestore, tone: "text-muted-foreground", title: "Restaurou o candidato" };
    case "task_created":
      return { icon: ListPlus, tone: "text-primary", title: `Criou a tarefa “${to}”` };
    case "task_completed":
      return { icon: CheckCircle2, tone: "text-green-600", title: `Concluiu a tarefa “${to}”` };
    case "task_cancelled":
      return { icon: XCircle, tone: "text-muted-foreground", title: `Cancelou a tarefa “${to}”` };
    case "task_reopened":
      return { icon: RotateCcw, tone: "text-amber-600", title: `Reabriu a tarefa “${to}”` };
    case "task_rescheduled":
      return {
        icon: CalendarClock,
        tone: "text-amber-600",
        title: `Reagendou a tarefa “${String(entry.metadata.title ?? "")}”`,
        change: { from, to },
      };
    case "document_uploaded":
      return { icon: FilePlus2, tone: "text-primary", title: `Anexou o documento ${to}` };
    case "document_replaced":
      return { icon: FilePlus2, tone: "text-primary", title: `Substituiu o currículo por ${to}` };
    default:
      return {
        icon: Pencil,
        tone: "text-muted-foreground",
        title: `Alterou ${field.toLowerCase()}`,
        change: { from, to },
      };
  }
}

export function HistoryTimeline({ entries, timezone }: { entries: HistoryEntry[]; timezone: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
      {entries.map((entry) => {
        const { icon: Icon, tone, title, change } = render(entry);
        return (
          <li key={entry.id} className="relative flex gap-3">
            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className={`size-3.5 ${tone}`} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm">{title}</p>
              {change ? (
                <p className="mt-0.5 text-sm break-words">
                  <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                    {change.from ?? "vazio"}
                  </span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-medium">{change.to ?? "vazio"}</span>
                </p>
              ) : null}
              {entry.reason ? (
                <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Motivo: {entry.reason}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.actor_name ?? "Sistema"} · {formatDateTime(entry.created_at, timezone)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
