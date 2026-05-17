"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withBasePath } from "@/lib/paths";
import { ColaDiariaPanel } from "./ColaDiariaPanel";
import { TareasDelDiaPanel } from "./TareasDelDiaPanel";
import { SeguimientoPanel } from "./SeguimientoPanel";
import { EditarProspectoDialog } from "./EditarProspectoDialog";
import { ScoreBadge } from "./ScoreBadge";
import type { Prospecto } from "./constants";

function AgendadosView({ onEdit }: { onEdit: (p: Prospecto) => void }) {
  const [items, setItems] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withBasePath("/api/prospeccion?estado=agendado&pageSize=100"))
      .then((res) => res.json())
      .then((data) => {
        const sorted = (data.items || []).sort(
          (a: Prospecto, b: Prospecto) => {
            const aTime = a.fechaAgendado
              ? new Date(a.fechaAgendado).getTime()
              : Number.POSITIVE_INFINITY;
            const bTime = b.fechaAgendado
              ? new Date(b.fechaAgendado).getTime()
              : Number.POSITIVE_INFINITY;
            return aTime - bTime;
          }
        );
        setItems(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando agenda...
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay reuniones agendadas.</p>
        <p className="mt-1 text-xs">
          Mové un lead al estado &quot;Agendado&quot; y definí fecha.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((prospect) => {
        const title =
          prospect.negocio || prospect.nombreContacto || prospect.telefono;
        const formattedDate = prospect.fechaAgendado
          ? format(
              new Date(prospect.fechaAgendado),
              "EEEE dd 'de' MMMM - HH:mm",
              { locale: es }
            )
          : "Sin fecha";

        return (
          <button
            key={prospect.id}
            type="button"
            onClick={() => onEdit(prospect)}
            className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {prospect.telefono}
              </p>
              <p className="mt-1 text-sm font-medium capitalize text-primary">
                {formattedDate}
              </p>
            </div>
            <ScoreBadge score={prospect.oportunidadScore} />
          </button>
        );
      })}
    </div>
  );
}

export function HoyView() {
  const [editing, setEditing] = useState<Prospecto | null>(null);

  return (
    <>
      <Tabs defaultValue="cola">
        <TabsList className="mb-3 grid w-full grid-cols-4">
          <TabsTrigger value="cola">Cola priorizada</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
        </TabsList>
        <TabsContent value="cola">
          <ColaDiariaPanel />
        </TabsContent>
        <TabsContent value="tareas">
          <TareasDelDiaPanel />
        </TabsContent>
        <TabsContent value="agenda">
          <AgendadosView onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="seguimiento">
          <SeguimientoPanel />
        </TabsContent>
      </Tabs>

      <EditarProspectoDialog
        prospect={editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    </>
  );
}
