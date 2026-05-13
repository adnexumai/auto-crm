import Link from "next/link";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { KpiCards } from "@/components/prospeccion/KpiCards";
import { KpiChart } from "@/components/prospeccion/KpiChart";
import { ProspectosCalientes } from "@/components/dashboard/ProspectosCalientes";
import { TareasDelDiaPanel } from "@/components/prospeccion/TareasDelDiaPanel";
import { ProspectingKanbanBoard } from "@/components/prospeccion/ProspectingKanbanBoard";
import {
  PROSPECT_ESTADOS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  getProspectDisplayName,
} from "@/lib/prospecting";
import { and, desc, gte, lte, sql } from "drizzle-orm";

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

async function computeKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [contactosHoyRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos)
    .where(and(gte(prospectos.primerContacto, todayStart), lte(prospectos.primerContacto, todayEnd)));

  const [respuestasHoyRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos)
    .where(
      and(
        gte(prospectos.primerContacto, todayStart),
        lte(prospectos.primerContacto, todayEnd),
        sql`${prospectos.respondio} = 1`
      )
    );

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos);

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

  const desde = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));

  const serieRaw = await db
    .select({
      dia: sql<string>`date(${prospectos.primerContacto}, 'unixepoch', 'localtime')`,
      contactos: sql<number>`count(*)`,
      respuestas: sql<number>`sum(case when ${prospectos.respondio} = 1 then 1 else 0 end)`,
    })
    .from(prospectos)
    .where(gte(prospectos.primerContacto, desde))
    .groupBy(sql`date(${prospectos.primerContacto}, 'unixepoch', 'localtime')`);

  const serieMap = new Map(
    serieRaw.map((row) => [
      row.dia,
      {
        contactos: Number(row.contactos) || 0,
        respuestas: Number(row.respuestas) || 0,
      },
    ])
  );

  const serie = [];
  for (let index = 0; index < 14; index++) {
    const current = new Date(desde.getTime() + index * 24 * 60 * 60 * 1000);
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const row = serieMap.get(key);
    serie.push({
      dia: key,
      contactos: row?.contactos ?? 0,
      respuestas: row?.respuestas ?? 0,
    });
  }

  const contactosHoy = contactosHoyRow?.count ?? 0;
  const respuestasHoy = respuestasHoyRow?.count ?? 0;

  return {
    contactosHoy,
    respuestasHoy,
    tasa: contactosHoy > 0 ? Math.round((respuestasHoy / contactosHoy) * 100) : 0,
    total: totalRow?.count ?? 0,
    calientes: Number(funnelRow?.calientes) || 0,
    tibios: Number(funnelRow?.tibios) || 0,
    requiereHumano: Number(funnelRow?.requiereHumano) || 0,
    destacados: Number(funnelRow?.destacados) || 0,
    oportunidadesAbiertas: Number(funnelRow?.oportunidadesAbiertas) || 0,
    ultimaActividad: lastActivityRow?.ultimoContacto?.toISOString() ?? null,
    serie,
  };
}

export default async function DashboardPage() {
  const [kpis, hotProspects, rows] = await Promise.all([
    computeKpis(),
    db
      .select({
        telefono: prospectos.telefono,
        negocio: prospectos.negocio,
        nombreContacto: prospectos.nombreContacto,
        oportunidadScore: prospectos.oportunidadScore,
        resumenIa: prospectos.resumenIa,
      })
      .from(prospectos)
      .where(sql`${prospectos.oportunidadScore} >= 6 and ${prospectos.resumenIa} != ''`)
      .orderBy(desc(prospectos.oportunidadScore))
      .limit(5),
    db
      .select({
        id: prospectos.id,
        telefono: prospectos.telefono,
        nombreContacto: prospectos.nombreContacto,
        negocio: prospectos.negocio,
        rubro: prospectos.rubro,
        estado: prospectos.estado,
        respondio: prospectos.respondio,
        oportunidadScore: prospectos.oportunidadScore,
        temperatura: prospectos.temperatura,
        intencionesJson: prospectos.intencionesJson,
        proximoPaso: prospectos.proximoPaso,
        requiereHumano: prospectos.requiereHumano,
        destacado: prospectos.destacado,
        resumenIa: prospectos.resumenIa,
        notas: prospectos.notas,
        mensajesEnviados: prospectos.mensajesEnviados,
        ultimoContacto: prospectos.ultimoContacto,
        fechaAgendado: prospectos.fechaAgendado,
        chatwootConversationId: prospectos.chatwootConversationId,
      })
      .from(prospectos)
      .orderBy(desc(prospectos.ultimoContacto)),
  ]);

  const columns = PROSPECT_ESTADOS.map((estado) => ({
    id: estado,
    name: PROSPECT_STATUS_LABELS[estado],
    color: PROSPECT_STATUS_COLORS[estado],
    count: rows.filter((row) => row.estado === estado).length,
    prospects: rows
      .filter((row) => row.estado === estado)
      .map((row) => ({
        ...row,
        displayName: getProspectDisplayName(row),
      })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard comercial</h1>
          <p className="text-muted-foreground">
            Ejecuta tu prospeccion diaria con foco en seguimiento y pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/prospeccion"
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium"
          >
            Abrir prospeccion
          </Link>
          <Link
            href="/pipeline"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Abrir pipeline
          </Link>
        </div>
      </div>

      <KpiCards kpis={kpis} />
      {kpis.serie.some((item) => item.contactos > 0) ? <KpiChart serie={kpis.serie} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TareasDelDiaPanel />
        <div className="space-y-6">
          <ProspectosCalientes prospectos={hotProspects} />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Pipeline resumido</h2>
          <p className="text-xs text-muted-foreground">
            Vista rapida del estado del embudo sobre prospectos reales.
          </p>
        </div>
        <ProspectingKanbanBoard initialColumns={columns} compact />
      </div>
    </div>
  );
}
