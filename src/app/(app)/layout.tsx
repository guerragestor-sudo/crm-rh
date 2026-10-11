import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { requireMember } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  return (
    <AppShell
      user={{ fullName: member.fullName, organizationName: member.organizationName, role: member.role }}
    >
      {children}
    </AppShell>
  );
}
