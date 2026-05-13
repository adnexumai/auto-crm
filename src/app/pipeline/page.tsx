import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { ProspectingKanbanBoard } from "@/components/prospeccion/ProspectingKanbanBoard";
import {
  PROSPECT_ESTADOS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  getProspectDisplayName,
} from "@/lib/prospecting";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline de prospeccion</h1>
        <p className="text-muted-foreground">
          Mueve cada lead segun el estado real de la conversacion.
        </p>
      </div>

      <ProspectingKanbanBoard initialColumns={columns} />
    </div>
  );
}
