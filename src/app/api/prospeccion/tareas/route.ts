import { NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import {
  DAILY_PROSPECTING_GOAL,
  extractNextStepFromSummary,
  getProspectDisplayName,
} from "@/lib/prospecting";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export async function GET() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const baseFields = {
    id: prospectos.id,
    telefono: prospectos.telefono,
    nombreContacto: prospectos.nombreContacto,
    negocio: prospectos.negocio,
    rubro: prospectos.rubro,
    estado: prospectos.estado,
    temperatura: prospectos.temperatura,
    requiereHumano: prospectos.requiereHumano,
    destacado: prospectos.destacado,
    proximoPaso: prospectos.proximoPaso,
    oportunidadScore: prospectos.oportunidadScore,
    resumenIa: prospectos.resumenIa,
    ultimoContacto: prospectos.ultimoContacto,
    fechaAgendado: prospectos.fechaAgendado,
    notas: prospectos.notas,
  };

  const [newTodayRows, meetingsTodayRows, overdueRows, hotRows, openRows] =
    await Promise.all([
      db
        .select(baseFields)
        .from(prospectos)
        .where(
          and(
            gte(prospectos.primerContacto, todayStart),
            lte(prospectos.primerContacto, todayEnd),
            eq(prospectos.estado, "enviado")
          )
        )
        .orderBy(desc(prospectos.createdAt))
        .limit(8),
      db
        .select(baseFields)
        .from(prospectos)
        .where(
          and(
            eq(prospectos.estado, "agendado"),
            gte(prospectos.fechaAgendado, todayStart),
            lte(prospectos.fechaAgendado, todayEnd)
          )
        )
        .orderBy(prospectos.fechaAgendado)
        .limit(8),
      db
        .select(baseFields)
        .from(prospectos)
        .where(
          and(
            sql`${prospectos.estado} not in ('cerrado_positivo', 'cerrado_negativo')`,
            lte(prospectos.ultimoContacto, fortyEightHoursAgo)
          )
        )
        .orderBy(desc(prospectos.oportunidadScore))
        .limit(12),
      db
        .select(baseFields)
        .from(prospectos)
        .where(
          and(
            sql`${prospectos.estado} not in ('cerrado_positivo', 'cerrado_negativo')`,
            or(
              gte(prospectos.oportunidadScore, 7),
              eq(prospectos.temperatura, "caliente"),
              eq(prospectos.requiereHumano, true),
              eq(prospectos.destacado, true)
            ),
            lte(prospectos.ultimoContacto, twentyFourHoursAgo)
          )
        )
        .orderBy(desc(prospectos.oportunidadScore))
        .limit(8),
      db
        .select({ count: sql<number>`count(*)` })
        .from(prospectos)
        .where(sql`${prospectos.estado} not in ('cerrado_positivo', 'cerrado_negativo')`),
    ]);

  const [activePipelineRow] = openRows;

  const suggestions = [
    ...newTodayRows.map((item) => ({
      id: `nuevo-${item.id}`,
      prospectId: item.id,
      priority: "high" as const,
      kind: "nuevo" as const,
      title: `Primer contacto: ${getProspectDisplayName(item)}`,
      subtitle: item.rubro
        ? `Rubro sugerido: ${item.rubro}`
        : "Completa el rubro o la web para mejorar el enfoque.",
      dueLabel: "Hoy",
      estado: item.estado,
      score: item.oportunidadScore,
      nextStep:
        extractNextStepFromSummary(item.resumenIa) ||
        item.proximoPaso ||
        "Enviar el primer mensaje o audio de prospeccion.",
    })),
    ...meetingsTodayRows.map((item) => ({
      id: `agendado-${item.id}`,
      prospectId: item.id,
      priority: "high" as const,
      kind: "reunion" as const,
      title: `Reunion de hoy: ${getProspectDisplayName(item)}`,
      subtitle: item.fechaAgendado
        ? `Hora pactada: ${new Date(item.fechaAgendado).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "Revisar horario",
      dueLabel: "Hoy",
      estado: item.estado,
      score: item.oportunidadScore,
      nextStep:
        extractNextStepFromSummary(item.resumenIa) ||
        item.proximoPaso ||
        "Confirmar asistencia y preparar los puntos de la llamada.",
    })),
    ...overdueRows.map((item) => ({
      id: `followup-${item.id}`,
      prospectId: item.id,
      priority: "medium" as const,
      kind: "seguimiento" as const,
      title: `Seguimiento pendiente: ${getProspectDisplayName(item)}`,
      subtitle: item.rubro
        ? `Sin tocar hace mas de 48h. Rubro: ${item.rubro}`
        : "Sin tocar hace mas de 48h.",
      dueLabel: "Pendiente",
      estado: item.estado,
      score: item.oportunidadScore,
      nextStep:
        extractNextStepFromSummary(item.resumenIa) ||
        item.proximoPaso ||
        "Definir siguiente paso y moverlo en el pipeline.",
    })),
    ...hotRows.map((item) => ({
      id: `hot-${item.id}`,
      prospectId: item.id,
      priority: "medium" as const,
      kind: "hot" as const,
      title: `Lead caliente: ${getProspectDisplayName(item)}`,
      subtitle: item.destacado
        ? `Destacado manual. Score ${item.oportunidadScore}.`
        : `Score ${item.oportunidadScore}. No dejar enfriar.`,
      dueLabel: "Prioridad",
      estado: item.estado,
      score: item.oportunidadScore,
      nextStep:
        extractNextStepFromSummary(item.resumenIa) ||
        item.proximoPaso ||
        "Volver a tocar con una propuesta o siguiente accion concreta.",
    })),
  ].slice(0, 18);

  return NextResponse.json({
    stats: {
      dailyGoal: DAILY_PROSPECTING_GOAL,
      newToday: newTodayRows.length,
      scheduledToday: meetingsTodayRows.length,
      overdueFollowUps: overdueRows.length,
      hotLeads: hotRows.length,
      activePipeline: activePipelineRow?.count ?? 0,
    },
    suggestions,
  });
}
