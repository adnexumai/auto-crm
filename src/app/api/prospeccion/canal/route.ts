import { NextResponse } from "next/server";
import { db } from "@/db";
import { prospectosMensajes } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const [lastMessage] = await db
    .select({
      telefono: prospectosMensajes.telefono,
      direccion: prospectosMensajes.direccion,
      timestamp: prospectosMensajes.timestamp,
    })
    .from(prospectosMensajes)
    .orderBy(desc(prospectosMensajes.timestamp))
    .limit(1);

  return NextResponse.json({
    channel: "YCloud + Chatwoot",
    crm: "adnexumcrm.vercel.app",
    mode: "polling_realtime",
    pollMs: 5000,
    connected: Boolean(process.env.N8N_WEBHOOK_BASE),
    ycloudKeyConfigured: Boolean(process.env.YCLOUD_API_KEY),
    chatwootDirectConfigured: Boolean(process.env.CHATWOOT_API_TOKEN),
    n8nWebhookConfigured: Boolean(process.env.N8N_WEBHOOK_BASE),
    whatsappNumber: process.env.YCLOUD_PHONE_NUMBER?.trim() || null,
    inboxName: "Chatwoot account 2 / inbox 2",
    lastMessage: lastMessage
      ? {
          telefono: lastMessage.telefono,
          direccion: lastMessage.direccion,
          timestamp: lastMessage.timestamp.toISOString(),
        }
      : null,
    notes: {
      ycloud:
        "El CRM se actualiza desde los webhooks n8n. Para consultar estado directo de YCloud desde Vercel hay que cargar YCLOUD_API_KEY.",
      chatwoot:
        "Chatwoot se sincroniza por n8n. Para llamadas directas desde el CRM hay que cargar CHATWOOT_API_TOKEN rotado.",
    },
  });
}
