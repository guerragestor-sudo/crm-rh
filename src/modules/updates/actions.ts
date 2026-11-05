"use server";

import { z } from "zod";

import { authorize } from "@/server/auth/session";
import { AppError, fromDatabaseError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

const seenSchema = z.number().int().min(1).max(1_000_000);

/** Marca como vistas as novidades até `releaseId` (nunca volta para trás). */
export async function markUpdatesSeenAction(releaseId: unknown): Promise<ActionResult<{ seen: number }>> {
  try {
    await authorize("candidates.read");
    const parsed = seenSchema.safeParse(releaseId);
    if (!parsed.success) throw new AppError("VALIDATION", "Novidade inválida.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_updates_seen", { p_seen: parsed.data });
    if (error) throw fromDatabaseError(error, { op: "mark_updates_seen" });
    return ok({ seen: data ?? parsed.data });
  } catch (error) {
    return toActionError(error);
  }
}
