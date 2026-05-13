"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { GripVertical, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./ScoreBadge";
import {
  PROSPECT_STATUS_NOTES,
  extractNextStepFromSummary,
  parseIntencionesJson,
  type ProspectEstado,
} from "@/lib/prospecting";
import { withBasePath } from "@/lib/paths";
import { INTENCION_LABEL, TEMPERATURA_LABEL } from "./constants";

export interface ProspectPipelineItem {
  id: string;
  telefono: string;
  nombreContacto: string;
  negocio: string | null;
  rubro: string;
  estado: string;
  respondio: boolean;
  oportunidadScore: number;
  temperatura: string;
  intencionesJson: string;
  proximoPaso: string;
  requiereHumano: boolean;
  destacado: boolean;
  resumenIa: string;
  notas: string;
  mensajesEnviados: number;
  ultimoContacto: string | Date;
  fechaAgendado: string | Date | null;
  chatwootConversationId: string;
  displayName: string;
}

export interface ProspectPipelineColumn {
  id: ProspectEstado;
  name: string;
  color: string;
  count: number;
  prospects: ProspectPipelineItem[];
}

interface Props {
  initialColumns?: ProspectPipelineColumn[];
  refreshToken?: number;
  compact?: boolean;
}

function ProspectCard({
  prospect,
  compact = false,
}: {
  prospect: ProspectPipelineItem;
  compact?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const nextStep = prospect.proximoPaso || extractNextStepFromSummary(prospect.resumenIa);
  const intenciones = parseIntencionesJson(prospect.intencionesJson);
  const temperaturaLabel =
    TEMPERATURA_LABEL[prospect.temperatura as keyof typeof TEMPERATURA_LABEL] ||
    prospect.temperatura ||
    "Frio";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="border-border/70 bg-background shadow-sm"
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          {...listeners}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Mover prospecto"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="truncate text-sm font-semibold">{prospect.displayName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{prospect.telefono}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={prospect.oportunidadScore} />
            <Badge variant={prospect.temperatura === "caliente" ? "default" : "secondary"} className="text-[10px]">
              {temperaturaLabel}
            </Badge>
            {prospect.rubro && prospect.rubro !== "general" && (
              <Badge variant="outline" className="text-[10px]">
                {prospect.rubro}
              </Badge>
            )}
            {prospect.requiereHumano && (
              <Badge variant="destructive" className="text-[10px]">
                humano
              </Badge>
            )}
            {prospect.destacado && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
                destacado
              </Badge>
            )}
            {intenciones.slice(0, 1).map((intencion) => (
              <Badge key={intencion} variant="outline" className="text-[10px]">
                {INTENCION_LABEL[intencion]}
              </Badge>
            ))}
            {prospect.respondio && (
              <Badge variant="secondary" className="text-[10px]">
                respondio
              </Badge>
            )}
          </div>

          {nextStep && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{nextStep}</p>
          )}

          {!compact && prospect.notas && !nextStep && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {prospect.notas}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(prospect.ultimoContacto), {
                addSuffix: true,
                locale: es,
              })}
            </span>
            <span>{prospect.mensajesEnviados} msgs</span>
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={withBasePath(`/conversations?prospect=${prospect.id}`)}
              className="inline-flex"
            >
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                Inbox
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Column({
  column,
  compact = false,
}: {
  column: ProspectPipelineColumn;
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 flex-col rounded-2xl border bg-muted/30 ${
        compact ? "min-w-[280px] w-[280px]" : "min-w-[320px] w-[320px]"
      } ${isOver ? "border-primary/60 bg-primary/5" : "border-border/70"}`}
    >
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="text-sm font-semibold">{column.name}</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {column.prospects.length}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {PROSPECT_STATUS_NOTES[column.id]}
        </p>
      </div>

      <SortableContext
        items={column.prospects.map((prospect) => prospect.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[220px] flex-1 flex-col gap-3 p-3">
          {column.prospects.map((prospect) => (
            <ProspectCard key={prospect.id} prospect={prospect} compact={compact} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function ProspectingKanbanBoard({
  initialColumns = [],
  refreshToken = 0,
  compact = false,
}: Props) {
  const [columns, setColumns] = useState<ProspectPipelineColumn[]>(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshotRef = useRef<ProspectPipelineColumn[]>(initialColumns);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const activeProspect = useMemo(
    () =>
      activeId
        ? columns.flatMap((column) => column.prospects).find((item) => item.id === activeId)
        : null,
    [activeId, columns]
  );

  const loadPipeline = useCallback(async () => {
    const res = await fetch(withBasePath("/api/prospeccion/pipeline"));
    if (!res.ok) {
      throw new Error("No se pudo cargar el pipeline");
    }
    const data = await res.json();
    setColumns(data.columns || []);
  }, []);

  useEffect(() => {
    if (initialColumns.length > 0 && refreshToken === 0) {
      setColumns(initialColumns);
      return;
    }

    loadPipeline().catch(() => {
      toast.error("No se pudo actualizar el pipeline.");
    });
  }, [initialColumns, loadPipeline, refreshToken]);

  const locateColumn = useCallback(
    (id: string) =>
      columns.find(
        (column) =>
          column.id === id || column.prospects.some((prospect) => prospect.id === id)
      ),
    [columns]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
      snapshotRef.current = columns;
    },
    [columns]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeProspectId = String(active.id);
      const targetId = String(over.id);

      const activeColumn = locateColumn(activeProspectId);
      const targetColumn = locateColumn(targetId);

      if (!activeColumn || !targetColumn || activeColumn.id === targetColumn.id) {
        return;
      }

      const movingProspect = activeColumn.prospects.find(
        (prospect) => prospect.id === activeProspectId
      );

      if (!movingProspect) return;

      setColumns((prev) =>
        prev.map((column) => {
          if (column.id === activeColumn.id) {
            return {
              ...column,
              prospects: column.prospects.filter(
                (prospect) => prospect.id !== activeProspectId
              ),
            };
          }

          if (column.id === targetColumn.id) {
            return {
              ...column,
              prospects: [
                { ...movingProspect, estado: targetColumn.id },
                ...column.prospects,
              ],
            };
          }

          return column;
        })
      );
    },
    [locateColumn]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const prospectId = String(active.id);
      const targetColumn = locateColumn(String(over.id));
      if (!targetColumn) return;

      try {
        const res = await fetch(withBasePath(`/api/prospeccion/${prospectId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: targetColumn.id }),
        });

        if (!res.ok) {
          throw new Error("No se pudo mover el prospecto");
        }
      } catch {
        setColumns(snapshotRef.current);
        toast.error("No se pudo mover el prospecto. Reverti el cambio.");
      }
    },
    [locateColumn]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <Column key={column.id} column={column} compact={compact} />
        ))}
      </div>

      <DragOverlay>
        {activeProspect ? (
          <div className="w-[320px]">
            <ProspectCard prospect={activeProspect} compact={compact} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
