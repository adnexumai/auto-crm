// Deep prospection analytics — real intelligence, not vanity metrics (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const supabase = getSupabase();
  const now = new Date();

  // ── Parallel data fetching ────────────────────────────────────────
  const [
    prospectosRes,
    mensajesRecientesRes,
    mensajesTotalesRes,
    primerosContactosRes,
  ] = await Promise.all([
    // All prospects
    supabase
      .from("prospectos")
      .select("id, telefono, estado, respondio, oportunidad_score, primer_contacto, ultimo_contacto, mensajes_enviados, nombre_contacto, negocio, resumen_ia")
      .order("primer_contacto", { ascending: false }),

    // Messages from last 30 days for activity analysis
    supabase
      .from("prospectos_mensajes")
      .select("telefono, direccion, tipo, timestamp")
      .gte("timestamp", new Date(now.getTime() - 30 * 86400000).toISOString())
      .order("timestamp", { ascending: true }),

    // Total message count
    supabase
      .from("prospectos_mensajes")
      .select("id", { count: "exact", head: true }),

    // First outbound message per prospect (for response time calc)
    supabase
      .from("prospectos_mensajes")
      .select("telefono, timestamp, direccion, contenido")
      .eq("direccion", "saliente")
      .order("timestamp", { ascending: true })
      .limit(2000),
  ]);

  const prospectos = prospectosRes.data || [];
  const mensajesRecientes = mensajesRecientesRes.data || [];
  const totalMensajes = mensajesTotalesRes.count || 0;
  const mensajesSalientes = primerosContactosRes.data || [];

  // ── 1. Funnel Analysis ────────────────────────────────────────────
  const funnel = {
    total: prospectos.length,
    enviado: 0,
    respondio: 0,
    seguimiento: 0,
    demo_agendada: 0,
    propuesta_enviada: 0,
    cerrado_ganado: 0,
    cerrado_perdido: 0,
    otros: 0,
  };
  for (const p of prospectos) {
    const key = p.estado as keyof typeof funnel;
    if (key in funnel && key !== "total") {
      (funnel[key] as number)++;
    } else if (key !== "total") {
      funnel.otros++;
    }
  }

  const tasaRespuesta = funnel.total > 0
    ? Math.round(((funnel.respondio + funnel.seguimiento + funnel.demo_agendada + funnel.propuesta_enviada + funnel.cerrado_ganado) / funnel.total) * 100)
    : 0;

  // ── 2. Response Time Analysis ─────────────────────────────────────
  // Build map: telefono → first outbound timestamp
  const primerSaliente: Record<string, string> = {};
  for (const m of mensajesSalientes) {
    if (!primerSaliente[m.telefono]) {
      primerSaliente[m.telefono] = m.timestamp;
    }
  }

  // Build map: telefono → first inbound timestamp
  const primerEntrante: Record<string, string> = {};
  const mensajesEntrantes = mensajesRecientes.filter(m => m.direccion === "entrante");
  // Need ALL inbound messages for response time, not just recent — use another approach
  // For now, use primer_contacto → ultimo_contacto delta for responded ones
  const tiemposRespuesta: number[] = [];
  for (const p of prospectos) {
    if (p.respondio && p.primer_contacto && p.ultimo_contacto) {
      const delta = new Date(p.ultimo_contacto).getTime() - new Date(p.primer_contacto).getTime();
      if (delta > 0 && delta < 30 * 86400000) { // Cap at 30 days
        tiemposRespuesta.push(delta);
      }
    }
  }

  const avgResponseTimeHours = tiemposRespuesta.length > 0
    ? Math.round(tiemposRespuesta.reduce((a, b) => a + b, 0) / tiemposRespuesta.length / 3600000 * 10) / 10
    : null;

  const medianResponseTimeHours = tiemposRespuesta.length > 0
    ? (() => {
        const sorted = [...tiemposRespuesta].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        return Math.round(median / 3600000 * 10) / 10;
      })()
    : null;

  // ── 3. Activity by Day of Week & Hour ─────────────────────────────
  const actividadPorDia = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const actividadPorHora = new Array(24).fill(0);
  const respuestasPorDia = [0, 0, 0, 0, 0, 0, 0];
  const enviosPorDia = [0, 0, 0, 0, 0, 0, 0];

  for (const m of mensajesRecientes) {
    const d = new Date(m.timestamp);
    actividadPorDia[d.getUTCDay()]++;
    actividadPorHora[d.getUTCHours()]++;
    if (m.direccion === "entrante") respuestasPorDia[d.getUTCDay()]++;
    if (m.direccion === "saliente") enviosPorDia[d.getUTCDay()]++;
  }

  const diasSemana = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const mejorDiaEnvio = enviosPorDia.indexOf(Math.max(...enviosPorDia));
  const mejorDiaRespuesta = respuestasPorDia.indexOf(Math.max(...respuestasPorDia));

  // Response rate by day
  const tasaPorDia = diasSemana.map((dia, i) => ({
    dia,
    envios: enviosPorDia[i],
    respuestas: respuestasPorDia[i],
    tasa: enviosPorDia[i] > 0 ? Math.round((respuestasPorDia[i] / enviosPorDia[i]) * 100) : 0,
  }));

  // ── 4. Score Distribution ─────────────────────────────────────────
  const scoreDistribucion = { frio: 0, tibio: 0, caliente: 0, sinScore: 0 };
  for (const p of prospectos) {
    const s = p.oportunidad_score ?? 0;
    if (s === 0) scoreDistribucion.sinScore++;
    else if (s <= 3) scoreDistribucion.frio++;
    else if (s <= 6) scoreDistribucion.tibio++;
    else scoreDistribucion.caliente++;
  }

  // ── 5. Stale Leads (respondieron pero sin contacto hace >7 días) ──
  const hace7d = new Date(now.getTime() - 7 * 86400000).toISOString();
  const hace14d = new Date(now.getTime() - 14 * 86400000).toISOString();

  const leadsEnfriandose = prospectos
    .filter(p => p.respondio && p.ultimo_contacto && p.ultimo_contacto < hace7d && p.ultimo_contacto >= hace14d)
    .sort((a, b) => (b.oportunidad_score ?? 0) - (a.oportunidad_score ?? 0))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      telefono: p.telefono,
      nombre: p.nombre_contacto || p.negocio || p.telefono,
      score: p.oportunidad_score,
      diasSinContacto: Math.floor((now.getTime() - new Date(p.ultimo_contacto).getTime()) / 86400000),
    }));

  const leadsMuertos = prospectos
    .filter(p => p.respondio && p.ultimo_contacto && p.ultimo_contacto < hace14d)
    .length;

  // ── 6. Weekly Velocity ────────────────────────────────────────────
  const velocidadSemanal: { semana: string; nuevos: number; respondieron: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const inicioSemana = new Date(now.getTime() - (i + 1) * 7 * 86400000);
    const finSemana = new Date(now.getTime() - i * 7 * 86400000);
    const label = `${inicioSemana.toISOString().slice(5, 10)} - ${finSemana.toISOString().slice(5, 10)}`;

    const nuevos = prospectos.filter(p =>
      p.primer_contacto >= inicioSemana.toISOString() &&
      p.primer_contacto < finSemana.toISOString()
    ).length;

    const respondieron = prospectos.filter(p =>
      p.respondio &&
      p.ultimo_contacto &&
      p.ultimo_contacto >= inicioSemana.toISOString() &&
      p.ultimo_contacto < finSemana.toISOString()
    ).length;

    velocidadSemanal.push({ semana: label, nuevos, respondieron });
  }

  // ── 7. Top Prospects (highest score, not closed) ──────────────────
  const topProspectos = prospectos
    .filter(p => (p.oportunidad_score ?? 0) >= 5 && !p.estado?.startsWith("cerrado"))
    .sort((a, b) => (b.oportunidad_score ?? 0) - (a.oportunidad_score ?? 0))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      telefono: p.telefono,
      nombre: p.nombre_contacto || p.negocio || p.telefono,
      score: p.oportunidad_score,
      estado: p.estado,
      resumen: (p.resumen_ia || "").slice(0, 150),
    }));

  // ── 8. First Message Analysis ─────────────────────────────────────
  // Group first messages by whether the prospect responded
  const primerMensajePorProspecto: Record<string, string> = {};
  for (const m of mensajesSalientes) {
    if (!primerMensajePorProspecto[m.telefono] && m.contenido?.trim()) {
      primerMensajePorProspecto[m.telefono] = m.contenido.slice(0, 200);
    }
  }

  const respondidoSet = new Set(prospectos.filter(p => p.respondio).map(p => p.telefono));
  let msgConRespuesta = 0;
  let msgSinRespuesta = 0;
  const longitudMsgConResp: number[] = [];
  const longitudMsgSinResp: number[] = [];

  for (const [tel, msg] of Object.entries(primerMensajePorProspecto)) {
    if (respondidoSet.has(tel)) {
      msgConRespuesta++;
      longitudMsgConResp.push(msg.length);
    } else {
      msgSinRespuesta++;
      longitudMsgSinResp.push(msg.length);
    }
  }

  const avgLongConResp = longitudMsgConResp.length > 0
    ? Math.round(longitudMsgConResp.reduce((a, b) => a + b, 0) / longitudMsgConResp.length)
    : 0;
  const avgLongSinResp = longitudMsgSinResp.length > 0
    ? Math.round(longitudMsgSinResp.reduce((a, b) => a + b, 0) / longitudMsgSinResp.length)
    : 0;

  // ── Response ──────────────────────────────────────────────────────
  return NextResponse.json({
    generadoEn: now.toISOString(),

    resumen: {
      totalProspectos: funnel.total,
      totalMensajes,
      tasaRespuesta,
      avgResponseTimeHours,
      medianResponseTimeHours,
      prospectosSinAnalisis: prospectos.filter(p => !p.resumen_ia).length,
      leadsCalientes: scoreDistribucion.caliente,
      leadsEnfriandose: leadsEnfriandose.length,
      leadsMuertos,
    },

    funnel,

    tiempoRespuesta: {
      promedioHoras: avgResponseTimeHours,
      medianaHoras: medianResponseTimeHours,
      muestras: tiemposRespuesta.length,
    },

    actividadPorDia: tasaPorDia,
    mejorDiaParaEnviar: diasSemana[mejorDiaEnvio],
    mejorDiaParaRespuestas: diasSemana[mejorDiaRespuesta],
    actividadPorHora: actividadPorHora.map((count, hora) => ({
      hora: `${hora.toString().padStart(2, "0")}:00`,
      mensajes: count,
    })),

    scoreDistribucion,

    velocidadSemanal,

    primerMensaje: {
      totalAnalizados: msgConRespuesta + msgSinRespuesta,
      conRespuesta: msgConRespuesta,
      sinRespuesta: msgSinRespuesta,
      avgLongitudConRespuesta: avgLongConResp,
      avgLongitudSinRespuesta: avgLongSinResp,
      insight: avgLongConResp > 0 && avgLongSinResp > 0
        ? avgLongConResp < avgLongSinResp
          ? `Los mensajes que reciben respuesta son mas cortos (${avgLongConResp} vs ${avgLongSinResp} caracteres). Mensajes concisos funcionan mejor.`
          : `Los mensajes mas largos tienen mejor tasa de respuesta (${avgLongConResp} vs ${avgLongSinResp} caracteres). El contexto ayuda.`
        : "No hay suficientes datos para comparar.",
    },

    leadsEnfriandose,
    topProspectos,
  });
}
