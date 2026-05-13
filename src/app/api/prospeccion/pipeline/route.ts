import { NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import {
  PROSPECT_ESTADOS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  getProspectDisplayName,
} from "@/lib/prospecting";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
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
    .orderBy(desc(prospectos.ultimoContacto));

  const columns = PROSPECT_ESTADOS.map((estado) => {
    const items = rows
      .filter((row) => row.estado === estado)
      .map((row) => ({
        ...row,
        displayName: getProspectDisplayName(row),
      }));

    return {
      id: estado,
      name: PROSPECT_STATUS_LABELS[estado],
      color: PROSPECT_STATUS_COLORS[estado],
      count: items.length,
      prospects: items,
    };
  });

  return NextResponse.json({ columns });
}
