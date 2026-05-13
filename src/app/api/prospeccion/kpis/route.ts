// [FUSION] KPIs de prospección: contactos/respuestas hoy + serie últimos 14 días
import { NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { sql, and, desc, gte, lte, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET() {
  const now = new Date();
  const hoyIni = startOfDay(now);
  const hoyFin = endOfDay(now);

  const [contactosHoyRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos)
    .where(
      and(
        gte(prospectos.primerContacto, hoyIni),
        lte(prospectos.primerContacto, hoyFin)
      )
    );
  const contactosHoy = contactosHoyRow?.count ?? 0;

  const [respuestasHoyRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos)
    .where(
      and(
        gte(prospectos.primerContacto, hoyIni),
        lte(prospectos.primerContacto, hoyFin),
        eq(prospectos.respondio, true)
      )
    );
  const respuestasHoy = respuestasHoyRow?.count ?? 0;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos);
  const total = totalRow?.count ?? 0;

  const [funnelRow] = await db
    .select({
      calientes: sql<number>`sum(case when ${prospectos.temperatura} = 'caliente' then 1 else 0 end)`,
      tibios: sql<number>`sum(case when ${prospectos.temperatura} = 'tibio' then 1 else 0 end)`,
      requiereHumano: sql<number>`sum(case when ${prospectos.requiereHumano} = 1 then 1 else 0 end)`,
      destacados: sql<number>`sum(case when ${prospectos.destacado} = 1 then 1 else 0 end)`,
      oportunidadesAbiertas: sql<number>`sum(case when ${prospectos.estado} not in ('cerrado_positivo', 'cerrado_negativo') then 1 else 0 end)`,
    })
    .from(prospectos);

  const [lastActivityRow] = await db
    .select({ ultimoContacto: prospectos.ultimoContacto })
    .from(prospectos)
    .orderBy(desc(prospectos.ultimoContacto))
    .limit(1);

  const hace14 = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));

  // Turso/libSQL es SQLite-compatible: date('unixepoch') funciona igual
  const serieRaw = await db
    .select({
      dia: sql<string>`date(${prospectos.primerContacto}, 'unixepoch', 'localtime')`,
      contactos: sql<number>`count(*)`,
      respuestas: sql<number>`sum(case when ${prospectos.respondio} = 1 then 1 else 0 end)`,
    })
    .from(prospectos)
    .where(gte(prospectos.primerContacto, hace14))
    .groupBy(sql`date(${prospectos.primerContacto}, 'unixepoch', 'localtime')`);

  const mapa = new Map(
    serieRaw.map((r) => [
      r.dia,
      { contactos: Number(r.contactos) || 0, respuestas: Number(r.respuestas) || 0 },
    ])
  );
  const serie: Array<{ dia: string; contactos: number; respuestas: number }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(hace14.getTime() + i * 24 * 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const row = mapa.get(key);
    serie.push({
      dia: key,
      contactos: row?.contactos ?? 0,
      respuestas: row?.respuestas ?? 0,
    });
  }

  const tasa = contactosHoy > 0 ? Math.round((respuestasHoy / contactosHoy) * 100) : 0;

  return NextResponse.json({
    contactosHoy,
    respuestasHoy,
    tasa,
    total,
    calientes: Number(funnelRow?.calientes) || 0,
    tibios: Number(funnelRow?.tibios) || 0,
    requiereHumano: Number(funnelRow?.requiereHumano) || 0,
    destacados: Number(funnelRow?.destacados) || 0,
    oportunidadesAbiertas: Number(funnelRow?.oportunidadesAbiertas) || 0,
    ultimaActividad: lastActivityRow?.ultimoContacto?.toISOString() ?? null,
    serie,
  });
}
