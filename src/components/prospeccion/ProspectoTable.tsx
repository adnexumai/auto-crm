"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Target } from "lucide-react";
import { ProspectoRow } from "./ProspectoRow";
import type { Prospecto } from "./constants";

interface Props {
  items: Prospecto[];
  onEdit: (p: Prospecto) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onEstadoChange?: (id: string, estado: string) => void;
  loading?: boolean;
}

export function ProspectoTable({
  items,
  onEdit,
  onRefresh,
  onDelete,
  onEstadoChange,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-muted-foreground">
        <Target className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay prospectos que mostrar.</p>
        <p className="mt-1 text-xs">Cambia filtros o carga un nuevo lead.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card/95 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
        <div>
          <p className="text-sm font-bold">Bandeja comercial</p>
          <p className="text-xs text-muted-foreground">
            Abri una fila para ver conversacion, analisis y proceso.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{items.length} visibles</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Siguiente accion</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead>Temp/Int</TableHead>
            <TableHead className="text-center">Msgs</TableHead>
            <TableHead>Ultimo contacto</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <ProspectoRow
              key={p.id}
              prospect={p}
              onEdit={onEdit}
              onRefresh={onRefresh}
              onDelete={onDelete}
              onEstadoChange={onEstadoChange}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
