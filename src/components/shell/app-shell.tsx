import type { ReactNode } from "react";

import { BottomNav, MobileHeader } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import type { ShellUser } from "./user-menu";

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-muted/30">
      <SidebarNav user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader user={user} />
        <main className="flex-1 pb-28 md:pb-10">{children}</main>
        <BottomNav user={user} />
      </div>
    </div>
  );
}
