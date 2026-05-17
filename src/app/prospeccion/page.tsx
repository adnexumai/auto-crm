// Prospección page — Server Component using Supabase via API routes
import { ProspeccionClient } from "@/components/prospeccion/ProspeccionClient";
import type { Kpis, Prospecto } from "@/components/prospeccion/constants";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim()
  || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  || "http://localhost:3000";

function normalizeUrl(base: string): string {
  return base.startsWith("http") ? base : `https://${base}`;
}

async function fetchProspectos(): Promise<{ items: Prospecto[]; total: number }> {
  try {
    const url = `${normalizeUrl(BASE_URL)}/api/prospeccion?pageSize=50`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return {
      items: (data.items || []).map((p: Record<string, unknown>) => ({
        id: p.id,
        telefono: p.telefono || "",
        negocio: p.negocio || "",
        nombreContacto: p.nombreContacto || p.nombre_contacto || "",
        estado: p.estado || "enviado",
        respondio: Boolean(p.respondio),
        oportunidadScore: Number(p.oportunidadScore ?? p.oportunidad_score ?? 0),
        resumenIa: (p.resumenIa || p.resumen_ia || "") as string,
        notas: (p.notas || "") as string,
        temperatura: (p.temperatura || "frio") as string,
        destacado: Boolean(p.destacado),
        requiereHumano: Boolean(p.requiereHumano ?? p.requiere_humano),
        mensajesEnviados: Number(p.mensajesEnviados ?? p.mensajes_enviados ?? 0),
        primerContacto: (p.primerContacto || p.primer_contacto || new Date().toISOString()) as string,
        ultimoContacto: (p.ultimoContacto || p.ultimo_contacto || new Date().toISOString()) as string,
        ultimoAnalisis: (p.ultimoAnalisis || p.ultimo_analisis || null) as string | null,
        siguientePaso: (p.siguientePaso || p.siguiente_paso || "") as string,
        ultimoMensaje: (p.ultimoMensaje || p.ultimo_mensaje || "") as string,
        createdAt: (p.createdAt || new Date().toISOString()) as string,
        updatedAt: (p.updatedAt || new Date().toISOString()) as string,
      })),
      total: Number(data.total || 0),
    };
  } catch (err) {
    console.error("[prospeccion/page] Error fetching prospectos:", err);
    return { items: [], total: 0 };
  }
}

async function fetchKpis(): Promise<Kpis> {
  const defaults: Kpis = {
    contactosHoy: 0,
    respuestasHoy: 0,
    tasa: 0,
    total: 0,
    calientes: 0,
    tibios: 0,
    requiereHumano: 0,
    destacados: 0,
    oportunidadesAbiertas: 0,
    ultimaActividad: null,
    serie: [],
  };

  try {
    const url = `${normalizeUrl(BASE_URL)}/api/prospeccion/kpis`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return {
      contactosHoy: data.contactosHoy ?? 0,
      respuestasHoy: data.respuestasHoy ?? 0,
      tasa: data.tasa ?? 0,
      total: data.total ?? 0,
      totalRespondieron: data.totalRespondieron ?? 0,
      calientes: data.calientes ?? data.leadsCalientes ?? 0,
      tibios: data.tibios ?? 0,
      requiereHumano: data.requiereHumano ?? 0,
      destacados: data.destacados ?? 0,
      oportunidadesAbiertas: data.oportunidadesAbiertas ?? 0,
      ultimaActividad: data.ultimaActividad ?? null,
      serie: data.serie ?? [],
    };
  } catch (err) {
    console.error("[prospeccion/page] Error fetching kpis:", err);
    return defaults;
  }
}

export default async function ProspeccionPage() {
  const [{ items, total }, kpis] = await Promise.all([
    fetchProspectos(),
    fetchKpis(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <ProspeccionClient
        initialItems={items}
        initialKpis={kpis}
        initialTotal={total || kpis.total}
      />
    </div>
  );
}
