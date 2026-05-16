// Smart daily prospection queue — prioritized list of who to contact today (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface QueueItem {
  id: number;
  telefono: string;
  nombre: string;
  negocio: string;
  score: number;
  estado: string;
  prioridad: "urgente" | "alta" | "media" | "baja";
  razon: string;
  diasSinContacto: number;
  ultimoMensaje: string;
}

export async function GET() {
  const supabase = getSupabase();
  const now = Date.now();
  const hace24h = new Date(now - 86400000).toISOString();
  const hace48h = new Date(now - 2 * 86400000).toISOString();
  const hace7d = new Date(now - 7 * 86400000).toISOString();
  const hace14d = new Date(now - 14 * 86400000).toISOString();

  // Fetch all active prospects
  const { data: prospectos } = await supabase
    .from("prospectos")
    .select("id, telefono, nombre_contacto, negocio, estado, respondio, oportunidad_score, ultimo_contacto, resumen_ia, notas")
    .not("estado", "like", "cerrado%")
    .neq("estado", "no_interesado")
    .order("oportunidad_score", { ascending: false });

  if (!prospectos?.length) {
    return NextResponse.json({ cola: [], stats: { total: 0 } });
  }

  // Fetch last message per prospect for context
  const telefonos = prospectos.map(p => p.telefono);
  const { data: ultimosMensajes } = await supabase
    .from("prospectos_mensajes")
    .select("telefono, contenido, direccion, timestamp")
    .in("telefono", telefonos.slice(0, 100))
    .order("timestamp", { ascending: false })
    .limit(500);

  // Build last message map
  const ultimoMsg: Record<string, { contenido: string; direccion: string; timestamp: string }> = {};
  for (const m of (ultimosMensajes || [])) {
    if (!ultimoMsg[m.telefono]) {
      ultimoMsg[m.telefono] = m;
    }
  }

  const cola: QueueItem[] = [];

  for (const p of prospectos) {
    const score = p.oportunidad_score ?? 0;
    const diasSinContacto = p.ultimo_contacto
      ? Math.floor((now - new Date(p.ultimo_contacto).getTime()) / 86400000)
      : 999;
    const esDestacado = (p.notas || "").includes("[DESTACADO]");
    const ultimo = ultimoMsg[p.telefono];
    const ultimoFueInbound = ultimo?.direccion === "entrante";

    let prioridad: QueueItem["prioridad"] = "baja";
    let razon = "";

    // ── Priority rules (highest first) ──────────────────────────────

    // URGENTE: Respondieron y no les contestamos (inbound sin reply)
    if (ultimoFueInbound && ultimo.timestamp > hace48h) {
      prioridad = "urgente";
      razon = "Respondio y no le contestaste. Cada hora que pasa pierde interes.";
    }
    // URGENTE: Score alto + no contactaste hace >3 días
    else if (score >= 7 && diasSinContacto >= 3) {
      prioridad = "urgente";
      razon = `Score ${score}/10 pero ${diasSinContacto} dias sin contacto. Se esta enfriando.`;
    }
    // ALTA: Destacado
    else if (esDestacado) {
      prioridad = "alta";
      razon = "Marcado como destacado.";
    }
    // ALTA: Respondio pero sin follow-up hace >2 días
    else if (p.respondio && diasSinContacto >= 2 && diasSinContacto < 7) {
      prioridad = "alta";
      razon = `Respondio pero ${diasSinContacto} dias sin contacto.`;
    }
    // ALTA: Score medio-alto
    else if (score >= 5 && diasSinContacto >= 1) {
      prioridad = "alta";
      razon = `Score ${score}/10. Mantener el momentum.`;
    }
    // MEDIA: Respondio, contacto reciente
    else if (p.respondio && diasSinContacto < 2) {
      prioridad = "media";
      razon = "En conversacion activa.";
    }
    // MEDIA: No respondio pero enviado hace <7 días
    else if (!p.respondio && diasSinContacto < 7) {
      prioridad = "media";
      razon = "Sin respuesta. Considerar segundo intento.";
    }
    // BAJA: No respondio, más de 7 días
    else if (!p.respondio && diasSinContacto >= 7) {
      prioridad = "baja";
      razon = `${diasSinContacto} dias sin respuesta. Considerar archivar.`;
    }
    // BAJA: Respondio pero enfriado
    else if (p.respondio && diasSinContacto >= 7) {
      prioridad = "baja";
      razon = `Lead frio — ${diasSinContacto} dias sin contacto.`;
    }
    else {
      continue; // Skip unclassifiable
    }

    cola.push({
      id: p.id,
      telefono: p.telefono,
      nombre: p.nombre_contacto || p.negocio || p.telefono,
      negocio: p.negocio || "",
      score,
      estado: p.estado,
      prioridad,
      razon,
      diasSinContacto,
      ultimoMensaje: ultimo?.contenido?.slice(0, 120) || "(sin mensajes)",
    });
  }

  // Sort: urgente > alta > media > baja, then by score desc
  const prioridadOrden = { urgente: 0, alta: 1, media: 2, baja: 3 };
  cola.sort((a, b) => {
    const prioDiff = prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
    if (prioDiff !== 0) return prioDiff;
    return b.score - a.score;
  });

  // Stats
  const stats = {
    total: cola.length,
    urgentes: cola.filter(i => i.prioridad === "urgente").length,
    alta: cola.filter(i => i.prioridad === "alta").length,
    media: cola.filter(i => i.prioridad === "media").length,
    baja: cola.filter(i => i.prioridad === "baja").length,
  };

  return NextResponse.json({
    generadoEn: new Date().toISOString(),
    cola: cola.slice(0, 30), // Top 30 for daily work
    stats,
  });
}
