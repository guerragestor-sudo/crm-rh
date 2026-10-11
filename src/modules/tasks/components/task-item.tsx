"use client";

import { Check, Circle, MoreVertical, Pencil, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, formatTime, relativeDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContactActions } from "@/modules/candidates/components/contact-actions";
import { isOverdue } from "@/modules/candidates/components/next-task-label";
import type { MemberOption } from "@/modules/candidates/types";

import { setTaskStatusAction } from "../actions";
import { TASK_TYPE_MAP, type TaskType } from "../labels";
import type { TaskStatus } from "../schema";
import type { TaskRow } from "../types";
import { TaskDialog } from "./task-dialog";

export function TaskItem({
  task,
  today,
  nowTime,
  timezone,
  members,
  defaultResponsibleId,
  showCandidate = true,
}: {
  task: TaskRow;
  today: string;
  nowTime: string;
  timezone: string;
  members: MemberOption[];
  defaultResponsibleId: string;
  showCandidate?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [pending, startTransition] = useTransition();
  const type = TASK_TYPE_MAP[task.type as TaskType] ?? TASK_TYPE_MAP.custom;
  const Icon = type.icon;
  const overdue = status === "pending" && isOverdue(task, today, nowTime);
  const done = status === "done";
  const cancelled = status === "cancelled";

  function change(next: TaskStatus, message: string) {
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const response = await setTaskStatusAction(task.id, next);
      if (!response.ok) {
        setStatus(previous);
        toast.error(response.error.message);
        return;
      }
      toast.success(message, {
        action:
          next === "done"
            ? {
                label: "Desfazer",
                onClick: () => {
                  void setTaskStatusAction(task.id, "pending").then(() => router.refresh());
                  setStatus("pending");
                },
              }
            : undefined,
      });
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs",
        overdue && "border-red-200 bg-red-50/50",
        (done || cancelled) && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => change(done ? "pending" : "done", done ? "Tarefa reaberta." : "Tarefa concluída.")}
        disabled={pending || cancelled}
        aria-label={done ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-green-600 bg-green-600 text-white" : overdue ? "border-red-400 hover:bg-red-100" : "border-muted-foreground/40 hover:bg-muted",
        )}
      >
        {done ? <Check className="size-4" aria-hidden /> : <Circle className="size-3 opacity-0" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", (done || cancelled) && "line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3.5" aria-hidden />
            {type.label}
          </span>
          <span className={cn(overdue && "font-semibold text-red-600")}>
            {overdue ? "Atrasada · " : ""}
            {relativeDayLabel(task.due_date, today)}
            {task.due_time ? ` ${formatTime(task.due_time)}` : ""}
          </span>
          {task.priority === "high" ? <span className="font-medium text-amber-700">Prioridade alta</span> : null}
          {cancelled ? <span>Cancelada</span> : null}
          {done && task.completed_at ? <span>Concluída {formatDateTime(task.completed_at, timezone)}</span> : null}
        </div>
        {showCandidate && task.candidate ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/candidatos/${task.candidate.id}`} className="truncate text-sm text-primary hover:underline">
              {task.candidate.full_name}
            </Link>
            {status === "pending" ? <ContactActions phone={task.candidate.phone} className="gap-1.5" /> : null}
          </div>
        ) : null}
        {task.description ? (
          <p className="mt-1.5 text-xs whitespace-pre-line text-muted-foreground">{task.description}</p>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações da tarefa ${task.title}`} disabled={pending}>
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {status === "pending" ? (
            <TaskDialog
              task={task}
              today={today}
              members={members}
              defaultResponsibleId={defaultResponsibleId}
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="h-10">
                  <Pencil aria-hidden />
                  Editar / reagendar
                </DropdownMenuItem>
              }
            />
          ) : null}
          {status === "pending" ? (
            <DropdownMenuItem className="h-10" onSelect={() => change("cancelled", "Tarefa cancelada.")}>
              <XCircle aria-hidden />
              Cancelar tarefa
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="h-10" onSelect={() => change("pending", "Tarefa reaberta.")}>
              <RotateCcw aria-hidden />
              Reabrir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
