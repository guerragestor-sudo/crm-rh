"use client";

import { addDays, format, parseISO } from "date-fns";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { FormField, inputClass } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchCandidatesAction } from "@/modules/candidates/actions";
import type { MemberOption } from "@/modules/candidates/types";

import { createTaskAction, updateTaskAction } from "../actions";
import { PRIORITY_OPTIONS, suggestedTitle, TASK_TYPES, type TaskPriority, type TaskType } from "../labels";
import { taskFormSchema, type TaskFormValues } from "../schema";
import type { TaskRow } from "../types";

type CandidateRef = { id: string; full_name: string };

function quickDates(today: string) {
  const base = parseISO(today);
  const iso = (days: number) => format(addDays(base, days), "yyyy-MM-dd");
  return [
    { label: "Hoje", value: iso(0) },
    { label: "Amanhã", value: iso(1) },
    { label: "Em 3 dias", value: iso(3) },
    { label: "Em 7 dias", value: iso(7) },
  ];
}

function CandidatePicker({ value, onChange }: { value: CandidateRef | null; onChange: (value: CandidateRef) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateRef[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        const response = await searchCandidatesAction({ filters: { q: term }, sort: "name", page: 1 });
        if (response.ok) setResults(response.data.rows.slice(0, 8).map((row) => ({ id: row.id, full_name: row.full_name })));
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="truncate font-medium">{value.full_name}</span>
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Buscar candidato"
          placeholder={value ? "Trocar candidato…" : "Buscar candidato por nome ou telefone"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(inputClass, "pl-9")}
        />
        {searching ? <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      {query.trim().length >= 2 && results.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-lg border">
          {results.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className="flex h-11 w-full items-center px-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(candidate);
                  setQuery("");
                  setResults([]);
                }}
              >
                {candidate.full_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TaskDialog({
  trigger,
  today,
  members,
  defaultResponsibleId,
  candidate: fixedCandidate,
  task,
  onSaved,
}: {
  trigger: ReactNode;
  today: string;
  members: MemberOption[];
  defaultResponsibleId: string;
  candidate?: CandidateRef;
  task?: TaskRow;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [candidate, setCandidate] = useState<CandidateRef | null>(fixedCandidate ?? null);
  const [titleTouched, setTitleTouched] = useState(Boolean(task));

  const initial = (): TaskFormValues => ({
    candidate_id: task?.candidate_id ?? fixedCandidate?.id ?? "",
    type: task?.type ?? "call",
    title: task?.title ?? suggestedTitle("call", fixedCandidate?.full_name),
    description: task?.description ?? "",
    due_date: task?.due_date ?? today,
    due_time: task?.due_time?.slice(0, 5) ?? "",
    responsible_member_id: task?.responsible_member_id ?? defaultResponsibleId,
    priority: task?.priority ?? "normal",
  });
  const [values, setValues] = useState<TaskFormValues>(initial);

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function chooseType(type: TaskType) {
    setValues((current) => ({
      ...current,
      type,
      title: titleTouched ? current.title : suggestedTitle(type, candidate?.full_name),
    }));
  }

  function submit() {
    const payload = { ...values, candidate_id: candidate?.id ?? "" };
    const parsed = taskFormSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    startTransition(async () => {
      const response = task ? await updateTaskAction(task.id, parsed.data) : await createTaskAction(parsed.data);
      if (!response.ok) {
        setErrors(response.error.fieldErrors ?? {});
        toast.error(response.error.message);
        return;
      }
      toast.success(task ? "Tarefa atualizada." : "Tarefa criada.");
      setOpen(false);
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCandidate(fixedCandidate ?? (task?.candidate ? { id: task.candidate.id, full_name: task.candidate.full_name } : null));
          setValues(initial());
          setTitleTouched(Boolean(task));
          setErrors({});
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            {fixedCandidate ? fixedCandidate.full_name : "A data é livre: escolha quando fazer o próximo contato."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!fixedCandidate && !task ? (
            <FormField id="task-candidate" label="Candidato" required error={errors.candidate_id?.[0]}>
              <CandidatePicker value={candidate} onChange={setCandidate} />
            </FormField>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {TASK_TYPES.map((type) => {
                const Icon = type.icon;
                const active = values.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseType(type.value)}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-xs leading-tight",
                      active ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <FormField id="task-title" label="Título" required error={errors.title?.[0]}>
            <Input
              id="task-title"
              value={values.title}
              maxLength={150}
              className={inputClass}
              onChange={(event) => {
                setTitleTouched(true);
                set("title", event.target.value);
              }}
            />
          </FormField>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quando</legend>
            <div className="flex flex-wrap gap-1.5">
              {quickDates(today).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={values.due_date === option.value}
                  onClick={() => set("due_date", option.value)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-sm",
                    values.due_date === option.value ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField id="task-date" label="Data" error={errors.due_date?.[0]}>
                <Input
                  id="task-date"
                  type="date"
                  value={values.due_date}
                  className={inputClass}
                  onChange={(event) => set("due_date", event.target.value)}
                />
              </FormField>
              <FormField id="task-time" label="Horário (opcional)" error={errors.due_time?.[0]}>
                <Input
                  id="task-time"
                  type="time"
                  value={values.due_time}
                  className={inputClass}
                  onChange={(event) => set("due_time", event.target.value)}
                />
              </FormField>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Prioridade</span>
            <Segmented
              name="task-priority"
              ariaLabel="Prioridade"
              value={values.priority as TaskPriority}
              onChange={(value) => set("priority", value)}
              options={PRIORITY_OPTIONS}
            />
          </div>

          {members.length > 1 ? (
            <FormField id="task-responsible" label="Responsável" error={errors.responsible_member_id?.[0]}>
              <NativeSelect
                id="task-responsible"
                value={values.responsible_member_id}
                onChange={(event) => set("responsible_member_id", event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}

          <FormField id="task-description" label="Descrição (opcional)" error={errors.description?.[0]}>
            <Textarea
              id="task-description"
              rows={3}
              maxLength={2000}
              value={values.description}
              className="text-base md:text-sm"
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {task ? "Salvar" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
