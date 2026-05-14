// KPIs de prospección (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const now = new Date();

  // Today range
  const hoyStr = now.toISOString().split("T")[0];
  const hoyIni = `${hoyStr}T00:00:00.000Z`;
  const hoyFin = `${hoyStr}T23:59:59.999Z`;

  // Parallel queries
  const [
    contactosHoyRes,
    respuestasHoyRes,
    totalRes,
    respondieronRes,
    serieRes,
  ] = await Promise.all([
    // Contactos creados hoy
    supabase
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .gte("primer_contacto", hoyIni)
      .lte("primer_contacto", hoyFin),

    // Respuestas hoy
    supabase
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .gte("primer_contacto", hoyIni)
      .lte("primer_contacto", hoyFin)
      .eq("respondio", true),

    // Total prospectos
    supabase
      .from("prospectos")
      .select("id", { count: "exact", head: true }),

    // Total que respondieron
    supabase
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .eq("respondio", true),

    // Serie últimos 14 días (todos los prospectos con fecha)
    supabase
      .from("prospectos")
      .select("primer_contacto, respondio")
      .gte(
        "primer_contacto",
        new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] + "T00:00:00.000Z"
      )
      .order("primer_contacto", { ascending: true }),
  ]);

  const contactosHoy = contactosHoyRes.count ?? 0;
  const respuestasHoy = respuestasHoyRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const totalRespondieron = respondieronRes.count ?? 0;

  // Build 14-day series from raw data
  const hace14 = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  const serieMap = new Map<string, { contactos: number; respuestas: number }>();

  for (const row of serieRes.data || []) {
    const dia = row.primer_contacto
      ? new Date(row.primer_contacto).toISOString().split("T")[0]
      : null;
    if (!dia) continue;
    const existing = serieMap.get(dia) || { contactos: 0, respuestas: 0 };
    existing.contactos += 1;
    if (row.respondio) existing.respuestas += 1;
    serieMap.set(dia, existing);
  }

  const serie: Array<{ dia: string; contactos: number; respuestas: number }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(hace14.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    const row = serieMap.get(key);
    serie.push({
      dia: key,
      contactos: row?.contactos ?? 0,
      respuestas: row?.respuestas ?? 0,
    });
  }

  const tasa =
    contactosHoy > 0 ? Math.round((respuestasHoy / contactosHoy) * 100) : 0;

  // Get last activity
  const { data: lastRow } = await supabase
    .from("prospectos")
    .select("ultimo_contacto")
    .order("ultimo_contacto", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    contactosHoy,
    respuestasHoy,
    tasa,
    total,
    totalRespondieron,
    oportunidadesAbiertas: total - totalRespondieron,
    ultimaActividad: lastRow?.ultimo_contacto ?? null,
    serie,
  });
}
