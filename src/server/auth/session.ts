import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { can, type MemberRole, type Permission } from "@/lib/permissions";
import { AppError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

export type CurrentMember = {
  userId: string;
  memberId: string;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  fullName: string;
  email: string | null;
};

type SessionState =
  | { status: "anonymous" }
  | { status: "no_membership"; userId: string }
  | { status: "member"; member: CurrentMember };

/**
 * Lê e valida a sessão (getClaims verifica o JWT) e carrega o vínculo ativo.
 * Memoizado por requisição. A organização sempre vem daqui, nunca do cliente.
 */
const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return { status: "anonymous" };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, organizations(name), profiles(full_name, email)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !membership.organizations || !membership.profiles) {
    return { status: "no_membership", userId };
  }

  return {
    status: "member",
    member: {
      userId,
      memberId: membership.id,
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      role: membership.role as MemberRole,
      fullName: membership.profiles.full_name,
      email: membership.profiles.email,
    },
  };
});

/** Para páginas e layouts: redireciona quem não pode entrar. */
export async function requireMember(): Promise<CurrentMember> {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "no_membership") redirect("/sem-acesso");
  return state.member;
}

/** Para páginas restritas por permissão. */
export async function requirePermission(permission: Permission): Promise<CurrentMember> {
  const member = await requireMember();
  if (!can(member.role, permission)) redirect("/inicio");
  return member;
}

/** Para Server Actions e Route Handlers: lança AppError em vez de redirecionar. */
export async function authorize(permission: Permission): Promise<CurrentMember> {
  const state = await getSessionState();
  if (state.status === "anonymous") {
    throw new AppError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.");
  }
  if (state.status === "no_membership" || !can(state.member.role, permission)) {
    throw new AppError("FORBIDDEN", "Você não tem permissão para esta ação.");
  }
  return state.member;
}

export async function getSessionStatus(): Promise<SessionState["status"]> {
  return (await getSessionState()).status;
}
