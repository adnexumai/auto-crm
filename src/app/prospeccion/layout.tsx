// Shared layout for /prospeccion/* — header + tabs nav
import type { ReactNode } from "react";
import type { Kpis } from "@/components/prospeccion/constants";
import { ProspeccionShell } from "@/components/prospeccion/ProspeccionShell";

export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  "http://localhost:3000";

function normalizeUrl(base: string): string {
  return base.startsWith("http") ? base : `https://${base}`;
}

async function fetchKpis(): Promise<Kpis> {
  const defaults: Kpis = {
    contactosHoy: 0,
    respuestasHoy: 0,
    tasa: 0,
    total: 0,
    totalRespondieron: 0,
    oportunidadesAbiertas: 0,
    ultimaActividad: null,
    serie: [],
  };
  try {
    const res = await fetch(`${normalizeUrl(BASE_URL)}/api/prospeccion/kpis`, {
      cache: "no-store",
    });
    if (!res.ok) return defaults;
    const data = await res.json();
    return {
      contactosHoy: data.contactosHoy ?? 0,
      respuestasHoy: data.respuestasHoy ?? 0,
      tasa: data.tasa ?? 0,
      total: data.total ?? 0,
      totalRespondieron: data.totalRespondieron ?? 0,
      oportunidadesAbiertas: data.oportunidadesAbiertas ?? 0,
      ultimaActividad: data.ultimaActividad ?? null,
      serie: data.serie ?? [],
    };
  } catch {
    return defaults;
  }
}

export default async function ProspeccionLayout({
  children,
}: {
  children: ReactNode;
}) {
  const kpis = await fetchKpis();

  return (
    <div className="mx-auto max-w-[1500px]">
      <ProspeccionShell kpis={kpis}>{children}</ProspeccionShell>
    </div>
  );
}
