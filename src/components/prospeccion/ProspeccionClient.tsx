"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  ListTodo,
  PlusSquare,
  RefreshCw,
  Search,
  Signal,
  Star,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withBasePath } from "@/lib/paths";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCards } from "./KpiCards";
import { KpiChart } from "./KpiChart";
import { ProspectoTable } from "./ProspectoTable";
import { EditarProspectoDialog } from "./EditarProspectoDialog";
import { NuevoProspectoDialog } from "./NuevoProspectoDialog";
import { ProspectingKanbanBoard } from "./ProspectingKanbanBoard";
import { TareasDelDiaPanel } from "./TareasDelDiaPanel";
import { ScoreBadge } from "./ScoreBadge";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ColaDiariaPanel } from "./ColaDiariaPanel";
import { SeguimientoPanel } from "./SeguimientoPanel";
import { SyncStatusPanel } from "./SyncStatusPanel";
import {
  ESTADO_LABEL,
  ESTADO_ORDER,
  INTENCION_LABEL,
  INTENCION_ORDER,
  TEMPERATURA_LABEL,
  TEMPERATURA_ORDER,
  type Kpis,
  type Prospecto,
} from "./constants";

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;

interface Props {
  initialItems: Prospecto[];
  initialKpis: Kpis;
  initialTotal: number;
}

function AgendadosView({ onEdit }: { onEdit: (prospect: Prospecto) => void }) {
  const [items, setItems] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withBasePath("/api/prospeccion?estado=agendado&pageSize=100"))
      .then((res) => res.json())
      .then((data) => {
        const nextItems = (data.items || []).sort((left: Prospecto, right: Prospecto) => {
          const leftTime = left.fechaAgendado
            ? new Date(left.fechaAgendado).getTime()
            : Number.POSITIVE_INFINITY;
          const rightTime = right.fechaAgendado
            ? new Date(right.fechaAgendado).getTime()
            : Number.POSITIVE_INFINITY;

          return leftTime - rightTime;
        });

        setItems(nextItems);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando agenda...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay reuniones agendadas.</p>
        <p className="mt-1 text-xs">Mueve un lead a Reunion agendada y define fecha.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((prospect) => {
        const title = prospect.negocio || prospect.nombreContacto || prospect.telefono;
        const formattedDate = prospect.fechaAgendado
          ? format(new Date(prospect.fechaAgendado), "EEEE dd 'de' MMMM - HH:mm", {
              locale: es,
            })
          : "Sin fecha";

        return (
          <div
            key={prospect.id}
            className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="font-mono text-xs text-muted-foreground">{prospect.telefono}</p>
              <p className="mt-1 text-sm font-medium text-primary capitalize">
                {formattedDate}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ScoreBadge score={prospect.oportunidadScore} />
              <Button size="sm" variant="outline" onClick={() => onEdit(prospect)}>
                Editar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ChannelStatus = {
  channel: string;
  connected: boolean;
  ycloudKeyConfigured: boolean;
  chatwootDirectConfigured: boolean;
  n8nWebhookConfigured: boolean;
  whatsappNumber: string | null;
  lastMessage: {
    telefono: string;
    direccion: string;
    timestamp: string;
  } | null;
};

function SignalPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {label}
    </span>
  );
}

function DailyCommandCenter({
  kpis,
  topOpportunities,
  channelStatus,
  lastSyncAt,
  onEdit,
  onRefresh,
}: {
  kpis: Kpis;
  topOpportunities: Prospecto[];
  channelStatus: ChannelStatus | null;
  lastSyncAt: Date | null;
  onEdit: (prospect: Prospecto) => void;
  onRefresh: () => void;
}) {
  const lastMessage = channelStatus?.lastMessage;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.75fr]">
      <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Plan del dia
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Que atender primero
            </h2>
          </div>
          <Badge variant="outline">
            <ListTodo className="mr-1.5 h-3.5 w-3.5" />
            tareas
          </Badge>
        </div>
        <TareasDelDiaPanel />
      </div>

      <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Oportunidades
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Leads para abrir ahora
            </h2>
          </div>
          <Badge className="bg-amber-500 text-white hover:bg-amber-500">
            <Star className="mr-1.5 h-3.5 w-3.5" />
            prioridad
          </Badge>
        </div>

        {topOpportunities.length > 0 ? (
          <div className="space-y-3">
            {topOpportunities.map((prospect) => (
              <button
                key={prospect.id}
                type="button"
                onClick={() => onEdit(prospect)}
                className="group w-full rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {prospect.negocio || prospect.nombreContacto || prospect.telefono}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {prospect.telefono}
                    </p>
                  </div>
                  <ScoreBadge score={prospect.oportunidadScore} />
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {prospect.proximoPaso || prospect.ultimoMensaje || "Definir siguiente accion."}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {TEMPERATURA_LABEL[prospect.temperatura as keyof typeof TEMPERATURA_LABEL] || prospect.temperatura || "Frio"}
                    </Badge>
                    {prospect.requiereHumano ? (
                      <Badge variant="destructive" className="text-[10px]">
                        humano
                      </Badge>
                    ) : null}
                    {prospect.chatwootConversationId ? (
                      <Badge variant="outline" className="text-[10px]">
                        chatwoot
                      </Badge>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay oportunidades marcadas. Usa estrella, temperatura o score alto para destacarlas.
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Canal
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Estado live
            </h2>
          </div>
          {channelStatus?.connected ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Activity className="h-5 w-5 text-amber-500" />
          )}
        </div>

        <div className="space-y-2">
          <SignalPill active={Boolean(channelStatus?.ycloudKeyConfigured)} label="YCloud configurado" />
          <SignalPill active={Boolean(channelStatus?.chatwootDirectConfigured)} label="Chatwoot configurado" />
          <SignalPill active={Boolean(channelStatus?.n8nWebhookConfigured)} label="n8n webhook activo" />
        </div>

        <div className="mt-5 rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ultima actividad
          </p>
          {lastMessage ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm font-bold">{lastMessage.telefono}</p>
              <p className="text-xs text-muted-foreground">
                {lastMessage.direccion} - {format(new Date(lastMessage.timestamp), "HH:mm:ss")}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Sin actividad reciente.</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl border bg-background p-3">
            <p className="text-2xl font-black">{kpis.tibios}</p>
            <p className="text-[11px] text-muted-foreground">tibios</p>
          </div>
          <div className="rounded-2xl border bg-background p-3">
            <p className="text-2xl font-black">{kpis.requiereHumano}</p>
            <p className="text-[11px] text-muted-foreground">humanos</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4 w-full">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refrescar ahora
        </Button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Sync local: {lastSyncAt ? format(lastSyncAt, "HH:mm:ss") : "inicial"}
        </p>
      </div>
    </section>
  );
}

export function ProspeccionClient({
  initialItems,
  initialKpis,
  initialTotal,
}: Props) {
  const [items, setItems] = useState<Prospecto[]>(initialItems);
  const [kpis, setKpis] = useState<Kpis>(initialKpis);
  const [totalFiltered, setTotalFiltered] = useState(initialTotal);
  const [totalGlobal, setTotalGlobal] = useState(initialKpis.total);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("all");
  const [temperatura, setTemperatura] = useState("all");
  const [intencion, setIntencion] = useState("all");
  const [requiereHumano, setRequiereHumano] = useState("all");
  const [destacado, setDestacado] = useState("all");
  const [page, setPage] = useState(0);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [editing, setEditing] = useState<Prospecto | null>(null);
  const [showNewProspect, setShowNewProspect] = useState(false);
  const [pipelineRefreshToken, setPipelineRefreshToken] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [channelStatus, setChannelStatus] = useState<ChannelStatus | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (opts: {
      page?: number;
      search?: string;
      estado?: string;
      temperatura?: string;
      intencion?: string;
      requiereHumano?: string;
      destacado?: string;
      silent?: boolean;
    } = {}) => {
      const nextPage = opts.page ?? page;
      const nextSearch = opts.search ?? search;
      const nextEstado = opts.estado ?? estado;
      const nextTemperatura = opts.temperatura ?? temperatura;
      const nextIntencion = opts.intencion ?? intencion;
      const nextRequiereHumano = opts.requiereHumano ?? requiereHumano;
      const nextDestacado = opts.destacado ?? destacado;

      if (!opts.silent) setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(PAGE_SIZE),
        });

        if (nextSearch) params.set("search", nextSearch);
        if (nextEstado && nextEstado !== "all") params.set("estado", nextEstado);
        if (nextTemperatura && nextTemperatura !== "all") {
          params.set("temperatura", nextTemperatura);
        }
        if (nextIntencion && nextIntencion !== "all") {
          params.set("intencion", nextIntencion);
        }
        if (nextRequiereHumano === "true") {
          params.set("requiereHumano", "true");
        }
        if (nextDestacado === "true") {
          params.set("destacado", "true");
        }

        const [listRes, kpiRes, channelRes] = await Promise.all([
          fetch(withBasePath(`/api/prospeccion?${params}`)),
          fetch(withBasePath("/api/prospeccion/kpis")),
          fetch(withBasePath("/api/prospeccion/canal")),
        ]);

        if (listRes.ok) {
          const data = await listRes.json();
          setItems(data.items || []);
          setTotalFiltered(data.total || 0);
          setTotalGlobal(data.totalGlobal || 0);
        }

        if (kpiRes.ok) {
          setKpis(await kpiRes.json());
        }
        if (channelRes.ok) {
          setChannelStatus(await channelRes.json());
        }
        setLastSyncAt(new Date());
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [destacado, estado, intencion, page, requiereHumano, search, temperatura]
  );

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      void load({ page: 0, search: value });
    }, 350);
  }

  function handleEstadoChange(value: string | null) {
    const next = value ?? "all";
    setEstado(next);
    setPage(0);
    void load({ page: 0, estado: next });
  }

  function handleTemperaturaChange(value: string | null) {
    const next = value ?? "all";
    setTemperatura(next);
    setPage(0);
    void load({ page: 0, temperatura: next });
  }

  function handleIntencionChange(value: string | null) {
    const next = value ?? "all";
    setIntencion(next);
    setPage(0);
    void load({ page: 0, intencion: next });
  }

  function handleRequiereHumanoChange(value: string | null) {
    const next = value ?? "all";
    setRequiereHumano(next);
    setPage(0);
    void load({ page: 0, requiereHumano: next });
  }

  function handleDestacadoChange(value: string | null) {
    const next = value ?? "all";
    setDestacado(next);
    setPage(0);
    void load({ page: 0, destacado: next });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    void load({ page: nextPage });
  }

  async function analyzeAll() {
    setAnalyzingAll(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      toast.success(
        `Analizados: ${data.analizados ?? 0}${
          data.mensaje ? ` (${data.mensaje})` : ""
        }`
      );
      await load();
    } catch {
      toast.error("No se pudo correr el analisis.");
    } finally {
      setAnalyzingAll(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const topOpportunities = [...items]
    .filter(
      (item) =>
        item.destacado ||
        item.requiereHumano ||
        item.temperatura === "caliente" ||
        item.oportunidadScore >= 7
    )
    .sort((a, b) => {
      const destacadoDelta = Number(b.destacado) - Number(a.destacado);
      if (destacadoDelta) return destacadoDelta;
      return b.oportunidadScore - a.oportunidadScore;
    })
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-2xl shadow-slate-900/10 dark:border-white/10">
        <div className="relative p-6 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(45,212,191,0.22),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(251,191,36,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#111827_100%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/15">
                  <Signal className="mr-1.5 h-3 w-3" />
                  Live cada {POLL_INTERVAL_MS / 1000}s
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white">
                  {channelStatus?.channel ?? "YCloud + Chatwoot"}
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white">
                  {channelStatus?.n8nWebhookConfigured ? "n8n conectado" : "n8n pendiente"}
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white">
                  {channelStatus?.whatsappNumber || "numero por YCloud"}
                </Badge>
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Prospeccion diaria, sin perder conversaciones
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Primero ves que hacer hoy. Despues revisas leads, pipeline y patrones.
                El CRM mide; Chatwoot conversa; YCloud entrega WhatsApp.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-300">
                <span>Ultima sync: {lastSyncAt ? format(lastSyncAt, "HH:mm:ss") : "inicial"}</span>
                {channelStatus?.lastMessage ? (
                  <span>
                    Ultimo mensaje {channelStatus.lastMessage.direccion} de {channelStatus.lastMessage.telefono}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowNewProspect(true)} className="bg-white text-slate-950 hover:bg-slate-200">
                <PlusSquare className="mr-1.5 h-3.5 w-3.5" />
                Nuevo lead
              </Button>
              <Button variant="outline" size="sm" onClick={analyzeAll} disabled={analyzingAll} className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                {analyzingAll ? "Analizando..." : "Analizar todo"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void load()} className="text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-3xl font-black">{kpis.contactosHoy}</p>
              <p className="mt-1 text-xs text-slate-300">contactados hoy</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-3xl font-black">{kpis.respuestasHoy}</p>
              <p className="mt-1 text-xs text-slate-300">respondieron hoy</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-3xl font-black">{kpis.tasa}%</p>
              <p className="mt-1 text-xs text-slate-300">tasa de respuesta</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-3xl font-black">{kpis.oportunidadesAbiertas}</p>
              <p className="mt-1 text-xs text-slate-300">pipeline abierto</p>
            </div>
          </div>
        </div>
      </div>

      <NuevoProspectoDialog
        open={showNewProspect}
        onClose={() => setShowNewProspect(false)}
        onCreated={() => {
          setShowNewProspect(false);
          void load();
          setPipelineRefreshToken((prev) => prev + 1);
        }}
      />

      <DailyCommandCenter
        kpis={kpis}
        topOpportunities={topOpportunities}
        channelStatus={channelStatus}
        lastSyncAt={lastSyncAt}
        onEdit={setEditing}
        onRefresh={() => void load()}
      />

      <KpiCards kpis={kpis} />
      {kpis.serie.some((row) => row.contactos > 0) ? (
        <KpiChart serie={kpis.serie} />
      ) : null}

      <Tabs defaultValue="leads">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
          <TabsTrigger value="leads">
            <Target className="mr-1.5 h-3.5 w-3.5" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="cola">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Cola
          </TabsTrigger>
          <TabsTrigger value="tareas">
            <ListTodo className="mr-1.5 h-3.5 w-3.5" />
            Tareas
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <KanbanSquare className="mr-1.5 h-3.5 w-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="seguimiento">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Seguimiento
          </TabsTrigger>
          <TabsTrigger value="sync">
            <Signal className="mr-1.5 h-3.5 w-3.5" />
            Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Buscar por telefono, negocio o nombre..."
                className="pl-9"
              />
            </div>

            <Select value={estado} onValueChange={handleEstadoChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ESTADO_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ESTADO_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={temperatura} onValueChange={handleTemperaturaChange}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda temperatura</SelectItem>
                {TEMPERATURA_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TEMPERATURA_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={intencion} onValueChange={handleIntencionChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Intencion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda intencion</SelectItem>
                {INTENCION_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {INTENCION_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={requiereHumano} onValueChange={handleRequiereHumanoChange}>
              <SelectTrigger className="w-[175px]">
                <SelectValue placeholder="Humano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Requiere humano</SelectItem>
              </SelectContent>
            </Select>

            <Select value={destacado} onValueChange={handleDestacadoChange}>
              <SelectTrigger className="w-[155px]">
                <SelectValue placeholder="Destacado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Destacados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            {search ||
            estado !== "all" ||
            temperatura !== "all" ||
            intencion !== "all" ||
            requiereHumano !== "all" ||
            destacado !== "all"
              ? `${totalFiltered} resultado${totalFiltered !== 1 ? "s" : ""}`
              : `${totalGlobal} prospectos`}
            {totalPages > 1 ? ` - pagina ${page + 1} de ${totalPages}` : ""}
          </p>

          <ProspectoTable
            items={items}
            onEdit={setEditing}
            onRefresh={() => void load()}
            onDelete={(id) => {
              setItems((prev) => prev.filter((item) => item.id !== id));
              setPipelineRefreshToken((prev) => prev + 1);
            }}
            onEstadoChange={(id, nextEstado) => {
              setItems((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, estado: nextEstado } : item
                )
              );
              setPipelineRefreshToken((prev) => prev + 1);
            }}
            loading={loading}
          />

          {totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <div className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="cola" className="mt-4">
          <ColaDiariaPanel />
        </TabsContent>

        <TabsContent value="tareas" className="mt-4">
          <TareasDelDiaPanel />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Pipeline Kanban</h2>
              <p className="text-xs text-muted-foreground">
                Arrastra cada lead segun el momento comercial en el que esta.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPipelineRefreshToken((prev) => prev + 1)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refrescar tablero
            </Button>
          </div>

          <ProspectingKanbanBoard compact refreshToken={pipelineRefreshToken} />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <AgendadosView onEdit={setEditing} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent value="seguimiento" className="mt-4">
          <SeguimientoPanel />
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <SyncStatusPanel />
        </TabsContent>
      </Tabs>

      <EditarProspectoDialog
        prospect={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void load();
          setPipelineRefreshToken((prev) => prev + 1);
        }}
      />
    </div>
  );
}
