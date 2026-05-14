// Estado del canal de comunicación (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();

  const { data: lastMessage } = await supabase
    .from("prospectos_mensajes")
    .select("telefono, direccion, timestamp")
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    channel: "YCloud + Chatwoot",
    crm: "auto-crm-main-hazel.vercel.app",
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
          timestamp: lastMessage.timestamp,
        }
      : null,
  });
}
