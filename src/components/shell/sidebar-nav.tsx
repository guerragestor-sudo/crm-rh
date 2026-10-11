"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

import { isActivePath, NAV_ITEMS } from "./nav-config";
import { UserMenu, type ShellUser } from "./user-menu";

export function SidebarNav({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(user.role, item.permission));

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          RH
        </span>
        <span className="truncate text-sm font-semibold">{user.organizationName}</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="Navegação principal">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                active && "bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
