"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorize } from "@/server/auth/session";
import { AppError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import { candidateFiltersSchema } from "./filters";
import { listCandidates } from "./queries";
import * as service from "./service";
import { SORT_OPTIONS, type CandidateListResult, type DuplicateMatch } from "./types";

const idSchema = z.uuid();

function parseId(id: unknown): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Candidato não encontrado.");
  return parsed.data;
}

function revalidateCandidate(id?: string) {
  revalidatePath("/candidatos");
  revalidatePath("/inicio");
  revalidatePath("/kanban");
  if (id) revalidatePath(`/candidatos/${id}`);
}

export async function createCandidateAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const member = await authorize("candidates.write");
    const supabase = await createClient();
    const result = await service.createCandidate(supabase, values, member.memberId);
    revalidateCandidate();
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCandidateAction(id: string, values: unknown): Promise<ActionResult> {
  try {
    await authorize("candidates.write");
    const candidateId = parseId(id);
    const supabase = await createClient();
    await service.updateCandidate(supabase, candidateId, values);
    revalidateCandidate(candidateId);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeStatusAction(id: string, statusId: string, reason?: string): Promise<ActionResult> {
  try {
    await authorize("candidates.write");
    const candidateId = parseId(id);
    const supabase = await createClient();
    await service.changeStatus(supabase, candidateId, parseId(statusId), reason);
    revalidateCandidate(candidateId);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function confirmIntegrationAction(id: string, date: string): Promise<ActionResult> {
  try {
    await authorize("candidates.write");
    const candidateId = parseId(id);
    const supabase = await createClient();
    await service.confirmIntegration(supabase, candidateId, date);
    revalidateCandidate(candidateId);
    revalidatePath("/agenda");
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeManagerAction(
  id: string,
  managerId: string | null,
  reason?: string,
): Promise<ActionResult> {
  try {
    await authorize("candidates.write");
    const candidateId = parseId(id);
    const supabase = await createClient();
    await service.changeManager(supabase, candidateId, managerId ? parseId(managerId) : null, reason);
    revalidateCandidate(candidateId);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await authorize("candidates.archive");
    const candidateId = parseId(id);
    const supabase = await createClient();
    await service.setArchived(supabase, candidateId, archived);
    revalidateCandidate(candidateId);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

const duplicatesSchema = z.object({
  cpf: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(200).optional(),
  excludeId: z.uuid().optional(),
});

export async function checkDuplicatesAction(input: unknown): Promise<ActionResult<DuplicateMatch[]>> {
  try {
    await authorize("candidates.read");
    const parsed = duplicatesSchema.parse(input);
    const supabase = await createClient();
    return ok(await service.findDuplicates(supabase, parsed));
  } catch (error) {
    return toActionError(error);
  }
}

const searchSchema = z.object({
  filters: candidateFiltersSchema,
  sort: z.enum(SORT_OPTIONS.map((option) => option.value) as [string, ...string[]]).default("recent"),
  page: z.number().int().min(1).max(10_000).default(1),
});

/** Busca via POST (o texto pode conter CPF/telefone e não deve ir para a URL). */
export async function searchCandidatesAction(input: unknown): Promise<ActionResult<CandidateListResult>> {
  try {
    await authorize("candidates.read");
    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION", "Filtros inválidos.");
    const { filters, sort, page } = parsed.data;
    return ok(await listCandidates({ filters, sort: sort as never, page }));
  } catch (error) {
    return toActionError(error);
  }
}
