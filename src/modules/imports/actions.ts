"use server";

import { revalidatePath } from "next/cache";

import { authorize } from "@/server/auth/session";
import { ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import type { ExistingContacts } from "./schema";
import * as service from "./service";

function revalidateImport() {
  for (const path of ["/candidatos", "/candidatos/importar", "/inicio", "/kanban", "/agenda", "/sla", "/relatorios"]) {
    revalidatePath(path);
  }
}

/** Telefones/CPFs da prévia que já existem no CRM. */
export async function checkImportContactsAction(input: unknown): Promise<ActionResult<ExistingContacts>> {
  try {
    await authorize("candidates.write");
    const supabase = await createClient();
    return ok(await service.findExistingContacts(supabase, input));
  } catch (error) {
    return toActionError(error);
  }
}

export async function importCandidatesAction(input: unknown): Promise<ActionResult<{ importId: string; inserted: number }>> {
  try {
    const member = await authorize("candidates.write");
    const supabase = await createClient();
    const result = await service.importCandidates(supabase, member, input);
    revalidateImport();
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function undoImportAction(importId: string): Promise<ActionResult<{ deleted: number }>> {
  try {
    await authorize("candidates.write");
    const supabase = await createClient();
    const deleted = await service.undoImport(supabase, importId);
    revalidateImport();
    return ok({ deleted });
  } catch (error) {
    return toActionError(error);
  }
}
