// YCloud Webhook — recibe eventos WhatsApp y registra en Supabase
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  verificarFirma,
  extraerContenido,
  postN8n,
} from "@/lib/prospeccion/ycloud";
import { syncOutboundToChatwoot } from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

function isTrustedForward(req: NextRequest) {
  const forwardedBy = req.headers.get("x-adnexum-forwarded-by");
  if (forwardedBy !== "n8n") return false;
  const configuredSecret = process.env.N8N_FORWARD_SECRET?.trim();
  if (!configuredSecret) return true;
  return req.headers.get("x-adnexum-forward-secret") === configuredSecret;
}

function parseTimestamp(value: string | number | undefined): string {
  if (!value) return new Date().toISOString();

  if (typeof value === "number") {
    const normalized = value < 1_000_000_000_000 ? value * 1000 : value;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && String(value).trim() !== "") {
    const normalized = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function upsertProspecto(
  telefono: string,
  nombreContacto?: string,
  activityAt?: string
) {
  const supabase = getSupabase();
  const now = activityAt || new Date().toISOString();

  const { data } = await supabase
    .from("prospectos")
    .select("id, nombre_contacto")
    .eq("telefono", telefono)
    .maybeSingle();

  if (!data) {
    await supabase.from("prospectos").insert({
      telefono,
      primer_contacto: now,
      ultimo_contacto: now,
      mensajes_enviados: 0,
      nombre_contacto: nombreContacto || "",
      estado: "enviado",
      respondio: false,
    });
  } else {
    if (nombreContacto && !data.nombre_contacto) {
      await supabase
        .from("prospectos")
        .update({ nombre_contacto: nombreContacto })
        .eq("id", data.id);
    }
  }
}

async function markOutbound(telefono: string, activityAt: string) {
  const supabase = getSupabase();
  // Supabase doesn't have rpc for increment, so fetch + update
  const { data } = await supabase
    .from("prospectos")
    .select("mensajes_enviados")
    .eq("telefono", telefono)
    .maybeSingle();

  await supabase
    .from("prospectos")
    .update({
      mensajes_enviados: (data?.mensajes_enviados ?? 0) + 1,
      ultimo_contacto: activityAt,
    })
    .eq("telefono", telefono);
}

async function markInbound(
  telefono: string,
  nombreContacto?: string,
  activityAt?: string
) {
  const supabase = getSupabase();
  await supabase
    .from("prospectos")
    .update({
      respondio: true,
      estado: "respondio",
      ultimo_contacto: activityAt || new Date().toISOString(),
      ...(nombreContacto ? { nombre_contacto: nombreContacto } : {}),
    })
    .eq("telefono", telefono);
}

async function registrarMensaje(input: {
  telefono: string;
  direccion: "saliente" | "entrante";
  tipo: string;
  timestamp: string;
  contenido: string;
  nombreContacto: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payloadRaw: Record<string, any>;
  wamid?: string;
}): Promise<boolean> {
  const supabase = getSupabase();

  const row = {
    telefono: input.telefono,
    direccion: input.direccion,
    tipo: input.tipo || "text",
    timestamp: input.timestamp,
    contenido: input.contenido,
    nombre_contacto: input.nombreContacto,
    payload_raw: input.payloadRaw,
    wamid: input.wamid || null,
  };

  if (input.wamid) {
    // Upsert by wamid — ignore if duplicate
    const { error } = await supabase
      .from("prospectos_mensajes")
      .upsert(row, { onConflict: "wamid", ignoreDuplicates: true });
    return !error;
  }

  const { error } = await supabase.from("prospectos_mensajes").insert(row);
  return !error;
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

  try {
    switch (evento.type) {
      // Tomás envía desde WA Business App
      case "whatsapp.smb.message.echoes": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = evento.whatsappMessage as Record<string, any> | undefined;
        if (msg?.to) {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.createTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          await upsertProspecto(msg.to, undefined, timestamp);
          const ok = await registrarMensaje({
            telefono: msg.to,
            direccion: "saliente",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: msg,
            wamid: msg.wamid,
          });
          if (ok) {
            await markOutbound(msg.to, timestamp);
            // Sync outbound message to Chatwoot so agent sees it
            syncOutboundToChatwoot(msg.to, contenido);
            console.log(`[SALIENTE -> ${msg.to}] ${contenido}`);
          }
        }
        break;
      }

      // Enviado via API directa
      case "whatsapp.message.updated": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = evento.whatsappMessage as Record<string, any> | undefined;
        if (msg?.to && msg.status === "sent") {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.createTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          await upsertProspecto(msg.to, undefined, timestamp);
          const ok = await registrarMensaje({
            telefono: msg.to,
            direccion: "saliente",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: msg,
            wamid: msg.wamid,
          });
          if (ok) {
            await markOutbound(msg.to, timestamp);
            // Sync outbound message to Chatwoot so agent sees it
            syncOutboundToChatwoot(msg.to, contenido);
          }
        }
        break;
      }

      // Prospecto responde
      case "whatsapp.inbound_message.received": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = evento.whatsappInboundMessage as Record<string, any> | undefined;
        if (msg?.from) {
          const timestamp = parseTimestamp(msg.sendTime ?? msg.timestamp);
          const contenido = extraerContenido(msg);
          const nombreContacto: string = msg.customerProfile?.name || "";
          await upsertProspecto(msg.from, nombreContacto, timestamp);
          const ok = await registrarMensaje({
            telefono: msg.from,
            direccion: "entrante",
            tipo: msg.type,
            timestamp,
            contenido,
            nombreContacto,
            payloadRaw: msg,
            wamid: msg.wamid,
          });
          if (ok) {
            await markInbound(msg.from, nombreContacto, timestamp);
            console.log(`[ENTRANTE <- ${msg.from}] ${nombreContacto}: ${contenido}`);

            postN8n("/webhook/nuevo-lead-whatsapp", {
              phone: msg.from,
              name: nombreContacto,
              content: contenido,
              timestamp,
              wamid: msg.wamid || null,
              type: msg.type || "text",
            });

            // Trigger auto-classification
            const baseUrl =
              process.env.CRM_BASE_URL ||
              process.env.NEXT_PUBLIC_APP_URL ||
              process.env.VERCEL_PROJECT_PRODUCTION_URL;
            if (baseUrl) {
              const normalized = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
              fetch(`${normalized}/api/prospeccion/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ telefono: msg.from, force: true }),
              }).catch((err) => console.error("[auto-classifier]", err));
            }
          }
        }
        break;
      }

      // Historia de mensajes WA Business App
      case "whatsapp.smb.history": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inbound = evento.whatsappInboundMessage as Record<string, any> | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outbound = evento.whatsappMessage as Record<string, any> | undefined;

        if (inbound?.from) {
          const timestamp = parseTimestamp(inbound.sendTime ?? inbound.timestamp);
          const contenido = extraerContenido(inbound);
          const nombreContacto: string = inbound.customerProfile?.name || "";
          await upsertProspecto(inbound.from, nombreContacto, timestamp);
          const ok = await registrarMensaje({
            telefono: inbound.from,
            direccion: "entrante",
            tipo: inbound.type,
            timestamp,
            contenido,
            nombreContacto,
            payloadRaw: inbound,
            wamid: inbound.wamid,
          });
          if (ok) await markInbound(inbound.from, nombreContacto, timestamp);
        }

        if (outbound?.to) {
          const timestamp = parseTimestamp(outbound.sendTime ?? outbound.createTime ?? outbound.timestamp);
          const contenido = extraerContenido(outbound);
          await upsertProspecto(outbound.to, undefined, timestamp);
          const ok = await registrarMensaje({
            telefono: outbound.to,
            direccion: "saliente",
            tipo: outbound.type,
            timestamp,
            contenido,
            nombreContacto: "Tomas",
            payloadRaw: outbound,
            wamid: outbound.wamid,
          });
          if (ok) await markOutbound(outbound.to, timestamp);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[YCLOUD] Error procesando webhook:", err);
  }

  return NextResponse.json({ ok: true });
}
