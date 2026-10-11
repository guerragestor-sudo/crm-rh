import { AlertCircle, CalendarClock, CircleDashed } from "lucide-react";

import { formatTime, relativeDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { NextTask } from "../types";

export function isOverdue(task: Pick<NextTask, "due_date" | "due_time">, today: string, nowTime: string) {
  if (task.due_date < today) return true;
  return task.due_date === today && task.due_time !== null && task.due_time < nowTime;
}

/** Próxima tarefa do candidato; atrasada em destaque; ou "Sem próxima ação". */
export function NextTaskLabel({
  task,
  today,
  nowTime,
  className,
}: {
  task: NextTask | undefined;
  today: string;
  nowTime: string;
  className?: string;
}) {
  if (!task) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-amber-700", className)}>
        <CircleDashed className="size-3.5" aria-hidden />
        Sem próxima ação
      </span>
    );
  }

  const overdue = isOverdue(task, today, nowTime);
  const when = `${relativeDayLabel(task.due_date, today)}${task.due_time ? ` ${formatTime(task.due_time)}` : ""}`;
  const Icon = overdue ? AlertCircle : CalendarClock;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-xs",
        overdue ? "font-medium text-red-600" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">
        {overdue ? "Atrasada · " : ""}
        {task.title} · {when}
      </span>
    </span>
  );
}
