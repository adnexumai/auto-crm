"use client";

import { useState } from "react";
import { Check, Loader2, Zap, ChevronDown, ChevronUp, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/paths";
import type { Prospecto } from "./constants";

interface Paso {
  id: string;
  label: string;
  completado: boolean;
  contenido: string;
}

const PASOS_DEFAULT: Paso[] = [
  { id: "conciencia", label: "🧠 Elevar conciencia", completado: false, contenido: "" },
  { id: "doc_ab", label: "📄 Documento A→B", completado: false, contenido: "" },
  { id: "agendar", label: "📅 Agendar llamada", completado: false, contenido: "" },
  { id: "recordatorio", label: "📨 Recordatorio pre-llamada", completado: false, contenido: "" },
  { id: "descubrimiento", label: "🔍 Guión de descubrimiento", completado: false, contenido: "" },
  { id: "analisis_preventa", label: "💰 Análisis A→B pre-venta", completado: false, contenido: "" },
  { id: "llamada_venta", label: "🤝 Llamada de venta (PsycoSelling)", completado: false, contenido: "" },
  { id: "contrato", label: "✍️ Contrato enviado", completado: false, contenido: "" },
];

const PASOS_CON_IA = new Set(["conciencia", "doc_ab", "recordatorio", "descubrimiento", "analisis_preventa"]);

// Pasos que tienen audio pregrabado disponible → audioKey del endpoint send-audio
const PASOS_CON_AUDIO: Record<string, { audioKey: string; label: string }> = {
  conciencia: { audioKey: "servicio", label: "Audio servicio" },
  agendar: { audioKey: "bienvenida", label: "Audio bienvenida" },
  recordatorio: { audioKey: "recordatorio", label: "Audio recordatorio" },
  contrato: { audioKey: "post_llamada", label: "Audio seguimiento" },
};

function parsePasos(raw: string): Paso[] {
  if (!raw) return PASOS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Paso[];
    // Merge con defaults para agregar pasos nuevos si los hay
    return PASOS_DEFAULT.map((def) => {
      const saved = parsed.find((p) => p.id === def.id);
      return saved ?? def;
    });
  } catch {
    return PASOS_DEFAULT;
  }
}

interface Props {
  prospect: Prospecto;
}

export function ProcesoVentas({ prospect }: Props) {
  const [pasos, setPasos] = useState<Paso[]>(() => parsePasos(prospect.procesoVentas || ""));
  const [generando, setGenerando] = useState<string | null>(null);
  const [enviandoAudio, setEnviandoAudio] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const completados = pasos.filter((p) => p.completado).length;
  const progreso = Math.round((completados / pasos.length) * 100);

  async function guardar(nuevosPasos: Paso[]) {
    setSaving(true);
    try {
      await fetch(withBasePath(`/api/prospeccion/${prospect.id}/proceso`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasos: nuevosPasos }),
      });
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function toggleCompletado(pasoId: string) {
    const nuevos = pasos.map((p) =>
      p.id === pasoId ? { ...p, completado: !p.completado } : p
    );
    setPasos(nuevos);
    guardar(nuevos);
  }

  async function enviarAudio(pasoId: string) {
    const audioInfo = PASOS_CON_AUDIO[pasoId];
    if (!audioInfo) return;
    setEnviandoAudio(pasoId);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}/send-audio`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioKey: audioInfo.audioKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      toast.success(`Audio "${audioInfo.label}" enviado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar audio");
    } finally {
      setEnviandoAudio(null);
    }
  }

  async function generarContenido(pasoId: string) {
    setGenerando(pasoId);
    setExpandido(pasoId);
    try {
      const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}/proceso`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paso: pasoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const nuevos = pasos.map((p) =>
        p.id === pasoId ? { ...p, contenido: data.contenido } : p
      );
      setPasos(nuevos);
      guardar(nuevos);
      toast.success("Contenido generado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar");
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Barra de progreso */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
          {completados}/{pasos.length} {saving && "· guardando..."}
        </span>
      </div>

      {/* Lista de pasos */}
      <div className="space-y-1.5">
        {pasos.map((paso) => {
          const estaExpandido = expandido === paso.id;
          const tieneIA = PASOS_CON_IA.has(paso.id);
          const tieneAudio = paso.id in PASOS_CON_AUDIO;
          const cargando = generando === paso.id;
          const enviandoEsteAudio = enviandoAudio === paso.id;

          return (
            <div
              key={paso.id}
              className={cn(
                "rounded-lg border transition-colors",
                paso.completado ? "bg-green-500/5 border-green-500/20" : "bg-card"
              )}
            >
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Checkbox */}
                <button
                  onClick={() => toggleCompletado(paso.id)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                    paso.completado
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-muted-foreground/30 hover:border-primary"
                  )}
                >
                  {paso.completado && <Check className="w-3 h-3" />}
                </button>

                {/* Label */}
                <span
                  className={cn(
                    "text-sm flex-1",
                    paso.completado && "line-through text-muted-foreground"
                  )}
                >
                  {paso.label}
                </span>

                {/* Acciones */}
                <div className="flex items-center gap-1">
                  {tieneAudio && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => enviarAudio(paso.id)}
                      disabled={enviandoEsteAudio || !!enviandoAudio}
                      title={PASOS_CON_AUDIO[paso.id]?.label}
                      className="h-6 px-2 text-[10px] text-orange-500 hover:text-orange-600 cursor-pointer"
                    >
                      {enviandoEsteAudio ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><Mic className="w-3 h-3 mr-0.5" />Audio</>
                      )}
                    </Button>
                  )}
                  {tieneIA && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => generarContenido(paso.id)}
                      disabled={cargando}
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary cursor-pointer"
                    >
                      {cargando ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><Zap className="w-3 h-3 mr-0.5" />Generar</>
                      )}
                    </Button>
                  )}
                  {paso.contenido && (
                    <button
                      onClick={() => setExpandido(estaExpandido ? null : paso.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {estaExpandido ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Contenido expandido */}
              {estaExpandido && paso.contenido && (
                <div className="px-10 pb-3 pr-3">
                  <div className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/40 rounded-lg p-3 leading-relaxed">
                    {paso.contenido}
                  </div>
                  <button
                    onClick={() => generarContenido(paso.id)}
                    disabled={!!generando}
                    className="mt-1.5 text-[10px] text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                  >
                    Regenerar con IA
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
