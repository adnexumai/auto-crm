"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Clock, Flame, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/paths";
import { ScoreBadge } from "./ScoreBadge";

interface ProspectoResumen {
  id: string;
  telefono: string;
  nombreContacto: string;
  negocio: string | null;
  estado: string;
  respondio: boolean;
  oportunidadScore: number;
  ultimoContacto: string | Date;
  fechaAgendado: string | Date | null;
  resumenIa: string;
  crmDealId: string | null;
}

interface Grupos {
  urgentes: ProspectoResumen[];
  contactarHoy: ProspectoResumen[];
  hotSinRespuesta: ProspectoResumen[];
  enSeguimiento: ProspectoResumen[];
}

function extractNextStep(resumen: string): string | null {
  const m = resumen.match(/PRÓXIMO PASO:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function ProspectoCard({
  p,
  onContactado,
}: {
  p: ProspectoResumen;
  onContactado: (id: string) => void;
}) {
  const [marking, setMarking] = useState(false);
  const nombre = p.negocio || p.nombreContacto || p.telefono;
  const nextStep = extractNextStep(p.resumenIa);

  async function marcarContactado() {
    setMarking(true);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${p.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "contactado" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${nombre} marcado como contactado`);
      onContactado(p.id);
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <ScoreBadge score={p.oportunidadScore} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{nombre}</p>
        <p className="text-xs text-muted-foreground font-mono">{p.telefono}</p>
        {nextStep && (
          <p className="text-xs text-primary mt-0.5 truncate">→ {nextStep}</p>
        )}
        {p.fechaAgendado && (
          <p className="text-xs font-medium text-green-600 mt-0.5">
            📅 {format(new Date(p.fechaAgendado), "dd/MM HH:mm")}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Último contacto:{" "}
          {formatDistanceToNow(new Date(p.ultimoContacto), {
            addSuffix: true,
            locale: es,
          })}
        </p>
      </div>
      {p.estado !== "contactado" && p.estado !== "cerrado_positivo" && (
        <Button
          size="sm"
          variant="outline"
          onClick={marcarContactado}
          disabled={marking}
          className="h-7 text-[11px] shrink-0 cursor-pointer"
        >
          {marking ? "..." : "Contactado ✓"}
        </Button>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  icono,
  color,
  items,
  onContactado,
}: {
  titulo: string;
  icono: React.ReactNode;
  color: string;
  items: ProspectoResumen[];
  onContactado: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
        {icono}
        {titulo} ({items.length})
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <ProspectoCard key={p.id} p={p} onContactado={onContactado} />
        ))}
      </div>
    </div>
  );
}

export function SeguimientoPanel() {
  const [grupos, setGrupos] = useState<Grupos | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/seguimiento"));
      if (res.ok) setGrupos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function quitarDeGrupos(id: string) {
    if (!grupos) return;
    setGrupos({
      urgentes: grupos.urgentes.filter((p) => p.id !== id),
      contactarHoy: grupos.contactarHoy.filter((p) => p.id !== id),
      hotSinRespuesta: grupos.hotSinRespuesta.filter((p) => p.id !== id),
      enSeguimiento: grupos.enSeguimiento.filter((p) => p.id !== id),
    });
  }

  const total = grupos
    ? grupos.urgentes.length +
      grupos.contactarHoy.length +
      grupos.hotSinRespuesta.length +
      grupos.enSeguimiento.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Por contactar hoy</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? "Cargando..." : total === 0 ? "Todo al día 🎉" : `${total} prospectos necesitan atención`}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={cargar} disabled={loading} className="cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!loading && grupos && total === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-sm font-medium">Todo al día</p>
          <p className="text-xs mt-1">No hay prospectos que necesiten atención ahora.</p>
        </div>
      )}

      {grupos && (
        <div className="space-y-6">
          <Seccion
            titulo="Urgente — Llamada agendada"
            icono={<AlertCircle className="w-4 h-4" />}
            color="text-red-500"
            items={grupos.urgentes}
            onContactado={quitarDeGrupos}
          />
          <Seccion
            titulo="Contactar hoy"
            icono={<Clock className="w-4 h-4" />}
            color="text-yellow-500"
            items={grupos.contactarHoy}
            onContactado={quitarDeGrupos}
          />
          <Seccion
            titulo="Hot sin respuesta"
            icono={<Flame className="w-4 h-4" />}
            color="text-orange-500"
            items={grupos.hotSinRespuesta}
            onContactado={quitarDeGrupos}
          />
          <Seccion
            titulo="En seguimiento"
            icono={<TrendingUp className="w-4 h-4" />}
            color="text-blue-500"
            items={grupos.enSeguimiento}
            onContactado={quitarDeGrupos}
          />
        </div>
      )}
    </div>
  );
}
