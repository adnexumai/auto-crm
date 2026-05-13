import { desc } from "drizzle-orm";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { ConversationsClient } from "@/components/conversations/ConversationsClient";
import type { ConversationProspectListItem } from "@/components/conversations/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 150;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedId =
    typeof resolvedSearchParams?.prospect === "string"
      ? resolvedSearchParams.prospect
      : null;

  const rows = await db
    .select({
      id: prospectos.id,
      telefono: prospectos.telefono,
      nombreContacto: prospectos.nombreContacto,
      negocio: prospectos.negocio,
      rubro: prospectos.rubro,
      estado: prospectos.estado,
      oportunidadScore: prospectos.oportunidadScore,
      mensajesEnviados: prospectos.mensajesEnviados,
      ultimoContacto: prospectos.ultimoContacto,
      fechaAgendado: prospectos.fechaAgendado,
      crmDealId: prospectos.crmDealId,
      chatwootConversationId: prospectos.chatwootConversationId,
    })
    .from(prospectos)
    .orderBy(desc(prospectos.ultimoContacto))
    .limit(PAGE_SIZE);

  const initialProspects: ConversationProspectListItem[] = rows.map((row) => ({
    ...row,
    ultimoContacto: row.ultimoContacto.toISOString(),
    fechaAgendado: row.fechaAgendado?.toISOString() ?? null,
  }));

  return (
    <ConversationsClient
      initialProspects={initialProspects}
      initialSelectedId={selectedId}
    />
  );
}
