"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Megaphone,
  MessageCircle,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/prospeccion", label: "Prospección", icon: MessageCircle },
  { href: "/marca-personal", label: "Marca Personal", icon: Megaphone },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sidebar-primary)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight">Adnexum</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
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
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
