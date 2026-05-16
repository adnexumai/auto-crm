// Bulk actions + smart state management for prospection (Supabase)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Valid estado transitions
const ESTADOS_VALIDOS = [
  "enviado",
  "respondio",
  "seguimiento",
  "demo_agendada",
  "propuesta_enviada",
  "negociacion",
  "cerrado_ganado",
  "cerrado_perdido",
  "no_interesado",
] as const;

type Estado = typeof ESTADOS_VALIDOS[number];

// POST: Bulk actions
export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  let body: {
    accion: string;
    ids?: number[];
    estado?: string;
    filtro?: { estado?: string; score_min?: number; dias_sin_contacto?: number };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  switch (body.accion) {
    // ── Cambiar estado en bulk ─────────────────────────────────────
    case "cambiar_estado": {
      if (!body.ids?.length || !body.estado) {
        return NextResponse.json({ error: "ids[] y estado requeridos" }, { status: 400 });
      }
      if (!ESTADOS_VALIDOS.includes(body.estado as Estado)) {
        return NextResponse.json({
          error: `Estado invalido. Opciones: ${ESTADOS_VALIDOS.join(", ")}`,
        }, { status: 400 });
      }

      const { error, count } = await supabase
        .from("prospectos")
        .update({ estado: body.estado })
        .in("id", body.ids);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, actualizados: count });
    }

    // ── Marcar para análisis IA (resetear ultimo_analisis) ────────
    case "re_analizar": {
      if (!body.ids?.length) {
        return NextResponse.json({ error: "ids[] requerido" }, { status: 400 });
      }

      const { error, count } = await supabase
        .from("prospectos")
        .update({ ultimo_analisis: null, resumen_ia: "" })
        .in("id", body.ids);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, marcados: count });
    }

    // ── Marcar destacados ─────────────────────────────────────────
    case "destacar": {
      if (!body.ids?.length) {
        return NextResponse.json({ error: "ids[] requerido" }, { status: 400 });
      }

      // Toggle: set notas with [DESTACADO] tag since column might not exist
      for (const id of body.ids) {
        const { data } = await supabase
          .from("prospectos")
          .select("notas")
          .eq("id", id)
          .single();

        const notas = data?.notas || "";
        const yaDestacado = notas.includes("[DESTACADO]");
        const nuevasNotas = yaDestacado
          ? notas.replace("[DESTACADO]", "").trim()
          : `[DESTACADO]\n${notas}`.trim();

        await supabase
          .from("prospectos")
          .update({ notas: nuevasNotas })
          .eq("id", id);
      }

      return NextResponse.json({ success: true, procesados: body.ids.length });
    }

    // ── Auto-clasificar leads sin analisis ─────────────────────────
    case "analizar_pendientes": {
      const { data: sinAnalisis } = await supabase
        .from("prospectos")
        .select("id, telefono")
        .eq("respondio", true)
        .or("resumen_ia.is.null,resumen_ia.eq.")
        .order("oportunidad_score", { ascending: false })
        .limit(body.filtro?.score_min ? 50 : 20);

      if (!sinAnalisis?.length) {
        return NextResponse.json({ message: "Todos los prospectos ya fueron analizados" });
      }

      // Trigger analysis for each (fire-and-forget)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
      if (!baseUrl) {
        return NextResponse.json({ error: "APP_URL no configurada" }, { status: 500 });
      }

      const normalized = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
      let triggered = 0;

      for (const p of sinAnalisis) {
        fetch(`${normalized}/api/prospeccion/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefono: p.telefono, force: true }),
        }).catch(() => {});
        triggered++;
      }

      return NextResponse.json({
        success: true,
        mensaje: `${triggered} prospectos enviados a análisis IA`,
        ids: sinAnalisis.map(p => p.id),
      });
    }

    // ── Limpiar leads muertos (>30 días sin contacto, no respondieron) ─
    case "archivar_muertos": {
      const hace30d = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: muertos, count } = await supabase
        .from("prospectos")
        .update({ estado: "cerrado_perdido" })
        .eq("respondio", false)
        .lt("ultimo_contacto", hace30d)
        .eq("estado", "enviado")
        .select("id, telefono, nombre_contacto");

      return NextResponse.json({
        success: true,
        archivados: count || 0,
        prospectos: (muertos || []).map(p => ({
          id: p.id,
          nombre: p.nombre_contacto || p.telefono,
        })),
      });
    }

    default:
      return NextResponse.json({
        error: "Accion no reconocida",
        acciones_disponibles: [
          "cambiar_estado",
          "re_analizar",
          "destacar",
          "analizar_pendientes",
          "archivar_muertos",
        ],
      }, { status: 400 });
  }
}

// GET: Available states and stats
export async function GET() {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("prospectos")
    .select("estado, respondio, resumen_ia, oportunidad_score, ultimo_contacto")
    .limit(500);

  const rows = data || [];
  const now = Date.now();
  const hace30d = now - 30 * 86400000;

  return NextResponse.json({
    estadosDisponibles: ESTADOS_VALIDOS,
    stats: {
      total: rows.length,
      sinAnalisis: rows.filter(r => !r.resumen_ia).length,
      sinResponder: rows.filter(r => !r.respondio).length,
      muertos30d: rows.filter(r =>
        !r.respondio &&
        r.ultimo_contacto &&
        new Date(r.ultimo_contacto).getTime() < hace30d
      ).length,
      calientes: rows.filter(r => (r.oportunidad_score ?? 0) >= 7).length,
    },
  });
}
