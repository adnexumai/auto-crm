// [FUSION] Portado desde adnexum-os - Webhook receptor YCloud WhatsApp (Drizzle + Whisper + n8n)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  verificarFirma,
  extraerContenido,
  extraerMediaUrl,
  postN8n,
} from "@/lib/prospeccion/ycloud";
import { transcribirAudioEnBackground } from "@/lib/prospeccion/whisper";

export const dynamic = "force-dynamic";

function isTrustedForward(req: NextRequest) {
  const forwardedBy = req.headers.get("x-adnexum-forwarded-by");
  if (forwardedBy !== "n8n") return false;

  const configuredSecret = process.env.N8N_FORWARD_SECRET?.trim();
  if (!configuredSecret) return true;

  return req.headers.get("x-adnexum-forward-secret") === configuredSecret;
}

function parseTimestamp(value: string | number | undefined): Date {
  if (!value) return new Date();

  if (typeof value === "number") {
    const normalized = value < 1_000_000_000_000 ? value * 1000 : value;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== "") {
    const normalized = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function ensureProspecto(
  telefono: string,
  nombreContacto?: string,
  activityAt = new Date()
): Promise<void> {
  const [existing] = await db
    .select({ id: prospectos.id, nombreContacto: prospectos.nombreContacto })
    .from(prospectos)
    .where(eq(prospectos.telefono, telefono));

  if (!existing) {
    await db
      .insert(prospectos)
      .values({
        telefono,
        primerContacto: activityAt,
        ultimoContacto: activityAt,
        mensajesEnviados: 0,
        nombreContacto: nombreContacto || "",
        createdAt: activityAt,
        updatedAt: activityAt,
      })
      .onConflictDoNothing({ target: prospectos.telefono });
    return;
  }

  if (nombreContacto && !existing.nombreContacto) {
    await db
      .update(prospectos)
      .set({ nombreContacto, updatedAt: activityAt })
      .where(eq(prospectos.telefono, telefono));
  }
}

async function markOutboundActivity(
  telefono: string,
  activityAt = new Date()
): Promise<void> {
  await db
    .update(prospectos)
    .set({
      mensajesEnviados: sql`${prospectos.mensajesEnviados} + 1`,
      ultimoContacto: activityAt,
      updatedAt: activityAt,
    })
    .where(eq(prospectos.telefono, telefono));
}

async function markInboundActivity(
  telefono: string,
  nombreContacto?: string,
  activityAt = new Date()
): Promise<void> {
  await db
    .update(prospectos)
    .set({
      respondio: true,
      estado: "respondio",
      ultimoContacto: activityAt,
      updatedAt: activityAt,
      ...(nombreContacto ? { nombreContacto } : {}),
    })
    .where(eq(prospectos.telefono, telefono));
}

async function getProspectoByPhone(telefono: string) {
  const [row] = await db
    .select({
      id: prospectos.id,
      telefono: prospectos.telefono,
      estado: prospectos.estado,
      chatwootConversationId: prospectos.chatwootConversationId,
    })
    .from(prospectos)
    .where(eq(prospectos.telefono, telefono));

  return row ?? null;
}

function triggerClassification(telefono: string) {
  const baseUrl =
    process.env.CRM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!baseUrl) return;

  const normalizedBaseUrl = baseUrl.startsWith("http")
    ? baseUrl
    : `https://${baseUrl}`;

  fetch(`${normalizedBaseUrl}/api/prospeccion/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefono, force: true }),
  }).catch((err) => console.error("[prospecto-auto-classifier]", err));
}

type MensajeInput = {
  telefono: string;
  direccion: "saliente" | "entrante";
  tipo: string;
  timestamp: Date;
  contenido: string;
  nombreContacto: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payloadRaw: Record<string, any>;
  wamid?: string;
  mediaUrl?: string | null;
};

async function registrarMensaje(input: MensajeInput): Promise<string | null> {
  const id = crypto.randomUUID();
  const values = {
    id,
    telefono: input.telefono,
    direccion: input.direccion,
    tipo: input.tipo || "text",
    timestamp: input.timestamp,
    contenido: input.contenido,
    nombreContacto: input.nombreContacto,
    payloadRaw: JSON.stringify(input.payloadRaw),
    wamid: input.wamid || null,
    mediaUrl: input.mediaUrl || null,
    createdAt: new Date(),
  };

  if (input.wamid) {
    const [result] = await db
      .insert(prospectosMensajes)
      .values(values)
      .onConflictDoNothing({ target: prospectosMensajes.wamid })
      .returning({ id: prospectosMensajes.id });
    return result?.id ?? null;
  }

  const [duplicate] = await db
    .select({ id: prospectosMensajes.id })
    .from(prospectosMensajes)
    .where(
      and(
        eq(prospectosMensajes.telefono, input.telefono),
        eq(prospectosMensajes.direccion, input.direccion),
        eq(prospectosMensajes.tipo, input.tipo || "text"),
        eq(prospectosMensajes.contenido, input.contenido),
        eq(prospectosMensajes.timestamp, input.timestamp)
      )
    )
    .limit(1);

  if (duplicate) {
    return null;
  }

  await db.insert(prospectosMensajes).values(values);
  return id;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("ycloud-signature");
  const trustedForward = isTrustedForward(req);

  if (sig && process.env.YCLOUD_WEBHOOK_SECRET && !verificarFirma(rawBody, sig)) {
    console.warn("[YCLOUD] Firma invalida");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!sig && process.env.YCLOUD_WEBHOOK_SECRET && !trustedForward) {
    console.warn("[YCLOUD] Forward no autorizado");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let evento: Record<string, unknown>;
  try {
    evento = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!evento?.type) return NextResponse.json({ ok: true });

  console.log(`[YCLOUD] ${evento.type}`);
  let processedProspect:
    | Awaited<ReturnType<typeof getProspectoByPhone>>
    | null = null;
  let processedMessageId: string | null = null;
  let processedDirection: "incoming" | "outgoing" | null = null;

  try {
    switch (evento.type) {
      case "whatsapp.smb.message.echoes": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = evento.whatsappMessage as Record<string, any> | undefined;
        if (msg?.to) {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.createTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          const mediaUrl = extraerMediaUrl(msg);

          await ensureProspecto(msg.to, undefined, timestamp);

          const mensajeId = await registrarMensaje({
            telefono: msg.to,
            direccion: "saliente",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: msg,
            wamid: msg.wamid,
            mediaUrl,
          });

          if (mensajeId) {
            processedMessageId = mensajeId;
            processedDirection = "outgoing";
            processedProspect = await getProspectoByPhone(msg.to);
            await markOutboundActivity(msg.to, timestamp);
            console.log(`[SALIENTE -> ${msg.to}] ${contenido}`);

            if (mediaUrl && (msg.type === "audio" || msg.type === "voice")) {
              await transcribirAudioEnBackground(mensajeId, mediaUrl);
            }
          }
        }
        break;
      }

      case "whatsapp.message.updated": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = evento.whatsappMessage as Record<string, any> | undefined;
        if (msg?.to && msg.status === "sent") {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.createTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          const mediaUrl = extraerMediaUrl(msg);

          await ensureProspecto(msg.to, undefined, timestamp);

          const mensajeId = await registrarMensaje({
            telefono: msg.to,
            direccion: "saliente",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: msg,
            wamid: msg.wamid,
            mediaUrl,
          });

          if (mensajeId) {
            processedMessageId = mensajeId;
            processedDirection = "outgoing";
            processedProspect = await getProspectoByPhone(msg.to);
            await markOutboundActivity(msg.to, timestamp);

            if (mediaUrl && (msg.type === "audio" || msg.type === "voice")) {
              await transcribirAudioEnBackground(mensajeId, mediaUrl);
            }
          }
        }
        break;
      }

      case "whatsapp.inbound_message.received": {
        const msg = evento.whatsappInboundMessage as
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | Record<string, any>
          | undefined;

        if (msg?.from) {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          const nombreContacto: string = msg.customerProfile?.name || "";
          const mediaUrl = extraerMediaUrl(msg);

          await ensureProspecto(msg.from, nombreContacto, timestamp);

          const mensajeId = await registrarMensaje({
            telefono: msg.from,
            direccion: "entrante",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto,
            payloadRaw: msg,
            wamid: msg.wamid,
            mediaUrl,
          });

          if (mensajeId) {
            await markInboundActivity(msg.from, nombreContacto, timestamp);
            processedMessageId = mensajeId;
            processedDirection = "incoming";
            processedProspect = await getProspectoByPhone(msg.from);
            console.log(`[ENTRANTE <- ${msg.from}] ${nombreContacto}: ${contenido}`);

            postN8n("/webhook/nuevo-lead-whatsapp", {
              phone: msg.from,
              name: nombreContacto,
              content: contenido,
              timestamp: timestamp.toISOString(),
              wamid: msg.wamid || null,
              type: msg.type || "text",
            });

            if (mediaUrl && (msg.type === "audio" || msg.type === "voice")) {
              await transcribirAudioEnBackground(mensajeId, mediaUrl);
            }

            triggerClassification(msg.from);
          }
        }
        break;
      }

      case "whatsapp.smb.history": {
        const inbound = evento.whatsappInboundMessage as
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | Record<string, any>
          | undefined;
        const outbound = evento.whatsappMessage as
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | Record<string, any>
          | undefined;

        if (inbound?.from) {
          const timestamp = parseTimestamp(inbound.sendTime ?? inbound.timestamp);
          const contenido = extraerContenido(inbound);
          const nombreContacto: string = inbound.customerProfile?.name || "";

          await ensureProspecto(inbound.from, nombreContacto, timestamp);

          const mensajeId = await registrarMensaje({
            telefono: inbound.from,
            direccion: "entrante",
            tipo: inbound.type,
            timestamp,
            contenido,
            nombreContacto,
            payloadRaw: inbound,
            wamid: inbound.wamid,
            mediaUrl: extraerMediaUrl(inbound),
          });

          if (mensajeId) {
            await markInboundActivity(inbound.from, nombreContacto, timestamp);
            processedMessageId = mensajeId;
            processedDirection = "incoming";
            processedProspect = await getProspectoByPhone(inbound.from);
            triggerClassification(inbound.from);
          }
        }

        if (outbound?.to) {
          const timestamp = parseTimestamp(outbound.sendTime ?? outbound.createTime ?? outbound.timestamp);
          const contenido = extraerContenido(outbound);

          await ensureProspecto(outbound.to, undefined, timestamp);

          const mensajeId = await registrarMensaje({
            telefono: outbound.to,
            direccion: "saliente",
            tipo: outbound.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: outbound,
            wamid: outbound.wamid,
            mediaUrl: extraerMediaUrl(outbound),
          });

          if (mensajeId) {
            processedMessageId = mensajeId;
            processedDirection = "outgoing";
            processedProspect = await getProspectoByPhone(outbound.to);
            await markOutboundActivity(outbound.to, timestamp);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("[YCLOUD] Error procesando webhook:", err);
  }

  return NextResponse.json({
    ok: true,
    prospecto: processedProspect,
    mensajeId: processedMessageId,
    direction: processedDirection,
  });
}
