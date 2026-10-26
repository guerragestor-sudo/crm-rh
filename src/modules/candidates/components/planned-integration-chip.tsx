import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** "27/10" a partir de "2026-10-27" */
function dayMonth(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/** Integração combinada e ainda não confirmada; vencida fica em destaque. */
export function PlannedIntegrationChip({ date, today, className }: { date: string; today: string; className?: string }) {
  const late = date < today;
  const label = date === today ? "Integra hoje" : late ? `Confirmar integração (${dayMonth(date)})` : `Integra em ${dayMonth(date)}`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        late || date === today ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-700",
        className,
      )}
    >
      <CalendarCheck className="size-3" aria-hidden />
      {label}
    </span>
  );
}
