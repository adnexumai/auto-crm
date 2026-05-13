// Prospectos que necesitan atención hoy — ordenados por prioridad
import { NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { and, desc, gte, lt, lte, not, like, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const en48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const campos = {
    id: prospectos.id,
    telefono: prospectos.telefono,
    nombreContacto: prospectos.nombreContacto,
    negocio: prospectos.negocio,
    estado: prospectos.estado,
    respondio: prospectos.respondio,
    oportunidadScore: prospectos.oportunidadScore,
    ultimoContacto: prospectos.ultimoContacto,
    fechaAgendado: prospectos.fechaAgendado,
    resumenIa: prospectos.resumenIa,
    crmDealId: prospectos.crmDealId,
  };

  // 🔴 Urgente: agendados en próximas 48h
  const urgentes = await db
    .select(campos)
    .from(prospectos)
    .where(
      and(
        isNotNull(prospectos.fechaAgendado),
        lte(prospectos.fechaAgendado, en48h),
        gte(prospectos.fechaAgendado, now)
      )
    )
    .orderBy(prospectos.fechaAgendado)
    .limit(10);

  // 🟡 Contactar hoy: respondieron + sin seguimiento en 48h + score ≥ 6
  const contactarHoy = await db
    .select(campos)
    .from(prospectos)
    .where(
      and(
        prospectos.respondio,
        lte(prospectos.ultimoContacto, hace48h),
        not(like(prospectos.estado, "cerrado%")),
        gte(prospectos.oportunidadScore, 6)
      )
    )
    .orderBy(desc(prospectos.oportunidadScore))
    .limit(10);

  // 🟠 Hot sin respuesta: score ≥ 7, no respondió, no contactado en 24h
  const hotSinRespuesta = await db
    .select(campos)
    .from(prospectos)
    .where(
      and(
        not(prospectos.respondio),
        lte(prospectos.ultimoContacto, hace24h),
        gte(prospectos.oportunidadScore, 7),
        not(like(prospectos.estado, "cerrado%"))
      )
    )
    .orderBy(desc(prospectos.oportunidadScore))
    .limit(10);

  // 🔵 En seguimiento: promovidos a deal, verificar avance
  const enSeguimiento = await db
    .select(campos)
    .from(prospectos)
    .where(
      and(
        lt(prospectos.ultimoContacto, hace48h),
        not(like(prospectos.estado, "cerrado%"))
      )
    )
    .orderBy(desc(prospectos.oportunidadScore))
    .limit(10);

  return NextResponse.json({
    urgentes,
    contactarHoy,
    hotSinRespuesta,
    enSeguimiento,
    totales: {
      urgentes: urgentes.length,
      contactarHoy: contactarHoy.length,
      hotSinRespuesta: hotSinRespuesta.length,
      enSeguimiento: enSeguimiento.length,
    },
  });
}
