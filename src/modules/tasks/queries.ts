import "server-only";

import { listCandidates } from "@/modules/candidates/queries";
import type { AppContext } from "@/server/context";
import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import type { AgendaView } from "./labels";
import type { TaskRow } from "./types";

const TASK_SELECT = `
  id, candidate_id, type, title, description, due_date, due_time, priority, status, completed_at, responsible_member_id,
  candidate:candidates!inner(id, full_name, phone, archived_at),
  responsible:organization_members!tasks_organization_id_responsible_member_id_fkey(profiles(full_name))
`;

const AGENDA_LIMIT = 200;

/** Datas e horas vêm do contexto da organização (fuso), nunca do relógio do servidor. */
function overdueFilter(context: AppContext) {
  return `due_date.lt.${context.today},and(due_date.eq.${context.today},due_time.lt.${context.nowTime})`;
}

export async function getAgendaTasks(view: Exclude<AgendaView, "no_next_action">, context: AppContext) {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_SELECT).is("candidate.archived_at", null);

  switch (view) {
    case "overdue":
      query = query
        .eq("status", "pending")
        .or(overdueFilter(context))
        .order("due_date")
        .order("due_time", { nullsFirst: true });
      break;
    case "today":
      query = query.eq("status", "pending").eq("due_date", context.today).order("due_time", { nullsFirst: false });
      break;
    case "upcoming":
      query = query
        .eq("status", "pending")
        .gt("due_date", context.today)
        .order("due_date")
        .order("due_time", { nullsFirst: false });
      break;
    case "done":
      query = query.eq("status", "done").order("completed_at", { ascending: false });
      break;
  }

  const { data, error } = await query.limit(AGENDA_LIMIT);
  if (error) throw fromDatabaseError(error, { op: `agenda_${view}` });
  return (data ?? []) as unknown as TaskRow[];
}

export async function getAgendaCounts(context: AppContext) {
  const supabase = await createClient();
  const base = () =>
    supabase
      .from("tasks")
      .select("id, candidate:candidates!inner(archived_at)", { count: "exact", head: true })
      .is("candidate.archived_at", null)
      .eq("status", "pending");

  const [overdue, today, upcoming, noNextAction] = await Promise.all([
    base().or(overdueFilter(context)),
    base().eq("due_date", context.today),
    base().gt("due_date", context.today),
    supabase.rpc("filter_candidates", { p_filters: { no_next_action: true } }, { count: "exact", head: true }),
  ]);

  for (const result of [overdue, today, upcoming, noNextAction]) {
    if (result.error) throw fromDatabaseError(result.error, { op: "agenda_counts" });
  }

  return {
    overdue: overdue.count ?? 0,
    today: today.count ?? 0,
    upcoming: upcoming.count ?? 0,
    no_next_action: noNextAction.count ?? 0,
  };
}

export async function getNoNextActionCandidates() {
  return listCandidates({ filters: { no_next_action: true }, sort: "oldest", pageSize: AGENDA_LIMIT });
}

export async function getCandidateTasks(candidateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("candidate_id", candidateId)
    .order("status", { ascending: false })
    .order("due_date")
    .order("due_time", { nullsFirst: false })
    .limit(200);
  if (error) throw fromDatabaseError(error, { op: "candidate_tasks" });
  return (data ?? []) as unknown as TaskRow[];
}
