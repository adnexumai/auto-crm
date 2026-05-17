"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  Megaphone,
  Kanban,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Prospección first — es lo que más usás
const prospectingItems = [
  { href: "/prospeccion", label: "Prospección", icon: MessageCircle },
];

const marcaItems = [
  { href: "/marca-personal", label: "Marca Personal", icon: Megaphone },
];

const crmItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/contacts", label: "Contactos", icon: Users },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/activities", label: "Actividades", icon: Activity },
];

const bottomItems = [
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    return cn(
      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
        : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
    );
  };

  return (
    <aside className="hidden min-h-screen flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] md:flex md:w-64">
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sidebar-primary)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="leading-none">
          <span className="text-base font-bold tracking-tight">Adnexum AI</span>
          <p className="mt-0.5 text-[10px] text-[var(--sidebar-foreground)]/50">CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-foreground)]/40">
            Ventas
          </p>
          {prospectingItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-foreground)]/40">
            Marketing
          </p>
          {marcaItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-foreground)]/40">
            CRM clásico
          </p>
          {crmItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="space-y-1 border-t border-[var(--sidebar-border)] px-3 pb-3 pt-3">
        {bottomItems.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        ))}
        <div className="px-3 pt-2">
          <p className="text-[10px] text-[var(--sidebar-foreground)]/40">
            Adnexum AI · Tomas Bravo
          </p>
        </div>
      </div>
    </aside>
  );
}
