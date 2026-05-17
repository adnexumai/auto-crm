"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Flame,
  Loader2,
  RefreshCw,
  Snowflake,
  Sparkles,
  Star,
  Thermometer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/paths";
import { ScoreBadge } from "./ScoreBadge";
import {
  ESTADO_LABEL,
  ESTADO_ORDER,
  type Prospecto,
} from "./constants";

interface Props {
  phone: string;
  onClose: () => void;
}

const TEMPERATURA_ICON = {
  caliente: Flame,
  tibio: Thermometer,
  frio: Snowflake,
} as const;

const TEMPERATURA_COLOR = {
  caliente: "text-orange-500",
  tibio: "text-amber-500",
  frio: "text-sky-500",
} as const;

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function ProspectoSidebar({ phone, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [prospecto, setProspecto] = useState<Prospecto | null>(null);
  const [updating, setUpdating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const phoneDigits = digitsOnly(phone);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        withBasePath(`/api/prospeccion?search=${encodeURIComponent(phoneDigits)}&pageSize=5`)
      );
      if (res.ok) {
        const data = await res.json();
        const match = (data.items || []).find(
          (p: Prospecto) => digitsOnly(p.telefono) === phoneDigits
        );
        setProspecto(match || null);
      }
    } finally {
      setLoading(false);
    }
  }, [phoneDigits]);

  useEffect(() => {
    if (phoneDigits) load();
  }, [phoneDigits, load]);

  async function updateField(field: string, value: unknown) {
    if (!prospecto) return;
    setUpdating(true);
    const optimistic = { ...prospecto, [field]: value };
    setProspecto(optimistic);
    try {
      const res = await fetch(
        withBasePath(`/api/prospeccion/${prospecto.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Actualizado");
    } catch {
      setProspecto(prospecto);
      toast.error("No se pudo actualizar");
    } finally {
      setUpdating(false);
    }
  }

  async function analyze() {
    if (!prospecto) return;
    setAnalyzing(true);
    try {
      const res = await fetch(withBasePath("/api/prospeccion/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: prospecto.telefono, force: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Análisis lanzado");
      // Reload after a brief moment
      setTimeout(() => void load(), 2000);
    } catch {
      toast.error("No se pudo analizar");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <aside className="flex h-full w-full flex-col border-l bg-card/30">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Prospecto
          </p>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </aside>
    );
  }

  if (!prospecto) {
    return (
      <aside className="flex h-full w-full flex-col border-l bg-card/30">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Prospecto
          </p>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-xs text-muted-foreground">
          <p>Este número no está en el CRM.</p>
          <p className="mt-1 text-[11px] opacity-70">{phone}</p>
        </div>
      </aside>
    );
  }

  // Derive temperature from score so it stays consistent with the conversation
  // list — the prospectos table doesn't have a stored temperatura column.
  const score = prospecto.oportunidadScore || 0;
  const tempKey: keyof typeof TEMPERATURA_ICON =
    score >= 7 ? "caliente" : score >= 4 ? "tibio" : "frio";
  const TempIcon = TEMPERATURA_ICON[tempKey] || Snowflake;

  return (
    <aside className="flex h-full w-full min-h-0 flex-col overflow-hidden border-l bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Prospecto
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={load}
            disabled={updating}
            title="Refrescar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {/* Identity */}
        <div>
          <p className="font-bold leading-tight">
            {prospecto.negocio || prospecto.nombreContacto || "Sin nombre"}
          </p>
          {prospecto.nombreContacto && prospecto.negocio && (
            <p className="text-xs text-muted-foreground">{prospecto.nombreContacto}</p>
          )}
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {prospecto.telefono}
          </p>
        </div>

        {/* Score + Temp + Star */}
        <div className="flex items-center gap-2">
          <ScoreBadge score={prospecto.oportunidadScore} />
          <Badge variant="outline" className="gap-1 text-[10px]">
            <TempIcon className={`h-3 w-3 ${TEMPERATURA_COLOR[tempKey] || ""}`} />
            {tempKey}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 w-7 p-0"
            onClick={() => updateField("destacado", !prospecto.destacado)}
            disabled={updating}
            title={prospecto.destacado ? "Quitar destacado" : "Destacar"}
          >
            <Star
              className={`h-4 w-4 ${
                prospecto.destacado ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
              }`}
            />
          </Button>
        </div>

        {/* Estado select */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Estado
          </label>
          <Select
            value={prospecto.estado}
            onValueChange={(v) => updateField("estado", v)}
            disabled={updating}
          >
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_ORDER.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {ESTADO_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Requiere humano flag */}
        {prospecto.requiereHumano && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Marcado como atención humana</span>
          </div>
        )}

        {/* Próximo paso */}
        {prospecto.proximoPaso && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Próximo paso
            </p>
            <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs leading-relaxed">
              {prospecto.proximoPaso}
            </p>
          </div>
        )}

        {/* Resumen IA */}
        {prospecto.resumenIa && (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Resumen IA
            </p>
            <p className="mt-1 line-clamp-4 rounded-lg bg-muted/40 p-2 text-xs leading-relaxed">
              {prospecto.resumenIa}
            </p>
          </div>
        )}

        {/* Notas manuales */}
        {prospecto.notas && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Notas
            </p>
            <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs leading-relaxed">
              {prospecto.notas}
            </p>
          </div>
        )}

        {/* Compact meta line */}
        <p className="border-t pt-2 text-[10px] text-muted-foreground">
          {prospecto.mensajesEnviados} mensajes
          {prospecto.ultimoAnalisis && (
            <span> · análisis {format(new Date(prospecto.ultimoAnalisis), "dd MMM", { locale: es })}</span>
          )}
        </p>
      </div>

      {/* Footer action — single button */}
      <div className="border-t p-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-center text-[11px]"
          onClick={analyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3 w-3" />
          )}
          {analyzing ? "Analizando…" : "Re-analizar con IA"}
        </Button>
      </div>
    </aside>
  );
}
