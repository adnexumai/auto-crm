"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  Kanban,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const allItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/contacts", label: "Contactos", icon: Users },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/activities", label: "Actividades", icon: Activity },
  { href: "/prospeccion", label: "Prospeccion diaria", icon: MessageCircle },
  { href: "/settings", label: "Configuracion", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sidebar-primary)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="leading-none">
          <span className="text-base font-bold tracking-tight">Adnexum AI</span>
          <p className="mt-0.5 text-[10px] text-[var(--sidebar-foreground)]/50">CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {allItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                  : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
