"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  KanbanSquare,
  ListChecks,
  PlusSquare,
  RefreshCw,
  Search,
  Settings2,
  Target,
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
import { ChatwootInbox } from "./ChatwootInbox";
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

function AgendadosView({ onEdit }: { onEdit: (prospect: Prospecto) => void }) {
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
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Prospecto | null>(null);
  const [showNewProspect, setShowNewProspect] = useState(false);
  const [pipelineToken, setPipelineToken] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (
      opts: {
        page?: number;
        search?: string;
        estado?: string;
        temperatura?: string;
        intencion?: string;
        silent?: boolean;
      } = {}
    ) => {
      const nextPage = opts.page ?? page;
      const nextSearch = opts.search ?? search;
      const nextEstado = opts.estado ?? estado;
      const nextTemp = opts.temperatura ?? temperatura;
      const nextInt = opts.intencion ?? intencion;

      if (!opts.silent) setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(PAGE_SIZE),
        });
        if (nextSearch) params.set("search", nextSearch);
        if (nextEstado !== "all") params.set("estado", nextEstado);
        if (nextTemp !== "all") params.set("temperatura", nextTemp);
        if (nextInt !== "all") params.set("intencion", nextInt);

        const [listRes, kpiRes] = await Promise.all([
          fetch(withBasePath(`/api/prospeccion?${params}`)),
          fetch(withBasePath("/api/prospeccion/kpis")),
        ]);

        if (listRes.ok) {
          const data = await listRes.json();
          setItems(data.items || []);
          setTotalFiltered(data.total || 0);
          setTotalGlobal(data.totalGlobal || 0);
        }
        if (kpiRes.ok) setKpis(await kpiRes.json());
        setLastSync(new Date());
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [estado, intencion, page, search, temperatura]
  );

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void load({ page: 0, search: value });
    }, 350);
  }

  function handleFilter(field: "estado" | "temperatura" | "intencion", value: string | null) {
    const next = value ?? "all";
    setPage(0);
    if (field === "estado") {
      setEstado(next);
      void load({ page: 0, estado: next });
    }
    if (field === "temperatura") {
      setTemperatura(next);
      void load({ page: 0, temperatura: next });
    }
    if (field === "intencion") {
      setIntencion(next);
      void load({ page: 0, intencion: next });
    }
  }

  function goToPage(n: number) {
    setPage(n);
    void load({ page: n });
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const isFiltered =
    Boolean(search) ||
    estado !== "all" ||
    temperatura !== "all" ||
    intencion !== "all";

  return (
    <div className="space-y-5">
      {/* Header minimalista */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Prospección</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalGlobal} prospectos
            {lastSync ? ` · sync ${format(lastSync, "HH:mm:ss")}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowNewProspect(true)}>
            <PlusSquare className="mr-1.5 h-3.5 w-3.5" />
            Nuevo lead
          </Button>
        </div>
      </header>

      {/* KPIs en una sola fila */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        <StatPill label="Hoy" value={kpis.contactosHoy} />
        <StatPill label="Respuestas" value={kpis.respuestasHoy} />
        <StatPill label="Tasa" value={`${kpis.tasa ?? 0}%`} />
        <StatPill label="Pipeline" value={kpis.oportunidadesAbiertas} />
        <StatPill label="Respondieron" value={kpis.totalRespondieron} />
        <StatPill label="Total" value={totalGlobal} />
      </div>

      <NuevoProspectoDialog
        open={showNewProspect}
        onClose={() => setShowNewProspect(false)}
        onCreated={() => {
          setShowNewProspect(false);
          void load();
          setPipelineToken((p) => p + 1);
        }}
      />

      {/* 5 tabs limpios */}
      <Tabs defaultValue="inbox">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inbox">
            <Inbox className="mr-1.5 h-3.5 w-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="leads">
            <Target className="mr-1.5 h-3.5 w-3.5" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <KanbanSquare className="mr-1.5 h-3.5 w-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="hoy">
            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            Hoy
          </TabsTrigger>
          <TabsTrigger value="sistema">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* INBOX — Chatwoot nativo */}
        <TabsContent value="inbox" className="mt-4">
          <ChatwootInbox />
        </TabsContent>

        {/* LEADS — tabla principal con filtros */}
        <TabsContent value="leads" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar por teléfono, negocio o nombre..."
                className="pl-9"
              />
            </div>

            <Select value={estado} onValueChange={(v) => handleFilter("estado", v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ESTADO_ORDER.map((v) => (
                  <SelectItem key={v} value={v}>
                    {ESTADO_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={temperatura} onValueChange={(v) => handleFilter("temperatura", v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda temperatura</SelectItem>
                {TEMPERATURA_ORDER.map((v) => (
                  <SelectItem key={v} value={v}>
                    {TEMPERATURA_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={intencion} onValueChange={(v) => handleFilter("intencion", v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Intención" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda intención</SelectItem>
                {INTENCION_ORDER.map((v) => (
                  <SelectItem key={v} value={v}>
                    {INTENCION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isFiltered
                ? `${totalFiltered} resultado${totalFiltered !== 1 ? "s" : ""}`
                : `${totalGlobal} prospectos`}
              {totalPages > 1 ? ` · página ${page + 1} de ${totalPages}` : ""}
            </span>
            {isFiltered && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => {
                  setSearch("");
                  setEstado("all");
                  setTemperatura("all");
                  setIntencion("all");
                  setPage(0);
                  void load({
                    page: 0,
                    search: "",
                    estado: "all",
                    temperatura: "all",
                    intencion: "all",
                  });
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <ProspectoTable
            items={items}
            onEdit={setEditing}
            onRefresh={() => void load()}
            onDelete={(id) => {
              setItems((prev) => prev.filter((i) => i.id !== id));
              setPipelineToken((p) => p + 1);
            }}
            onEstadoChange={(id, next) => {
              setItems((prev) =>
                prev.map((i) => (i.id === id ? { ...i, estado: next } : i))
              );
              setPipelineToken((p) => p + 1);
            }}
            loading={loading}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* PIPELINE */}
        <TabsContent value="pipeline" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Arrastrá cada lead según el momento comercial.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPipelineToken((p) => p + 1)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refrescar
            </Button>
          </div>
          <ProspectingKanbanBoard compact refreshToken={pipelineToken} />
        </TabsContent>

        {/* HOY — Cola + Tareas + Agenda + Seguimiento */}
        <TabsContent value="hoy" className="mt-4">
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
        </TabsContent>

        {/* SISTEMA — Analytics + Sync */}
        <TabsContent value="sistema" className="mt-4">
          <Tabs defaultValue="analytics">
            <TabsList className="mb-3 grid w-full grid-cols-2">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="sync">Conexiones</TabsTrigger>
            </TabsList>
            <TabsContent value="analytics">
              <AnalyticsPanel />
            </TabsContent>
            <TabsContent value="sync">
              <SyncStatusPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <EditarProspectoDialog
        prospect={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void load();
          setPipelineToken((p) => p + 1);
        }}
      />
    </div>
  );
}
