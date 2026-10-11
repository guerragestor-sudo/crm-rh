import { z } from "zod";

import { PRIORITY_OPTIONS, TASK_TYPES } from "./labels";

export const taskFormSchema = z.object({
  candidate_id: z.uuid({ error: "Selecione o candidato." }),
  type: z.enum(TASK_TYPES.map((type) => type.value) as [string, ...string[]], { error: "Selecione o tipo." }),
  title: z.string().trim().min(1, { error: "Informe o título." }).max(150, { error: "Máximo de 150 caracteres." }),
  description: z.string().trim().max(2000, { error: "Máximo de 2000 caracteres." }),
  due_date: z.iso.date({ error: "Informe a data." }),
  due_time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, { error: "Horário inválido." })]),
  responsible_member_id: z.uuid({ error: "Selecione o responsável." }),
  priority: z.enum(PRIORITY_OPTIONS.map((option) => option.value) as [string, ...string[]]),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskStatusSchema = z.enum(["pending", "done", "cancelled"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export function toTaskWrite(values: TaskFormValues) {
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim() || null,
    due_date: values.due_date,
    due_time: values.due_time || null,
    responsible_member_id: values.responsible_member_id,
    priority: values.priority,
  };
}
