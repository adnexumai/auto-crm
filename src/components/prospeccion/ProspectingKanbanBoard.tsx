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
import { Calendar, CheckCircle2, RefreshCw as Refresh, Sparkles, Star, XCircle } from "lucide-react";

// Quick-action transitions per state. Each card shows up to 3 buttons
// matching its current state so the user can move it without dragging.
const QUICK_ACTIONS: Record<
  string,
  Array<{ to: ProspectEstado; label: string; tone: "primary" | "success" | "danger" | "neutral"; icon: typeof Calendar }>
> = {
  enviado: [
    { to: "respondio", label: "Respondió", tone: "primary", icon: Refresh },
    { to: "cerrado_negativo", label: "Descartar", tone: "danger", icon: XCircle },
  ],
  contactado: [
    { to: "respondio", label: "Respondió", tone: "primary", icon: Refresh },
    { to: "cerrado_negativo", label: "Descartar", tone: "danger", icon: XCircle },
  ],
  respondio: [
    { to: "agendado", label: "Agendar", tone: "primary", icon: Calendar },
    { to: "seguimiento", label: "Seguir", tone: "neutral", icon: Sparkles },
    { to: "cerrado_negativo", label: "Cerrar -", tone: "danger", icon: XCircle },
  ],
  agendado: [
    { to: "cerrado_positivo", label: "Ganó", tone: "success", icon: CheckCircle2 },
    { to: "cerrado_negativo", label: "Perdió", tone: "danger", icon: XCircle },
    { to: "seguimiento", label: "Reactivar", tone: "neutral", icon: Sparkles },
  ],
  seguimiento: [
    { to: "agendado", label: "Agendar", tone: "primary", icon: Calendar },
    { to: "cerrado_positivo", label: "Ganó", tone: "success", icon: CheckCircle2 },
    { to: "cerrado_negativo", label: "Perdió", tone: "danger", icon: XCircle },
  ],
};

const TONE_CLASSES = {
  primary: "border-primary/40 text-primary hover:bg-primary/10",
  success: "border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
  danger: "border-red-500/40 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30",
  neutral: "border-border text-muted-foreground hover:bg-muted",
};

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
  onQuickMove,
  onToggleStar,
}: {
  prospect: ProspectPipelineItem;
  compact?: boolean;
  onQuickMove: (id: string, target: ProspectEstado) => void;
  onToggleStar: (id: string, next: boolean) => void;
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

  // Safe date parsing — backend can send null/empty strings
  const lastContactDate = prospect.ultimoContacto
    ? new Date(prospect.ultimoContacto)
    : null;
  const lastContactValid =
    lastContactDate !== null && !isNaN(lastContactDate.getTime());
  const daysSinceContact = lastContactValid
    ? (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const isStale = daysSinceContact > 3 && prospect.estado === "respondio";
  const isHot =
    prospect.temperatura === "caliente" || prospect.oportunidadScore >= 7;

  const accent = isHot
    ? "border-orange-500/40 shadow-[0_0_0_1px_rgba(251,146,60,0.2)]"
    : isStale
    ? "border-amber-500/40"
    : "border-border/70";

  const quickActions = QUICK_ACTIONS[prospect.estado] || [];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`bg-background shadow-sm ${accent}`}
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{prospect.displayName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span className="truncate">{prospect.telefono}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(prospect.id, !prospect.destacado);
              }}
              className="shrink-0 text-muted-foreground hover:text-amber-500"
              aria-label="Destacar"
            >
              <Star
                className={`h-4 w-4 ${
                  prospect.destacado ? "fill-amber-500 text-amber-500" : ""
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ScoreBadge score={prospect.oportunidadScore} />
            <Badge
              variant={prospect.temperatura === "caliente" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {temperaturaLabel}
            </Badge>
            {prospect.requiereHumano && (
              <Badge variant="destructive" className="text-[10px]">
                humano
              </Badge>
            )}
            {intenciones.slice(0, 1).map((intencion) => (
              <Badge key={intencion} variant="outline" className="text-[10px]">
                {INTENCION_LABEL[intencion]}
              </Badge>
            ))}
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
              {lastContactValid
                ? formatDistanceToNow(lastContactDate, {
                    addSuffix: true,
                    locale: es,
                  })
                : "sin actividad"}
            </span>
            <span>{prospect.mensajesEnviados} msgs</span>
          </div>

          {/* Quick actions per state */}
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.to}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickMove(prospect.id, action.to);
                    }}
                    className={`inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium transition-colors ${TONE_CLASSES[action.tone]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {action.label}
                  </button>
                );
              })}
              <a
                href={withBasePath(`/prospeccion/inbox`)}
                onClick={(e) => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <MessageSquare className="h-3 w-3" />
                Inbox
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Column({
  column,
  compact = false,
  onQuickMove,
  onToggleStar,
}: {
  column: ProspectPipelineColumn;
  compact?: boolean;
  onQuickMove: (id: string, target: ProspectEstado) => void;
  onToggleStar: (id: string, next: boolean) => void;
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
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              compact={compact}
              onQuickMove={onQuickMove}
              onToggleStar={onToggleStar}
            />
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

  const handleQuickMove = useCallback(
    async (id: string, target: ProspectEstado) => {
      // Optimistic: move card between columns
      snapshotRef.current = columns;
      setColumns((prev) => {
        let moving: ProspectPipelineItem | null = null;
        const next = prev.map((col) => {
          const found = col.prospects.find((p) => p.id === id);
          if (found && !moving) {
            moving = { ...found, estado: target };
          }
          return {
            ...col,
            prospects: col.prospects.filter((p) => p.id !== id),
          };
        });
        if (moving) {
          return next.map((col) =>
            col.id === target
              ? { ...col, prospects: [moving as ProspectPipelineItem, ...col.prospects] }
              : col
          );
        }
        return prev;
      });

      try {
        const res = await fetch(withBasePath(`/api/prospeccion/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: target }),
        });
        if (!res.ok) throw new Error();
        toast.success(`Movido a ${target.replace("_", " ")}`);
      } catch {
        setColumns(snapshotRef.current);
        toast.error("No se pudo mover el prospecto");
      }
    },
    [columns]
  );

  const handleToggleStar = useCallback(
    async (id: string, next: boolean) => {
      // Optimistic
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          prospects: col.prospects.map((p) =>
            p.id === id ? { ...p, destacado: next } : p
          ),
        }))
      );
      try {
        const res = await fetch(withBasePath(`/api/prospeccion/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destacado: next }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            prospects: col.prospects.map((p) =>
              p.id === id ? { ...p, destacado: !next } : p
            ),
          }))
        );
        toast.error("No se pudo actualizar destacado");
      }
    },
    []
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
          <Column
            key={column.id}
            column={column}
            compact={compact}
            onQuickMove={handleQuickMove}
            onToggleStar={handleToggleStar}
          />
        ))}
      </div>

      <DragOverlay>
        {activeProspect ? (
          <div className="w-[320px]">
            <ProspectCard
              prospect={activeProspect}
              compact={compact}
              onQuickMove={handleQuickMove}
              onToggleStar={handleToggleStar}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
