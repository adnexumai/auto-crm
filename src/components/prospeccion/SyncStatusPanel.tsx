"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { withBasePath } from "@/lib/paths";

interface ServiceStatus {
  conectado?: boolean;
  configurado?: boolean;
  health?: boolean;
  ok?: boolean;
  apiOk?: boolean;
  totalProspectos?: number;
  latenciaMs?: number;
  url?: string;
  baseUrl?: string;
  webhookUrl?: string;
  webhookSecretConfigurado?: boolean;
  apiKeyConfigurado?: boolean;
}

interface SyncData {
  timestamp: string;
  sistemaOk: boolean;
  servicios: {
    supabase: ServiceStatus;
    n8n: ServiceStatus;
    vercel: ServiceStatus;
    ycloud: ServiceStatus;
    chatwoot: ServiceStatus;
    openai: ServiceStatus;
  };
  datosFrescos: {
    ultimoMensaje: {
      timestamp: string;
      horasAtras: number;
      direccion: string;
      telefono: string;
    } | null;
    ultimoProspecto: {
      primerContacto: string;
      horasAtras: number;
      nombre: string;
    } | null;
  };
  problemas: string[];
  recomendaciones: string[];
  webhookConfig: {
    nota: string;
    url: string;
    eventosRequeridos: string[];
  };
}

function ServiceCard({
  name,
  ok,
  details,
}: {
  name: string;
  ok: boolean;
  details: { label: string; value: string | number | boolean }[];
}) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-bold">{name}</span>
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] ${ok ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-500"}`}
        >
          {ok ? "online" : "offline"}
        </Badge>
      </div>
      <div className="mt-3 space-y-1">
        {details.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium">
              {typeof d.value === "boolean" ? (d.value ? "Si" : "No") : d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SyncStatusPanel() {
  const [data, setData] = useState<SyncData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/sync-status"));
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Verificando servicios...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No se pudo obtener el estado del sistema.
      </div>
    );
  }

  const { servicios, datosFrescos, problemas, recomendaciones, webhookConfig } = data;

  return (
    <div className="space-y-4">
      {/* System status banner */}
      <div
        className={`rounded-2xl border p-4 ${
          data.sistemaOk
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {data.sistemaOk ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-red-500" />
          )}
          <div>
            <p className="text-sm font-bold">
              {data.sistemaOk ? "Todos los sistemas operativos" : `${problemas.length} problema(s) detectado(s)`}
            </p>
            <p className="text-xs text-muted-foreground">
              Verificado: {new Date(data.timestamp).toLocaleString("es-AR")}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchStatus} className="ml-auto">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Re-verificar
          </Button>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ServiceCard
          name="Supabase"
          ok={Boolean(servicios.supabase.conectado)}
          details={[
            { label: "Prospectos", value: servicios.supabase.totalProspectos ?? 0 },
            { label: "Latencia", value: `${servicios.supabase.latenciaMs ?? 0}ms` },
          ]}
        />
        <ServiceCard
          name="n8n"
          ok={Boolean(servicios.n8n.health)}
          details={[
            { label: "Configurado", value: Boolean(servicios.n8n.configurado) },
            { label: "Latencia", value: `${servicios.n8n.latenciaMs ?? 0}ms` },
          ]}
        />
        <ServiceCard
          name="Vercel API"
          ok={Boolean(servicios.vercel.apiOk)}
          details={[
            { label: "Latencia", value: `${servicios.vercel.latenciaMs ?? 0}ms` },
          ]}
        />
        <ServiceCard
          name="YCloud"
          ok={Boolean(servicios.ycloud.apiKeyConfigurado)}
          details={[
            { label: "API Key", value: Boolean(servicios.ycloud.apiKeyConfigurado) },
            { label: "Webhook Secret", value: Boolean(servicios.ycloud.webhookSecretConfigurado) },
          ]}
        />
        <ServiceCard
          name="Chatwoot"
          ok={Boolean(servicios.chatwoot.configurado)}
          details={[
            { label: "Configurado", value: Boolean(servicios.chatwoot.configurado) },
            { label: "URL", value: servicios.chatwoot.baseUrl || "—" },
          ]}
        />
        <ServiceCard
          name="OpenAI"
          ok={Boolean(servicios.openai.configurado)}
          details={[
            { label: "API Key", value: Boolean(servicios.openai.configurado) },
          ]}
        />
      </div>

      {/* Data freshness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Server className="h-4 w-4" />
            Frescura de datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ultimo mensaje
              </p>
              {datosFrescos.ultimoMensaje ? (
                <div className="mt-2">
                  <p className="text-sm font-bold">{datosFrescos.ultimoMensaje.telefono}</p>
                  <p className="text-xs text-muted-foreground">
                    {datosFrescos.ultimoMensaje.direccion} - hace{" "}
                    {datosFrescos.ultimoMensaje.horasAtras}h
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(datosFrescos.ultimoMensaje.timestamp).toLocaleString("es-AR")}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sin datos</p>
              )}
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ultimo prospecto nuevo
              </p>
              {datosFrescos.ultimoProspecto ? (
                <div className="mt-2">
                  <p className="text-sm font-bold">{datosFrescos.ultimoProspecto.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    hace {datosFrescos.ultimoProspecto.horasAtras}h
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sin datos</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problems & recommendations */}
      {(problemas.length > 0 || recomendaciones.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {problemas.length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  Problemas ({problemas.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {problemas.map((p, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      - {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {recomendaciones.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Recomendaciones ({recomendaciones.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {recomendaciones.map((r, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      - {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Webhook config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuracion webhook YCloud</CardTitle>
          <p className="text-[11px] text-muted-foreground">{webhookConfig.nota}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
            <code className="flex-1 text-xs font-medium break-all">{webhookConfig.url}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(webhookConfig.url);
                toast.success("URL copiada");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {webhookConfig.eventosRequeridos.map((e) => (
              <Badge key={e} variant="outline" className="text-[10px]">
                {e}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
