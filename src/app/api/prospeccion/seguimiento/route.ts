// Prospectos que necesitan atención hoy (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const now = new Date();
  const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const campos = "id, telefono, nombre_contacto, negocio, estado, respondio, oportunidad_score, ultimo_contacto, resumen_ia";

  // Respondieron + sin seguimiento en 48h + score >= 6
  const { data: contactarHoy } = await supabase
    .from("prospectos")
    .select(campos)
    .eq("respondio", true)
    .lte("ultimo_contacto", hace48h)
    .not("estado", "like", "cerrado%")
    .gte("oportunidad_score", 6)
    .order("oportunidad_score", { ascending: false })
    .limit(10);

  // Score >= 7, no respondió, no contactado en 24h
  const { data: hotSinRespuesta } = await supabase
    .from("prospectos")
    .select(campos)
    .eq("respondio", false)
    .lte("ultimo_contacto", hace24h)
    .gte("oportunidad_score", 7)
    .not("estado", "like", "cerrado%")
    .order("oportunidad_score", { ascending: false })
    .limit(10);

  // Sin contacto en 48h, no cerrados
  const { data: enSeguimiento } = await supabase
    .from("prospectos")
    .select(campos)
    .lt("ultimo_contacto", hace48h)
    .not("estado", "like", "cerrado%")
    .order("oportunidad_score", { ascending: false })
    .limit(10);

  return NextResponse.json({
    urgentes: [],
    contactarHoy: contactarHoy || [],
    hotSinRespuesta: hotSinRespuesta || [],
    enSeguimiento: enSeguimiento || [],
    totales: {
      urgentes: 0,
      contactarHoy: contactarHoy?.length ?? 0,
      hotSinRespuesta: hotSinRespuesta?.length ?? 0,
      enSeguimiento: enSeguimiento?.length ?? 0,
    },
  });
}
