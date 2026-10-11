"use client";

import { CalendarCheck, LayoutDashboard, LogOut, Menu, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { signOut } from "@/modules/auth/actions";

import { isActivePath, NAV_ITEMS } from "./nav-config";
import { UserAvatar, UserMenu, type ShellUser } from "./user-menu";

const PRIMARY = [
  { href: "/inicio", label: "Início", icon: LayoutDashboard },
  { href: "/candidatos", label: "Candidatos", icon: Users },
];
const SECONDARY = [{ href: "/agenda", label: "Agenda", icon: CalendarCheck }];

/** Cabeçalho fixo do celular. */
export function MobileHeader({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Link href="/inicio" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          RH
        </span>
        <span className="max-w-[55vw] truncate text-sm font-semibold">{user.organizationName}</span>
      </Link>
      <div className="w-10">
        <UserMenu user={user} compact />
      </div>
    </header>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Users; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
        active && "text-primary",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

/** Barra inferior do celular: Início · Candidatos · ＋ · Agenda · Mais. */
export function BottomNav({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const more = NAV_ITEMS.filter(
    (item) =>
      !["/inicio", "/candidatos", "/agenda"].includes(item.href) &&
      (!item.permission || can(user.role, item.permission)),
  );
  const moreActive = more.some((item) => isActivePath(pathname, item.href));

  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <div className="flex h-16 items-stretch">
        {PRIMARY.map((item) => (
          <TabLink key={item.href} {...item} active={isActivePath(pathname, item.href)} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/candidatos/novo"
            aria-label="Novo candidato"
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        </div>
        {SECONDARY.map((item) => (
          <TabLink key={item.href} {...item} active={isActivePath(pathname, item.href)} />
        ))}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
              moreActive && "text-primary",
            )}
          >
            <Menu className="size-5" aria-hidden />
            Mais
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="flex-row items-center gap-3 text-left">
              <UserAvatar name={user.fullName} />
              <div className="min-w-0">
                <DrawerTitle className="truncate">{user.fullName}</DrawerTitle>
                <DrawerDescription className="truncate">
                  {user.organizationName} · {ROLE_LABELS[user.role]}
                </DrawerDescription>
              </div>
            </DrawerHeader>
            <div className="grid gap-1 px-2 pb-2">
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-base font-medium hover:bg-muted",
                      isActivePath(pathname, item.href) && "bg-muted text-primary",
                    )}
                  >
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-base font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-5" aria-hidden />
                  Sair
                </button>
              </form>
            </div>
            <div className="pb-safe" />
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
