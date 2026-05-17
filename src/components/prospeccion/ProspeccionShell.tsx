"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  KanbanSquare,
  ListChecks,
  PlusSquare,
  RefreshCw,
  Settings2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NuevoProspectoDialog } from "./NuevoProspectoDialog";
import type { Kpis } from "./constants";

interface Props {
  kpis: Kpis;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/prospeccion/inbox", label: "Inbox", icon: Inbox },
  { href: "/prospeccion/leads", label: "Leads", icon: Target },
  { href: "/prospeccion/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/prospeccion/hoy", label: "Hoy", icon: ListChecks },
  { href: "/prospeccion/sistema", label: "Sistema", icon: Settings2 },
];

function StatPill({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === "" ? 0 : value;
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5">
      <p className="text-2xl font-black leading-none tracking-tight">{display}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function ProspeccionShell({ kpis, children }: Props) {
  const pathname = usePathname();
  const [showNewProspect, setShowNewProspect] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Prospección</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kpis.total ?? 0} prospectos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowNewProspect(true)}>
            <PlusSquare className="mr-1.5 h-3.5 w-3.5" />
            Nuevo lead
          </Button>
        </div>
      </header>

      {/* KPI pills */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Hoy" value={kpis.contactosHoy} />
        <StatPill label="Respuestas" value={kpis.respuestasHoy} />
        <StatPill label="Tasa" value={`${kpis.tasa ?? 0}%`} />
        <StatPill label="Pipeline" value={kpis.oportunidadesAbiertas} />
      </div>

      {/* Tabs as link nav */}
      <nav className="flex w-full overflow-x-auto rounded-lg bg-muted/40 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <div className="min-h-0">{children}</div>

      {/* Global new prospect dialog */}
      <NuevoProspectoDialog
        open={showNewProspect}
        onClose={() => setShowNewProspect(false)}
        onCreated={() => {
          setShowNewProspect(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
