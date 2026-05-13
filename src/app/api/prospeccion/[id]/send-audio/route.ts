// Envía un audio pregrabado al prospecto vía YCloud y lo registra en CRM + Chatwoot
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Mapa de audios disponibles → URLs públicas
// Subir los archivos .ogg a Vercel Blob o CDN y actualizar estas URLs
const AUDIO_MAP: Record<string, { url: string; label: string }> = {
  bienvenida: {
    url: `${process.env.AUDIO_CDN_BASE ?? ""}/bienvenida.ogg`,
    label: "Audio de bienvenida",
  },
  servicio: {
    url: `${process.env.AUDIO_CDN_BASE ?? ""}/presentacion-servicio.ogg`,
    label: "Presentación del servicio",
  },
  recordatorio: {
    url: `${process.env.AUDIO_CDN_BASE ?? ""}/recordatorio-llamada.ogg`,
    label: "Recordatorio de llamada",
  },
  post_llamada: {
    url: `${process.env.AUDIO_CDN_BASE ?? ""}/post-llamada.ogg`,
    label: "Seguimiento post-llamada",
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { audioKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { audioKey } = body;
  if (!audioKey || !AUDIO_MAP[audioKey]) {
    return NextResponse.json(
      { error: `audioKey inválido. Opciones: ${Object.keys(AUDIO_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  // Obtener prospecto
  const [prospecto] = await db
    .select()
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!prospecto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const audio = AUDIO_MAP[audioKey];
  const apiKey = process.env.YCLOUD_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "YCLOUD_API_KEY no configurada" }, { status: 500 });
  }

  if (!process.env.AUDIO_CDN_BASE) {
    return NextResponse.json(
      { error: "AUDIO_CDN_BASE no configurada. Subí los audios y configurá la variable." },
      { status: 500 }
    );
  }

  // Enviar audio vía YCloud
  const yRes = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      to: prospecto.telefono,
      type: "audio",
      audio: { link: audio.url },
    }),
  });

  if (!yRes.ok) {
    const err = await yRes.text();
    console.error("[send-audio] YCloud error:", err);
    return NextResponse.json({ error: "Error al enviar audio", detail: err }, { status: 502 });
  }

  const yData = await yRes.json();
  const wamid = yData?.id ?? null;

  // Registrar mensaje saliente en CRM
  await db.insert(prospectosMensajes).values({
    telefono: prospecto.telefono,
    wamid,
    direccion: "saliente",
    tipo: "audio",
    contenido: `[Audio: ${audio.label}]`,
    mediaUrl: audio.url,
    nombreContacto: prospecto.nombreContacto,
    timestamp: new Date(),
  });

  // Actualizar ultimoContacto y mensajesEnviados
  await db
    .update(prospectos)
    .set({
      ultimoContacto: new Date(),
      mensajesEnviados: prospecto.mensajesEnviados + 1,
      updatedAt: new Date(),
    })
    .where(eq(prospectos.id, id));

  // Fire-and-forget: registrar en Chatwoot si hay conversación
  if (prospecto.chatwootConversationId && process.env.CHATWOOT_BASE_URL) {
    const chatwootPayload = {
      content: `🎙️ *${audio.label}* (audio enviado)`,
      message_type: "outgoing",
      private: false,
    };
    fetch(
      `${process.env.CHATWOOT_BASE_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations/${prospecto.chatwootConversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api_access_token": process.env.CHATWOOT_API_TOKEN ?? "",
        },
        body: JSON.stringify(chatwootPayload),
      }
    ).catch((err) => console.error("[send-audio] Chatwoot error:", err));
  }

  return NextResponse.json({ success: true, wamid, audioKey, label: audio.label });
}
