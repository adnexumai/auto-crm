// Tareas de prospección derivadas del estado actual (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DAILY_PROSPECTING_GOAL = 15;

export async function GET() {
  const supabase = getSupabase();
  const now = new Date();
  const hoy = now.toISOString().split("T")[0];
  const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [newTodayRes, overdueRes, hotRes, openRes] = await Promise.all([
    supabase
      .from("prospectos")
      .select("id, telefono, nombre_contacto, negocio, estado, oportunidad_score, resumen_ia, ultimo_contacto")
      .gte("primer_contacto", `${hoy}T00:00:00.000Z`)
      .lte("primer_contacto", `${hoy}T23:59:59.999Z`)
      .eq("estado", "enviado")
      .order("primer_contacto", { ascending: false })
      .limit(8),
    supabase
      .from("prospectos")
      .select("id, telefono, nombre_contacto, negocio, estado, oportunidad_score, resumen_ia, ultimo_contacto")
      .not("estado", "like", "cerrado%")
      .lte("ultimo_contacto", hace48h)
      .order("oportunidad_score", { ascending: false })
      .limit(12),
    supabase
      .from("prospectos")
      .select("id, telefono, nombre_contacto, negocio, estado, oportunidad_score, resumen_ia, ultimo_contacto")
      .not("estado", "like", "cerrado%")
      .gte("oportunidad_score", 7)
      .lte("ultimo_contacto", hace24h)
      .order("oportunidad_score", { ascending: false })
      .limit(8),
    supabase
      .from("prospectos")
      .select("id", { count: "exact", head: true })
      .not("estado", "like", "cerrado%"),
  ]);

  const suggestions = [
    ...(newTodayRes.data || []).map((item) => ({
      id: `nuevo-${item.id}`,
      prospectId: item.id,
      priority: "high",
      kind: "nuevo",
      title: `Primer contacto: ${item.negocio || item.nombre_contacto || item.telefono}`,
      subtitle: "Enviar primer mensaje de prospeccion",
      dueLabel: "Hoy",
      estado: item.estado,
      score: item.oportunidad_score,
    })),
    ...(overdueRes.data || []).map((item) => ({
      id: `followup-${item.id}`,
      prospectId: item.id,
      priority: "medium",
      kind: "seguimiento",
      title: `Seguimiento: ${item.negocio || item.nombre_contacto || item.telefono}`,
      subtitle: "Sin tocar hace mas de 48h",
      dueLabel: "Pendiente",
      estado: item.estado,
      score: item.oportunidad_score,
    })),
    ...(hotRes.data || []).map((item) => ({
      id: `hot-${item.id}`,
      prospectId: item.id,
      priority: "medium",
      kind: "hot",
      title: `Lead caliente: ${item.negocio || item.nombre_contacto || item.telefono}`,
      subtitle: `Score ${item.oportunidad_score}. No dejar enfriar.`,
      dueLabel: "Prioridad",
      estado: item.estado,
      score: item.oportunidad_score,
    })),
  ].slice(0, 18);

  return NextResponse.json({
    stats: {
      dailyGoal: DAILY_PROSPECTING_GOAL,
      newToday: newTodayRes.data?.length ?? 0,
      scheduledToday: 0,
      overdueFollowUps: overdueRes.data?.length ?? 0,
      hotLeads: hotRes.data?.length ?? 0,
      activePipeline: openRes.count ?? 0,
    },
    suggestions,
  });
}
