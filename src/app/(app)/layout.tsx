import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { WhatsNewDialog } from "@/modules/updates/components/whats-new-dialog";
import { getUnseenReleaseIds } from "@/modules/updates/queries";
import { requireMember } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const unseenReleaseIds = await getUnseenReleaseIds(member);
  return (
    <AppShell
      user={{ fullName: member.fullName, organizationName: member.organizationName, role: member.role }}
    >
      {children}
      {unseenReleaseIds.length > 0 ? <WhatsNewDialog releaseIds={unseenReleaseIds} /> : null}
    </AppShell>
  );
}
