"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { authorize } from "@/server/auth/session";
import { AppError, fromDatabaseError, ok, toActionError, type ActionResult } from "@/server/errors";
import { createClient } from "@/server/supabase/server";
import { sessionInsert } from "@/server/supabase/types";

import {
  LOOKUP_KINDS,
  lookupSchema,
  managerSchema,
  organizationSettingsSchema,
  statusSchema,
  type LookupKind,
} from "./schema";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Verifique os dados informados.", z.flattenError(parsed.error).fieldErrors);
  }
  return parsed.data;
}

function duplicateName(error: { code?: string }) {
  return error.code === "23505" ? new AppError("CONFLICT", "Já existe um item com esse nome.") : null;
}

function revalidateAll() {
  revalidatePath("/configuracoes");
  revalidatePath("/candidatos");
  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function saveLookupAction(kind: LookupKind, input: unknown): Promise<ActionResult> {
  try {
    await authorize("settings.manage");
    if (!LOOKUP_KINDS.includes(kind)) throw new AppError("VALIDATION", "Cadastro inválido.");
    const values = parse(lookupSchema, input);
    const supabase = await createClient();

    if (values.id) {
      const { error } = await supabase
        .from(kind)
        .update({ name: values.name, is_active: values.is_active })
        .eq("id", values.id);
      if (error) throw duplicateName(error) ?? fromDatabaseError(error, { op: `update_${kind}` });
    } else {
      const { data: last } = await supabase
        .from(kind)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from(kind).insert(
        sessionInsert<LookupKind>({
          name: values.name,
          is_active: values.is_active,
          sort_order: (last?.sort_order ?? -1) + 1,
        }),
      );
      if (error) throw duplicateName(error) ?? fromDatabaseError(error, { op: `insert_${kind}` });
    }
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveStatusAction(input: unknown): Promise<ActionResult> {
  try {
    await authorize("settings.manage");
    const values = parse(statusSchema, input);
    const supabase = await createClient();

    if (values.id) {
      const { error } = await supabase
        .from("candidate_statuses")
        .update({ name: values.name, color: values.color, is_active: values.is_active })
        .eq("id", values.id);
      if (error) throw duplicateName(error) ?? fromDatabaseError(error, { op: "update_status" });
    } else {
      const { data: last } = await supabase
        .from("candidate_statuses")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("candidate_statuses").insert(
        sessionInsert<"candidate_statuses">({
          name: values.name,
          color: values.color,
          is_active: values.is_active,
          position: (last?.position ?? -1) + 1,
        }),
      );
      if (error) throw duplicateName(error) ?? fromDatabaseError(error, { op: "insert_status" });
    }
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function swapStatusesAction(first: string, second: string): Promise<ActionResult> {
  try {
    await authorize("settings.manage");
    const ids = z.tuple([z.uuid(), z.uuid()]).parse([first, second]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("swap_status_positions", { p_first: ids[0], p_second: ids[1] });
    if (error) throw fromDatabaseError(error, { op: "swap_status_positions" });
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveManagerAction(input: unknown): Promise<ActionResult> {
  try {
    await authorize("settings.manage");
    const values = parse(managerSchema, input);
    const phone = values.phone ? normalizePhone(values.phone) : null;
    if (values.phone && !phone) {
      throw new AppError("VALIDATION", "Telefone inválido.", { phone: ["Telefone inválido. Use DDD + número."] });
    }
    const payload = { name: values.name, phone, email: values.email || null, is_active: values.is_active };
    const supabase = await createClient();

    const { error } = values.id
      ? await supabase.from("managers").update(payload).eq("id", values.id)
      : await supabase.from("managers").insert(sessionInsert<"managers">(payload));
    if (error) throw duplicateName(error) ?? fromDatabaseError(error, { op: "save_manager" });

    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveOrganizationSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const member = await authorize("settings.manage");
    const values = parse(organizationSettingsSchema, input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("organization_settings")
      .update({ sla_target_days: values.sla_target_days === "" ? null : values.sla_target_days })
      .eq("organization_id", member.organizationId);
    if (error) throw fromDatabaseError(error, { op: "save_settings" });
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
