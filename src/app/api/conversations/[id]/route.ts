import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deals, pipelineStages, prospectos, prospectosMensajes } from "@/db/schema";
import {
  buildChatwootAppUrl,
  buildChatwootProxyUrl,
  getChatwootConversation,
  getChatwootConversationLabels,
  getChatwootConversationMessages,
  getChatwootFrameDiagnostics,
  resolveChatwootConversationByPhone,
} from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toChatwootIsoDate(value: number | null | undefined) {
  if (!value) return null;
  const normalized = value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isOutgoingMessageType(value: string | number) {
  return value === 1 || value === "outgoing";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [prospect] = await db
    .select()
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!prospect) {
    return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
  }

  const [localMessages, dealContext, frameDiagnostics] = await Promise.all([
    db
      .select({
        id: prospectosMensajes.id,
        direccion: prospectosMensajes.direccion,
        tipo: prospectosMensajes.tipo,
        contenido: prospectosMensajes.contenido,
        transcripcion: prospectosMensajes.transcripcion,
        mediaUrl: prospectosMensajes.mediaUrl,
        nombreContacto: prospectosMensajes.nombreContacto,
        timestamp: prospectosMensajes.timestamp,
      })
      .from(prospectosMensajes)
      .where(eq(prospectosMensajes.telefono, prospect.telefono))
      .orderBy(asc(prospectosMensajes.timestamp)),
    prospect.crmDealId
      ? db
          .select({
            id: deals.id,
            title: deals.title,
            value: deals.value,
            probability: deals.probability,
            stageName: pipelineStages.name,
          })
          .from(deals)
          .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
          .where(eq(deals.id, prospect.crmDealId))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    getChatwootFrameDiagnostics(),
  ]);

  const existingConversationId = prospect.chatwootConversationId || null;
  let resolvedConversationId: string | null = existingConversationId;
  let chatwootLabels: string[] = [];
  let chatwootStatus: string | null = null;
  let assigneeName: string | null = null;
  let remoteMessages: Array<{
    id: number;
    content: string | null;
    contentType: string;
    createdAt: string | null;
    isOutgoing: boolean;
    isPrivate: boolean;
    senderName: string;
    senderType: string;
    attachments: Array<{
      id?: number;
      fileType?: string;
      dataUrl?: string;
    }>;
  }> = [];
  let fetchError: string | null = null;
  let needsRelink = false;

  try {
    let conversation = existingConversationId
      ? await getChatwootConversation(existingConversationId)
      : null;

    if (!conversation) {
      const resolved = await resolveChatwootConversationByPhone(prospect.telefono);
      if (resolved.conversationId) {
        resolvedConversationId = String(resolved.conversationId);
        conversation =
          resolved.conversation ??
          (await getChatwootConversation(resolved.conversationId));
        needsRelink = resolvedConversationId !== existingConversationId;
      }
    }

    if (resolvedConversationId) {
      const [labels, messages] = await Promise.all([
        getChatwootConversationLabels(resolvedConversationId),
        getChatwootConversationMessages(resolvedConversationId),
      ]);

      chatwootLabels = labels;
      remoteMessages = messages.map((message) => ({
        id: message.id,
        content: message.content,
        contentType: message.content_type,
        createdAt: toChatwootIsoDate(message.created_at),
        isOutgoing: isOutgoingMessageType(message.message_type),
        isPrivate: message.private,
        senderName:
          message.sender?.available_name ||
          message.sender?.name ||
          "Sin nombre",
        senderType: message.sender?.type ?? "unknown",
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment.id,
          fileType: attachment.file_type,
          dataUrl: attachment.data_url,
        })),
      }));
    }

    chatwootStatus = conversation?.status ?? null;
    assigneeName = conversation?.assignee?.name ?? null;
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : "No se pudo obtener la conversación de Chatwoot.";
  }

  return NextResponse.json({
    prospect: {
      id: prospect.id,
      telefono: prospect.telefono,
      nombreContacto: prospect.nombreContacto,
      negocio: prospect.negocio,
      rubro: prospect.rubro,
      estado: prospect.estado,
      oportunidadScore: prospect.oportunidadScore,
      mensajesEnviados: prospect.mensajesEnviados,
      ultimoContacto: prospect.ultimoContacto.toISOString(),
      fechaAgendado: toIsoDate(prospect.fechaAgendado),
      crmDealId: prospect.crmDealId,
      chatwootConversationId: prospect.chatwootConversationId,
      notas: prospect.notas,
      resumenIa: prospect.resumenIa,
      nombreDisplay: prospect.negocio || prospect.nombreContacto || prospect.telefono,
    },
    localMessages: localMessages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
    deal: dealContext,
    chatwoot: {
      configured: Boolean(buildChatwootAppUrl()),
      conversationId: existingConversationId,
      resolvedConversationId,
      needsRelink,
      labels: chatwootLabels,
      status: chatwootStatus,
      assigneeName,
      appUrl: buildChatwootAppUrl(resolvedConversationId),
      proxyUrl: buildChatwootProxyUrl(resolvedConversationId),
      directIframeAllowed: frameDiagnostics.directIframeAllowed,
      directIframeReason: frameDiagnostics.reason,
      remoteMessages,
      fetchError,
    },
  });
}
