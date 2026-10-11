"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { loginSchema, safeNextPath } from "@/modules/auth/schema";
import { logger } from "@/server/logger";
import { createClient } from "@/server/supabase/server";

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  email?: string;
};

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logger.warn("login_failed", { code: error.code ?? "unknown", status: error.status ?? null });
    const message =
      error.status === 429
        ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : "E-mail ou senha incorretos.";
    return { error: message, email };
  }

  redirect(safeNextPath(formData.get("next")) ?? "/inicio");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Encerra só a sessão deste aparelho (sair no computador não desloga o celular).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
