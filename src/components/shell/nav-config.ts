import {
  CalendarCheck,
  Columns3,
  FileDown,
  LayoutDashboard,
  Settings,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Início", icon: LayoutDashboard },
  { href: "/candidatos", label: "Candidatos", icon: Users },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/agenda", label: "Agenda", icon: CalendarCheck },
  { href: "/sla", label: "SLA", icon: Timer },
  { href: "/relatorios", label: "Relatórios", icon: FileDown },
  { href: "/configuracoes", label: "Configurações", icon: Settings, permission: "settings.manage" },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
