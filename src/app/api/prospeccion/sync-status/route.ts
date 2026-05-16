// Full sync status check — YCloud, Chatwoot, n8n, Supabase (health check)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function checkEndpoint(url: string, method = "GET", timeout = 5000): Promise<{ ok: boolean; status?: number; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeout),
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function GET() {
  const supabase = getSupabase();
  const now = new Date();

  // ── Parallel health checks ──────────────────────────────────────
  const [
    supabaseCheck,
    lastMsgRes,
    lastProspectoRes,
    n8nCheck,
    vercelCheck,
  ] = await Promise.all([
    // Supabase: simple count query
    (async () => {
      const start = Date.now();
      const { count, error } = await supabase
        .from("prospectos")
        .select("id", { count: "exact", head: true });
      return {
        ok: !error,
        totalProspectos: count,
        ms: Date.now() - start,
        error: error?.message,
      };
    })(),

    // Last message timestamp
    supabase
      .from("prospectos_mensajes")
      .select("timestamp, direccion, telefono")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single(),

    // Last new prospecto
    supabase
      .from("prospectos")
      .select("primer_contacto, telefono, nombre_contacto")
      .order("primer_contacto", { ascending: false })
      .limit(1)
      .single(),

    // n8n health
    process.env.N8N_WEBHOOK_BASE
      ? checkEndpoint(`${process.env.N8N_WEBHOOK_BASE.replace("/webhook", "")}/healthz`)
      : Promise.resolve({ ok: false, ms: 0, status: undefined }),

    // Self health (API)
    checkEndpoint(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://auto-crm-main-hazel.vercel.app"}/api/prospeccion/kpis`
    ),
  ]);

  const lastMsg = lastMsgRes.data;
  const lastProspecto = lastProspectoRes.data;

  // Calculate data freshness
  const lastMsgAge = lastMsg?.timestamp
    ? Math.floor((now.getTime() - new Date(lastMsg.timestamp).getTime()) / 3600000)
    : null;

  const lastProspectoAge = lastProspecto?.primer_contacto
    ? Math.floor((now.getTime() - new Date(lastProspecto.primer_contacto).getTime()) / 3600000)
    : null;

  // ── Diagnóstico ───────────────────────────────────────────────────
  const problemas: string[] = [];
  const recomendaciones: string[] = [];

  if (!supabaseCheck.ok) {
    problemas.push("Supabase no responde");
  }

  if (lastMsgAge !== null && lastMsgAge > 48) {
    problemas.push(`Ultimo mensaje hace ${lastMsgAge}h — los webhooks pueden estar caidos`);
    recomendaciones.push("Verificar que YCloud tenga configurado el webhook URL correcto");
  }

  if (!process.env.N8N_WEBHOOK_BASE) {
    problemas.push("N8N_WEBHOOK_BASE no configurado");
    recomendaciones.push("Agregar N8N_WEBHOOK_BASE en variables de entorno de Vercel");
  }

  if (!process.env.YCLOUD_WEBHOOK_SECRET) {
    recomendaciones.push("Configurar YCLOUD_WEBHOOK_SECRET para verificar firma de webhooks");
  }

  if (!process.env.OPENAI_API_KEY) {
    problemas.push("OPENAI_API_KEY no configurada — analisis IA deshabilitado");
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    sistemaOk: problemas.length === 0,

    servicios: {
      supabase: {
        conectado: supabaseCheck.ok,
        totalProspectos: supabaseCheck.totalProspectos,
        latenciaMs: supabaseCheck.ms,
      },
      n8n: {
        configurado: Boolean(process.env.N8N_WEBHOOK_BASE),
        url: process.env.N8N_WEBHOOK_BASE || null,
        health: n8nCheck.ok,
        latenciaMs: n8nCheck.ms,
      },
      vercel: {
        apiOk: vercelCheck.ok,
        latenciaMs: vercelCheck.ms,
        url: process.env.NEXT_PUBLIC_APP_URL || "https://auto-crm-main-hazel.vercel.app",
      },
      ycloud: {
        webhookSecretConfigurado: Boolean(process.env.YCLOUD_WEBHOOK_SECRET),
        apiKeyConfigurado: Boolean(process.env.YCLOUD_API_KEY),
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://auto-crm-main-hazel.vercel.app"}/api/prospeccion/webhook`,
      },
      chatwoot: {
        configurado: Boolean(process.env.CHATWOOT_API_TOKEN),
        baseUrl: process.env.CHATWOOT_BASE_URL || "https://chatwoot.adnexum.net",
      },
      openai: {
        configurado: Boolean(process.env.OPENAI_API_KEY),
      },
    },

    datosFrescos: {
      ultimoMensaje: lastMsg ? {
        timestamp: lastMsg.timestamp,
        horasAtras: lastMsgAge,
        direccion: lastMsg.direccion,
        telefono: lastMsg.telefono,
      } : null,
      ultimoProspecto: lastProspecto ? {
        primerContacto: lastProspecto.primer_contacto,
        horasAtras: lastProspectoAge,
        nombre: lastProspecto.nombre_contacto || lastProspecto.telefono,
      } : null,
    },

    problemas,
    recomendaciones,

    webhookConfig: {
      nota: "Para que YCloud envie datos a este sistema, configurar este URL en YCloud Dashboard → Webhooks:",
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://auto-crm-main-hazel.vercel.app"}/api/prospeccion/webhook`,
      eventosRequeridos: [
        "whatsapp.inbound_message.received",
        "whatsapp.smb.message.echoes",
        "whatsapp.message.updated",
      ],
    },
  });
}
