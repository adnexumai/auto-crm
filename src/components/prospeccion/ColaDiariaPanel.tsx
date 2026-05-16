"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withBasePath } from "@/lib/paths";

interface QueueItem {
  id: number;
  telefono: string;
  nombre: string;
  negocio: string;
  score: number;
  estado: string;
  prioridad: "urgente" | "alta" | "media" | "baja";
  razon: string;
  diasSinContacto: number;
  ultimoMensaje: string;
}

interface QueueStats {
  total: number;
  urgentes: number;
  alta: number;
  media: number;
  baja: number;
}

interface QueueData {
  generadoEn: string;
  cola: QueueItem[];
  stats: QueueStats;
}

const PRIORIDAD_CONFIG = {
  urgente: {
    color: "bg-red-500 text-white hover:bg-red-500",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    icon: AlertCircle,
    label: "URGENTE",
  },
  alta: {
    color: "bg-orange-500 text-white hover:bg-orange-500",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    icon: Zap,
    label: "ALTA",
  },
  media: {
    color: "bg-sky-500 text-white hover:bg-sky-500",
    border: "border-sky-500/20",
    bg: "bg-sky-500/5",
    icon: Clock,
    label: "MEDIA",
  },
  baja: {
    color: "bg-gray-400 text-white hover:bg-gray-400",
    border: "border-border",
    bg: "",
    icon: ChevronDown,
    label: "BAJA",
  },
} as const;

function QueueCard({
  item,
  onOpenWhatsApp,
}: {
  item: QueueItem;
  onOpenWhatsApp: (telefono: string) => void;
}) {
  const config = PRIORIDAD_CONFIG[item.prioridad];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border ${config.border} ${config.bg} p-4 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge className={`${config.color} text-[10px]`}>
              <Icon className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
            {item.score > 0 && (
              <Badge variant="outline" className="text-[10px]">
                score {item.score}/10
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {item.estado}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-bold">
            {item.nombre}
          </p>
          {item.negocio && item.negocio !== item.nombre && (
            <p className="text-xs text-muted-foreground">{item.negocio}</p>
          )}
          <p className="mt-1 text-xs text-foreground/70">{item.razon}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-medium">
            {item.diasSinContacto}d sin contacto
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => onOpenWhatsApp(item.telefono)}
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => {
                window.open(`https://chatwoot.adnexum.net`, "_blank");
              }}
              title="Abrir Chatwoot"
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-xl bg-muted/40 p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Ultimo mensaje:</p>
          <p className="mt-1 text-xs leading-5 text-foreground/80">
            {item.ultimoMensaje}
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {item.telefono}
          </p>
        </div>
      )}
    </div>
  );
}

export function ColaDiariaPanel() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "urgente" | "alta" | "media" | "baja">("all");

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/cola-diaria"));
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
  }, []);

  function openWhatsApp(telefono: string) {
    const clean = telefono.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Armando cola del dia...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No se pudo cargar la cola diaria.
      </div>
    );
  }

  const { cola, stats } = data;
  const filtered = filter === "all" ? cola : cola.filter((i) => i.prioridad === filter);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-xl bg-red-500/10 p-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.urgentes}</p>
              <p className="text-[10px] text-muted-foreground">urgentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-xl bg-orange-500/10 p-2">
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.alta}</p>
              <p className="text-[10px] text-muted-foreground">alta</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-xl bg-sky-500/10 p-2">
              <Clock className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.media}</p>
              <p className="text-[10px] text-muted-foreground">media</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-xl bg-muted p-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.baja}</p>
              <p className="text-[10px] text-muted-foreground">baja</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["all", "urgente", "alta", "media", "baja"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `Todos (${stats.total})` : f}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchQueue}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refrescar
        </Button>
      </div>

      {/* Queue */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((item) => (
            <QueueCard key={item.id} item={item} onOpenWhatsApp={openWhatsApp} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No hay leads en esta prioridad.</p>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Generado: {new Date(data.generadoEn).toLocaleString("es-AR")} - Top 30 leads
      </p>
    </div>
  );
}
