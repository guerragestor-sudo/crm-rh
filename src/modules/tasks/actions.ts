"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorize } from "@/server/auth/session";
import { AppError, fromDatabaseError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";
import { sessionInsert } from "@/server/supabase/types";

import { taskFormSchema, taskStatusSchema, toTaskWrite, type TaskStatus } from "./schema";

function parseTask(input: unknown) {
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Verifique os campos da tarefa.", z.flattenError(parsed.error).fieldErrors);
  }
  return parsed.data;
}

function revalidateTasks(candidateId?: string) {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/candidatos");
  revalidatePath("/kanban");
  if (candidateId) revalidatePath(`/candidatos/${candidateId}`);
}

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await authorize("tasks.write");
    const values = parseTask(input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert(sessionInsert<"tasks">({ candidate_id: values.candidate_id, ...toTaskWrite(values) }))
      .select("id")
      .single();
    if (error) throw fromDatabaseError(error, { op: "create_task" });
    revalidateTasks(values.candidate_id);
    return ok({ id: data.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTaskAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    await authorize("tasks.write");
    const taskId = z.uuid().parse(id);
    const values = parseTask(input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("tasks").update(toTaskWrite(values)).eq("id", taskId).select("id");
    if (error) throw fromDatabaseError(error, { op: "update_task" });
    if (!data?.length) throw new AppError("NOT_FOUND", "Tarefa não encontrada.");
    revalidateTasks(values.candidate_id);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setTaskStatusAction(id: string, status: TaskStatus): Promise<ActionResult> {
  try {
    await authorize("tasks.write");
    const taskId = z.uuid().parse(id);
    const nextStatus = taskStatusSchema.parse(status);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", taskId)
      .select("candidate_id");
    if (error) throw fromDatabaseError(error, { op: "set_task_status" });
    if (!data?.length) throw new AppError("NOT_FOUND", "Tarefa não encontrada.");
    revalidateTasks(data[0].candidate_id);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
