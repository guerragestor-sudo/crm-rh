import "server-only";

import { z } from "zod";

import { onlyDigits } from "@/lib/cpf";
import { normalizePhone } from "@/lib/phone";
import { getAppContext } from "@/server/context";
import { AppError, fromDatabaseError } from "@/server/errors";
import type { SupabaseServerClient } from "@/server/supabase/server";
import { sessionInsert } from "@/server/supabase/types";

import { candidateFormSchema, reasonSchema, toCandidateWrite, type CandidateFormValues } from "./schema";
import type { DuplicateMatch } from "./types";

function parseForm(values: unknown): CandidateFormValues {
  const parsed = candidateFormSchema.safeParse(values);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Verifique os campos destacados.", z.flattenError(parsed.error).fieldErrors);
  }
  return parsed.data;
}

export async function findDuplicates(
  supabase: SupabaseServerClient,
  input: { cpf?: string; phone?: string; email?: string; excludeId?: string },
): Promise<DuplicateMatch[]> {
  const cpf = input.cpf ? onlyDigits(input.cpf) : "";
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email?.trim().toLowerCase() ?? "";
  if (cpf.length !== 11 && !phone && !email.includes("@")) return [];

  const { data, error } = await supabase.rpc("find_candidate_duplicates", {
    p_cpf: cpf.length === 11 ? cpf : undefined,
    p_phone: phone ?? undefined,
    p_email: email.includes("@") ? email : undefined,
    p_exclude_id: input.excludeId,
  });
  if (error) throw fromDatabaseError(error, { op: "find_duplicates" });
  return (data ?? []) as DuplicateMatch[];
}

async function assertCpfAvailable(supabase: SupabaseServerClient, cpf: string | null, excludeId?: string) {
  if (!cpf) return;
  const matches = await findDuplicates(supabase, { cpf, excludeId });
  const existing = matches.find((match) => match.match === "cpf");
  if (existing) {
    throw new AppError(
      "CONFLICT",
      `Já existe um candidato com este CPF: ${existing.full_name}.`,
      { cpf: ["CPF já cadastrado."] },
      { duplicateId: existing.id },
    );
  }
}

function mapWriteError(error: { code?: string; message?: string }, op: string): AppError {
  if (error.code === "23505") {
    return new AppError("CONFLICT", "Já existe um candidato com este CPF.", { cpf: ["CPF já cadastrado."] });
  }
  return fromDatabaseError(error, { op });
}

export async function createCandidate(
  supabase: SupabaseServerClient,
  input: unknown,
  responsibleMemberId: string,
): Promise<{ id: string }> {
  const values = parseForm(input);
  const { timezone } = await getAppContext();
  const write = toCandidateWrite(values, timezone);
  await assertCpfAvailable(supabase, write.cpf);

  const { data, error } = await supabase
    .from("candidates")
    .insert(
      sessionInsert<"candidates">({
        ...write,
        status_id: values.status_id,
        manager_id: values.manager_id || null,
        responsible_member_id: responsibleMemberId,
      }),
    )
    .select("id")
    .single();

  if (error) throw mapWriteError(error, "create_candidate");
  return { id: data.id };
}

export async function updateCandidate(
  supabase: SupabaseServerClient,
  id: string,
  input: unknown,
): Promise<void> {
  const values = parseForm(input);
  const { timezone } = await getAppContext();
  const write = toCandidateWrite(values, timezone);

  const { data: current, error: currentError } = await supabase
    .from("candidates")
    .select("id, status_id, manager_id, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (currentError) throw fromDatabaseError(currentError, { op: "load_candidate" });
  if (!current) throw new AppError("NOT_FOUND", "Candidato não encontrado.");
  if (current.archived_at) throw new AppError("VALIDATION", "Candidato arquivado não pode ser editado.");

  await assertCpfAvailable(supabase, write.cpf, id);

  const { error } = await supabase.from("candidates").update(write).eq("id", id);
  if (error) throw mapWriteError(error, "update_candidate");

  if (values.status_id !== current.status_id) {
    await changeStatus(supabase, id, values.status_id, values.status_reason);
  }
  const managerId = values.manager_id || null;
  if (managerId !== current.manager_id) {
    await changeManager(supabase, id, managerId, values.manager_reason);
  }
}

export async function changeStatus(
  supabase: SupabaseServerClient,
  candidateId: string,
  statusId: string,
  reason?: string,
): Promise<void> {
  const parsedReason = reasonSchema.parse(reason ?? "");
  const { error } = await supabase.rpc("change_candidate_status", {
    p_candidate_id: candidateId,
    p_status_id: statusId,
    p_reason: parsedReason || undefined,
  });
  if (error) throw fromDatabaseError(error, { op: "change_status" });
}

export async function changeManager(
  supabase: SupabaseServerClient,
  candidateId: string,
  managerId: string | null,
  reason?: string,
): Promise<void> {
  const parsedReason = reasonSchema.parse(reason ?? "");
  const { error } = await supabase.rpc("change_candidate_manager", {
    p_candidate_id: candidateId,
    // null remove o gerente; o wrapper SQL aceita null.
    p_manager_id: managerId as string,
    p_reason: parsedReason || undefined,
  });
  if (error) throw fromDatabaseError(error, { op: "change_manager" });
}

export async function setArchived(supabase: SupabaseServerClient, candidateId: string, archived: boolean) {
  const { error } = await supabase.rpc(archived ? "archive_candidate" : "restore_candidate", {
    p_candidate_id: candidateId,
  });
  if (error) throw fromDatabaseError(error, { op: archived ? "archive_candidate" : "restore_candidate" });
}
