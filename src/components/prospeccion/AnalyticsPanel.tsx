"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Flame,
  Loader2,
  MessageSquare,
  Snowflake,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/paths";

interface FunnelData {
  total: number;
  enviado: number;
  respondio: number;
  seguimiento: number;
  demo_agendada: number;
  propuesta_enviada: number;
  cerrado_ganado: number;
  cerrado_perdido: number;
  otros: number;
}

interface DayActivity {
  dia: string;
  envios: number;
  respuestas: number;
  tasa: number;
}

interface HourActivity {
  hora: string;
  mensajes: number;
}

interface WeekVelocity {
  semana: string;
  nuevos: number;
  respondieron: number;
}

interface StaleLead {
  id: number;
  telefono: string;
  nombre: string;
  score: number;
  diasSinContacto: number;
}

interface TopProspect {
  id: number;
  telefono: string;
  nombre: string;
  score: number;
  estado: string;
  resumen: string;
}

interface AnalyticsData {
  generadoEn: string;
  resumen: {
    totalProspectos: number;
    totalMensajes: number;
    tasaRespuesta: number;
    avgResponseTimeHours: number | null;
    medianResponseTimeHours: number | null;
    prospectosSinAnalisis: number;
    leadsCalientes: number;
    leadsEnfriandose: number;
    leadsMuertos: number;
  };
  funnel: FunnelData;
  tiempoRespuesta: {
    promedioHoras: number | null;
    medianaHoras: number | null;
    muestras: number;
  };
  actividadPorDia: DayActivity[];
  mejorDiaParaEnviar: string;
  mejorDiaParaRespuestas: string;
  actividadPorHora: HourActivity[];
  scoreDistribucion: {
    frio: number;
    tibio: number;
    caliente: number;
    sinScore: number;
  };
  velocidadSemanal: WeekVelocity[];
  primerMensaje: {
    totalAnalizados: number;
    conRespuesta: number;
    sinRespuesta: number;
    avgLongitudConRespuesta: number;
    avgLongitudSinRespuesta: number;
    insight: string;
  };
  leadsEnfriandose: StaleLead[];
  topProspectos: TopProspect[];
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-foreground",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof TrendingUp;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
          {count}
        </span>
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
    </div>
  );
}

function DayHeatmap({ data }: { data: DayActivity[] }) {
  const maxTasa = Math.max(...data.map((d) => d.tasa), 1);
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {data.map((d) => {
        const intensity = d.tasa / maxTasa;
        const bg =
          intensity > 0.7
            ? "bg-emerald-500 text-white"
            : intensity > 0.3
              ? "bg-emerald-200 dark:bg-emerald-900 text-foreground"
              : "bg-muted/60 text-muted-foreground";
        return (
          <div
            key={d.dia}
            className={`rounded-xl p-2.5 text-center transition-colors ${bg}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              {d.dia.slice(0, 3)}
            </p>
            <p className="mt-1 text-lg font-black">{d.tasa}%</p>
            <p className="text-[10px] opacity-70">
              {d.envios}e / {d.respuestas}r
            </p>
          </div>
        );
      })}
    </div>
  );
}

function HourChart({ data }: { data: HourActivity[] }) {
  const max = Math.max(...data.map((h) => h.mensajes), 1);
  // Show only hours 7-23 (work hours)
  const workHours = data.filter((h) => {
    const hour = parseInt(h.hora);
    return hour >= 7 && hour <= 23;
  });

  return (
    <div className="flex items-end gap-0.5" style={{ height: 80 }}>
      {workHours.map((h) => {
        const pct = (h.mensajes / max) * 100;
        return (
          <div
            key={h.hora}
            className="group relative flex-1"
            title={`${h.hora}: ${h.mensajes} mensajes`}
          >
            <div
              className="mx-auto w-full max-w-3 rounded-t bg-teal-500/70 transition-colors group-hover:bg-teal-500"
              style={{ height: `${Math.max(pct, 3)}%` }}
            />
            {parseInt(h.hora) % 3 === 0 && (
              <p className="mt-1 text-center text-[8px] text-muted-foreground">
                {h.hora.slice(0, 2)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VelocityChart({ data }: { data: WeekVelocity[] }) {
  const maxVal = Math.max(...data.flatMap((w) => [w.nuevos, w.respondieron]), 1);
  return (
    <div className="space-y-3">
      {data.map((w) => (
        <div key={w.semana} className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">{w.semana}</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 rounded bg-sky-500/70"
                  style={{ width: `${(w.nuevos / maxVal) * 100}%`, minWidth: 4 }}
                />
                <span className="text-xs font-bold">{w.nuevos}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 rounded bg-emerald-500/70"
                  style={{ width: `${(w.respondieron / maxVal) * 100}%`, minWidth: 4 }}
                />
                <span className="text-xs font-bold">{w.respondieron}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-sky-500" /> Nuevos
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> Respondieron
        </span>
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/analytics"));
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Calculando analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">{error || "Sin datos"}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={fetchAnalytics}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { resumen, funnel, actividadPorDia, actividadPorHora, scoreDistribucion, velocidadSemanal, primerMensaje, leadsEnfriandose, topProspectos } = data;

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          label="Tasa respuesta"
          value={`${resumen.tasaRespuesta}%`}
          sub="global historica"
          icon={TrendingUp}
          accent={resumen.tasaRespuesta >= 20 ? "text-emerald-600" : "text-amber-600"}
        />
        <MetricCard
          label="Tiempo respuesta"
          value={resumen.medianResponseTimeHours ? `${resumen.medianResponseTimeHours}h` : "—"}
          sub={resumen.avgResponseTimeHours ? `promedio ${resumen.avgResponseTimeHours}h` : "sin datos"}
          icon={Clock}
          accent="text-sky-600"
        />
        <MetricCard
          label="Total mensajes"
          value={resumen.totalMensajes.toLocaleString()}
          sub={`${resumen.totalProspectos} prospectos`}
          icon={MessageSquare}
        />
        <MetricCard
          label="Leads calientes"
          value={resumen.leadsCalientes}
          sub="score >= 7"
          icon={Flame}
          accent="text-orange-600"
        />
        <MetricCard
          label="Enfriandose"
          value={resumen.leadsEnfriandose}
          sub="7-14 dias sin contacto"
          icon={Snowflake}
          accent="text-blue-500"
        />
        <MetricCard
          label="Sin analisis IA"
          value={resumen.prospectosSinAnalisis}
          sub="pendientes"
          icon={Target}
          accent="text-muted-foreground"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Embudo de conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelBar label="Enviado" count={funnel.enviado} total={funnel.total} />
            <FunnelBar label="Respondio" count={funnel.respondio} total={funnel.total} />
            <FunnelBar label="Seguimiento" count={funnel.seguimiento} total={funnel.total} />
            <FunnelBar label="Demo agendada" count={funnel.demo_agendada} total={funnel.total} />
            <FunnelBar label="Propuesta" count={funnel.propuesta_enviada} total={funnel.total} />
            <FunnelBar label="Ganado" count={funnel.cerrado_ganado} total={funnel.total} />
            <FunnelBar label="Perdido" count={funnel.cerrado_perdido} total={funnel.total} />
          </CardContent>
        </Card>

        {/* Activity by day */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Tasa de respuesta por dia</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                mejor: {data.mejorDiaParaRespuestas}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DayHeatmap data={actividadPorDia} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hour chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actividad por hora (UTC)</CardTitle>
          </CardHeader>
          <CardContent>
            <HourChart data={actividadPorHora} />
          </CardContent>
        </Card>

        {/* Score distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Distribucion de score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Caliente (7-10)", value: scoreDistribucion.caliente, color: "bg-orange-500" },
                { label: "Tibio (4-6)", value: scoreDistribucion.tibio, color: "bg-amber-400" },
                { label: "Frio (1-3)", value: scoreDistribucion.frio, color: "bg-sky-400" },
                { label: "Sin score", value: scoreDistribucion.sinScore, color: "bg-gray-300 dark:bg-gray-600" },
              ].map((item) => {
                const total =
                  scoreDistribucion.caliente + scoreDistribucion.tibio + scoreDistribucion.frio + scoreDistribucion.sinScore;
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                    <span className="flex-1 text-xs">{item.label}</span>
                    <span className="text-sm font-bold">{item.value}</span>
                    <span className="w-8 text-right text-[11px] text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Weekly velocity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Velocidad semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <VelocityChart data={velocidadSemanal} />
          </CardContent>
        </Card>
      </div>

      {/* Message effectiveness + stale leads */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              Efectividad del primer mensaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                <p className="text-2xl font-black text-emerald-600">{primerMensaje.conRespuesta}</p>
                <p className="text-[11px] text-muted-foreground">con respuesta</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-2xl font-black">{primerMensaje.sinRespuesta}</p>
                <p className="text-[11px] text-muted-foreground">sin respuesta</p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs leading-5 text-foreground/80">{primerMensaje.insight}</p>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Long. con resp: {primerMensaje.avgLongitudConRespuesta} chars</span>
              <span>Long. sin resp: {primerMensaje.avgLongitudSinRespuesta} chars</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Snowflake className="h-4 w-4 text-blue-500" />
              Leads enfriandose ({leadsEnfriandose.length})
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Respondieron pero llevan 7-14 dias sin contacto. Se van a perder.
            </p>
          </CardHeader>
          <CardContent>
            {leadsEnfriandose.length > 0 ? (
              <div className="space-y-2">
                {leadsEnfriandose.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lead.nombre}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{lead.telefono}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        score {lead.score}
                      </Badge>
                      <Badge variant="destructive" className="text-[10px]">
                        {lead.diasSinContacto}d
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ningun lead se esta enfriando. Bien.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top prospects */}
      {topProspectos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Top oportunidades abiertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {topProspectos.map((p) => (
                <div key={p.id} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold">{p.nombre}</p>
                    <Badge
                      className={
                        p.score >= 8
                          ? "bg-orange-500 text-white"
                          : p.score >= 6
                            ? "bg-amber-500 text-white"
                            : ""
                      }
                    >
                      {p.score}/10
                    </Badge>
                  </div>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {p.estado}
                  </Badge>
                  {p.resumen && (
                    <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {p.resumen}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Generado: {new Date(data.generadoEn).toLocaleString("es-AR")}
      </p>
    </div>
  );
}
