export type MemberRole = "admin" | "recruiter";

export type Permission =
  | "candidates.read"
  | "candidates.write"
  | "candidates.export"
  | "candidates.archive"
  | "tasks.write"
  | "documents.write"
  | "settings.manage"
  | "audit.read";

const RECRUITER: readonly Permission[] = [
  "candidates.read",
  "candidates.write",
  "candidates.export",
  "tasks.write",
  "documents.write",
];

const MATRIX: Record<MemberRole, readonly Permission[]> = {
  admin: [...RECRUITER, "candidates.archive", "settings.manage", "audit.read"],
  recruiter: RECRUITER,
};

/** Usada na UI para esconder ações; a garantia real está no servidor e no RLS. */
export function can(role: MemberRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Administrador",
  recruiter: "Recrutador",
};
