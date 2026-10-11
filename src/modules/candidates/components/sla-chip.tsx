import { Timer } from "lucide-react";

import { formatDays } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tempo na operação: congelado (verde) quando integrado; em andamento caso contrário. */
export function SlaChip({
  days,
  integrated,
  target,
  className,
}: {
  days: number;
  integrated: boolean;
  target?: number | null;
  className?: string;
}) {
  const above = target != null && days > target;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        integrated ? "bg-green-50 text-green-700" : above ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground",
        className,
      )}
      title={integrated ? "SLA concluído (integrado)" : "Tempo na operação"}
    >
      <Timer className="size-3" aria-hidden />
      {formatDays(days)}
    </span>
  );
}
