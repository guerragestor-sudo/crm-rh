"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorize } from "@/server/auth/session";
import { AppError, fromDatabaseError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

import { ALLOWED_MIME_TYPES, MAX_DOCUMENT_BYTES } from "./constants";

const registerSchema = z.object({
  candidateId: z.uuid(),
  documentType: z.enum(["resume", "other"]),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().min(1).max(512),
  mimeType: z.string().refine((value) => value in ALLOWED_MIME_TYPES, { error: "Formato não aceito." }),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

/** Registra os metadados após o upload direto ao Storage (a RPC confere caminho e existência do objeto). */
export async function registerDocumentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const member = await authorize("documents.write");
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION", "Arquivo inválido.");
    const values = parsed.data;
    if (!values.storagePath.startsWith(`${member.organizationId}/${values.candidateId}/`)) {
      throw new AppError("FORBIDDEN", "Caminho de arquivo inválido.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("register_candidate_document", {
      p_candidate_id: values.candidateId,
      p_document_type: values.documentType,
      p_file_name: values.fileName,
      p_storage_path: values.storagePath,
      p_mime_type: values.mimeType,
      p_size_bytes: values.size,
    });
    if (error) throw fromDatabaseError(error, { op: "register_document" });

    revalidatePath(`/candidatos/${values.candidateId}`);
    return ok({ id: data as string });
  } catch (error) {
    return toActionError(error);
  }
}
