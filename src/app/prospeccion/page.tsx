// [FUSION] Portado desde adnexum-os - Página raíz de Prospección (Server Component)
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import { desc, sql, and, gte, lte, eq, inArray } from "drizzle-orm";
import { ProspeccionClient } from "@/components/prospeccion/ProspeccionClient";
import type { Prospecto, Kpis } from "@/components/prospeccion/constants";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

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

async function computeKpis(): Promise<Kpis> {
  const now = new Date();
  const hoyIni = startOfDay(now);
  const hoyFin = endOfDay(now);

  const [contactosHoyRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(prospectos)
    .where(
      and(
        gte(prospectos.primerContacto, hoyIni),
        lte(prospectos.primerContacto, hoyFin)
      )
    );
  const contactosHoy = contactosHoyRow?.c ?? 0;

  const [respuestasHoyRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(prospectos)
    .where(
      and(
        gte(prospectos.primerContacto, hoyIni),
        lte(prospectos.primerContacto, hoyFin),
        eq(prospectos.respondio, true)
      )
    );
  const respuestasHoy = respuestasHoyRow?.c ?? 0;

  const [totalRow] = await db.select({ c: sql<number>`count(*)` }).from(prospectos);
  const total = totalRow?.c ?? 0;

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
      {
        contactos: Number(r.contactos) || 0,
        respuestas: Number(r.respuestas) || 0,
      },
    ])
  );

  const serie: Kpis["serie"] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(hace14.getTime() + i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const row = mapa.get(key);
    serie.push({
      dia: key,
      contactos: row?.contactos ?? 0,
      respuestas: row?.respuestas ?? 0,
    });
  }

  const tasa =
    contactosHoy > 0 ? Math.round((respuestasHoy / contactosHoy) * 100) : 0;

  return {
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
  };
}

export default async function ProspeccionPage() {
  const rows = await db
    .select()
    .from(prospectos)
    .orderBy(desc(prospectos.destacado), desc(prospectos.ultimoContacto))
    .limit(PAGE_SIZE);

  const phones = rows.map((row) => row.telefono);
  const latestByPhone = new Map<string, string>();

  if (phones.length > 0) {
    const messages = await db
      .select({
        telefono: prospectosMensajes.telefono,
        contenido: prospectosMensajes.contenido,
        transcripcion: prospectosMensajes.transcripcion,
      })
      .from(prospectosMensajes)
      .where(inArray(prospectosMensajes.telefono, phones))
      .orderBy(desc(prospectosMensajes.timestamp))
      .limit(phones.length * 8);

    for (const message of messages) {
      if (latestByPhone.has(message.telefono)) continue;
      latestByPhone.set(message.telefono, message.transcripcion || message.contenido);
    }
  }

  const items: Prospecto[] = rows.map((r) => ({
    ...r,
    ultimoMensaje: latestByPhone.get(r.telefono) || "",
    primerContacto: r.primerContacto?.toISOString() ?? new Date().toISOString(),
    ultimoContacto: r.ultimoContacto?.toISOString() ?? new Date().toISOString(),
    ultimoAnalisis: r.ultimoAnalisis?.toISOString() ?? null,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const kpis = await computeKpis();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.18),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)] p-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_55%,#111827_100%)] md:p-6">
      <div className="mx-auto max-w-[1500px]">
      <ProspeccionClient
        initialItems={items}
        initialKpis={kpis}
        initialTotal={kpis.total}
      />
      </div>
    </div>
  );
}
