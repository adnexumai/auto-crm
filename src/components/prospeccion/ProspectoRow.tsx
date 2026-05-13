"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  ListChecks,
  MessageSquare,
  Star,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/paths";
import { parseIntencionesJson } from "@/lib/prospecting";
import { ProcesoVentas } from "./ProcesoVentas";
import { ScoreBadge } from "./ScoreBadge";
import {
  ESTADO_LABEL,
  ESTADO_ORDER,
  INTENCION_LABEL,
  TEMPERATURA_LABEL,
  type Mensaje,
  type Prospecto,
} from "./constants";

const ESTADO_SHORT: Record<string, string> = {
  enviado: "EN",
  contactado: "CO",
  respondio: "RE",
  agendado: "AG",
  seguimiento: "SE",
  cerrado_positivo: "GA",
  cerrado_negativo: "PE",
};

interface Props {
  prospect: Prospecto;
  onEdit: (p: Prospecto) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onEstadoChange?: (id: string, estado: string) => void;
}

function extractResumen(text: string) {
  return (
    text
      .split("\n")
      .find((line) => line.startsWith("RESUMEN:"))
      ?.replace("RESUMEN:", "")
      .trim() || "-"
  );
}

export function ProspectoRow({
  prospect,
  onEdit,
  onRefresh,
  onDelete,
  onEstadoChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversacion" | "analisis" | "proceso">("conversacion");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [estadoLocal, setEstadoLocal] = useState(prospect.estado);
  const [destacadoLocal, setDestacadoLocal] = useState(Boolean(prospect.destacado));

  useEffect(() => {
    if (!expanded || activeTab !== "conversacion") return;
    setLoadingMsgs(true);
    fetch(withBasePath(`/api/prospeccion/${prospect.id}/messages`))
      .then((r) => r.json())
      .then((data) => setMensajes(data.items || []))
      .catch(() => setMensajes([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeTab, expanded, prospect.id]);

  async function cambiarEstado(nuevoEstado: string) {
    if (nuevoEstado === estadoLocal) return;
    setCambiandoEstado(true);
    const anterior = estadoLocal;
    setEstadoLocal(nuevoEstado);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Estado: ${ESTADO_LABEL[nuevoEstado]}`);
      onEstadoChange?.(prospect.id, nuevoEstado);
    } catch {
      setEstadoLocal(anterior);
      toast.error("No se pudo cambiar el estado");
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function toggleDestacado() {
    const next = !destacadoLocal;
    setDestacadoLocal(next);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destacado: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "Oportunidad destacada" : "Destacado removido");
      onRefresh();
    } catch {
      setDestacadoLocal(!next);
      toast.error("No se pudo actualizar destacado");
    }
  }

  async function analizar() {
    setAnalyzing(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: prospect.telefono }),
      });
      if (!res.ok) throw new Error();
      toast.success("Analisis actualizado");
      onRefresh();
    } catch {
      toast.error("No se pudo analizar");
    } finally {
      setAnalyzing(false);
    }
  }

  async function promover() {
    if (prospect.crmDealId) {
      toast.info("Este prospecto ya fue promovido a Deal");
      return;
    }
    setPromoting(true);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}/promote`), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al promover");
      toast.success("Prospecto promovido a Deal");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al promover");
    } finally {
      setPromoting(false);
    }
  }

  async function eliminar() {
    setDeleting(true);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Prospecto eliminado");
      onDelete(prospect.id);
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  const title = prospect.negocio || prospect.nombreContacto || "Sin nombre";
  const resumen = prospect.resumenIa ? extractResumen(prospect.resumenIa) : "-";
  const intenciones = parseIntencionesJson(prospect.intencionesJson);
  const temperaturaLabel =
    TEMPERATURA_LABEL[prospect.temperatura as keyof typeof TEMPERATURA_LABEL] ||
    prospect.temperatura ||
    "Frio";
  const nextStep = prospect.proximoPaso || prospect.ultimoMensaje || "Definir siguiente accion";
  const chatwootUrl =
    prospect.chatwootConversationId &&
    process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL &&
    process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID
      ? `${process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL}/app/accounts/${process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID}/conversations/${prospect.chatwootConversationId}`
      : null;

  let procesoStats = { completados: 0, total: 8 };
  if (prospect.procesoVentas) {
    try {
      const proceso = JSON.parse(prospect.procesoVentas) as { completado: boolean }[];
      procesoStats = {
        completados: proceso.filter((item) => item.completado).length,
        total: proceso.length,
      };
    } catch {
      procesoStats = { completados: 0, total: 8 };
    }
  }

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-b transition-colors hover:bg-muted/50",
          destacadoLocal && "bg-amber-50/70 hover:bg-amber-50 dark:bg-amber-400/5 dark:hover:bg-amber-400/10"
        )}
        onClick={() => setExpanded((value) => !value)}
      >
        <td className="px-4 py-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void toggleDestacado();
              }}
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border transition",
                destacadoLocal
                  ? "border-amber-300 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200"
                  : "border-border text-muted-foreground hover:text-amber-600"
              )}
              title={destacadoLocal ? "Quitar destacado" : "Destacar oportunidad"}
            >
              <Star className={cn("h-3.5 w-3.5", destacadoLocal && "fill-current")} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{prospect.telefono}</p>
              {prospect.chatwootConversationId ? (
                <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
                  Chatwoot #{prospect.chatwootConversationId}
                </p>
              ) : (
                <p className="mt-0.5 text-[10px] text-amber-600">Sin Chatwoot</p>
              )}
            </div>
          </div>
        </td>

        <td className="max-w-sm px-4 py-3">
          <p className="truncate text-xs font-semibold text-foreground">Paso: {nextStep}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {resumen}
          </p>
        </td>

        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
          <div className="flex max-w-[150px] flex-wrap gap-1">
            {ESTADO_ORDER.map((estado) => (
              <button
                key={estado}
                onClick={() => void cambiarEstado(estado)}
                disabled={cambiandoEstado}
                title={ESTADO_LABEL[estado]}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
                  estadoLocal === estado
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {ESTADO_SHORT[estado]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{ESTADO_LABEL[estadoLocal]}</p>
        </td>

        <td className="px-4 py-3 text-center">
          <ScoreBadge score={prospect.oportunidadScore} />
        </td>

        <td className="px-4 py-3">
          <div className="flex max-w-[190px] flex-wrap gap-1">
            <Badge variant={prospect.temperatura === "caliente" ? "default" : "secondary"} className="text-[10px]">
              {temperaturaLabel}
            </Badge>
            {prospect.requiereHumano ? (
              <Badge variant="destructive" className="text-[10px]">
                humano
              </Badge>
            ) : null}
            {intenciones.slice(0, 2).map((intencion) => (
              <Badge key={intencion} variant="outline" className="text-[10px]">
                {INTENCION_LABEL[intencion]}
              </Badge>
            ))}
          </div>
        </td>

        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
          {prospect.mensajesEnviados}
        </td>

        <td className="px-4 py-3 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(prospect.ultimoContacto), {
            addSuffix: true,
            locale: es,
          })}
        </td>

        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {procesoStats.completados > 0 ? (
              <span className="mr-1 text-[10px] tabular-nums text-muted-foreground">
                {procesoStats.completados}/{procesoStats.total}
              </span>
            ) : null}
            <a
              href={withBasePath(`/conversations?prospect=${prospect.id}`)}
              title="Abrir inbox CRM"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </a>
            {chatwootUrl ? (
              <a
                href={chatwootUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en Chatwoot"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onEdit(prospect)} className="h-7 px-2 text-xs">
              Editar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleting}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar prospecto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vas a eliminar a <strong>{title}</strong> y todos sus mensajes. Esta accion no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={eliminar}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </td>
      </tr>

      {expanded ? (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-4 py-4">
            <div className="mb-4 flex flex-wrap gap-1 border-b pb-2">
              {(["conversacion", "analisis", "proceso"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab === "conversacion" && "Conversacion"}
                  {tab === "analisis" && "Analisis IA"}
                  {tab === "proceso" && `Proceso ${procesoStats.completados > 0 ? `(${procesoStats.completados}/${procesoStats.total})` : ""}`}
                </button>
              ))}
            </div>

            {activeTab === "conversacion" ? (
              <div>
                {loadingMsgs ? (
                  <p className="text-xs text-muted-foreground">Cargando mensajes...</p>
                ) : mensajes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin mensajes registrados.</p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {mensajes.filter((m) => m.contenido?.trim() || m.transcripcion?.trim()).map((message) => {
                      const outgoing = message.direccion === "saliente";
                      return (
                        <div key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[82%] rounded-2xl px-3 py-2 text-xs",
                              outgoing
                                ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100"
                                : "bg-background text-foreground"
                            )}
                          >
                            <p className="mb-0.5 whitespace-pre-wrap">{message.contenido}</p>
                            {message.transcripcion ? (
                              <p className="mb-0.5 text-[10px] italic opacity-80">Audio: {message.transcripcion}</p>
                            ) : null}
                            <p className="text-[10px] opacity-55">{format(new Date(message.timestamp), "dd/MM HH:mm")}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "analisis" ? (
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={analizar} disabled={analyzing} className="h-8 text-xs">
                    <Zap className="mr-1 h-3.5 w-3.5" />
                    {analyzing ? "Analizando..." : "Analizar ahora"}
                  </Button>
                  <Button size="sm" onClick={promover} disabled={promoting || Boolean(prospect.crmDealId)} className="h-8 text-xs">
                    <TrendingUp className="mr-1 h-3.5 w-3.5" />
                    {prospect.crmDealId ? "Ya promovido" : promoting ? "Promoviendo..." : "Guardar oportunidad"}
                  </Button>
                </div>
                {prospect.resumenIa ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {prospect.resumenIa.split("\n").filter(Boolean).map((linea) => {
                      const [clave, ...resto] = linea.split(":");
                      const valor = resto.join(":").trim();
                      if (!valor) return null;
                      return (
                        <div key={linea} className="rounded-xl border bg-background p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{clave.trim()}</p>
                          <p className="mt-1 text-xs leading-5">{valor}</p>
                        </div>
                      );
                    })}
                    {prospect.ultimoAnalisis ? (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground md:col-span-2">
                        <Clock className="h-3 w-3" />
                        Analizado {formatDistanceToNow(new Date(prospect.ultimoAnalisis), { addSuffix: true, locale: es })}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin analisis todavia.</p>
                )}
              </div>
            ) : null}

            {activeTab === "proceso" ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Checklist comercial</p>
                </div>
                <ProcesoVentas prospect={prospect} />
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
