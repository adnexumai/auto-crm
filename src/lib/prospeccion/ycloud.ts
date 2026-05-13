// [FUSION] Portado desde adnexum-os - Helpers para webhook YCloud + Whisper + n8n
import crypto from "crypto";

/**
 * Verifica la firma HMAC-SHA256 del webhook de YCloud.
 * Si no hay secret configurado, acepta todo (útil para desarrollo).
 */
export function verificarFirma(rawBody: string, sig: string | null): boolean {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!sig) return false;
  const partes = Object.fromEntries(
    sig.split(",").map((p) => p.split("="))
  ) as Record<string, string>;
  if (!partes.t || !partes.s) return false;
  const payload = `${partes.t}.${rawBody}`;
  const esperada = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(partes.s),
      Buffer.from(esperada)
    );
  } catch {
    return false;
  }
}

/**
 * Extrae el texto/representación legible de cualquier tipo de mensaje WhatsApp.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extraerContenido(msg: Record<string, any>): string {
  if (msg.text?.body) return msg.text.body;
  if (msg.image?.caption) return `[imagen] ${msg.image.caption}`;
  if (msg.image) return "[imagen]";
  if (msg.video?.caption) return `[video] ${msg.video.caption}`;
  if (msg.video) return "[video]";
  if (msg.audio) return "[audio]";
  if (msg.voice) return "[audio de voz]";
  if (msg.document?.filename)
    return `[documento: ${msg.document.filename}]`;
  if (msg.document) return "[documento]";
  if (msg.sticker) return "[sticker]";
  if (msg.location)
    return `[ubicación: ${
      msg.location.name ||
      `${msg.location.latitude},${msg.location.longitude}`
    }]`;
  if (msg.reaction?.emoji) return `[reacción: ${msg.reaction.emoji}]`;
  if (msg.contacts) return `[contacto compartido]`;
  if (msg.template?.name) return `[template: ${msg.template.name}]`;
  return `[${msg.type || "mensaje"}]`;
}

/**
 * Intenta extraer una URL descargable del mensaje para audios/voces.
 * YCloud suele exponer `audio.link` o `voice.link` en inbound messages.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extraerMediaUrl(msg: Record<string, any>): string | null {
  return (
    msg.audio?.link ||
    msg.voice?.link ||
    msg.audio?.url ||
    msg.voice?.url ||
    msg.image?.link ||
    msg.video?.link ||
    null
  );
}

/**
 * POST fire-and-forget a un endpoint de n8n. Nunca bloquea ni lanza.
 */
export function postN8n(path: string, body: unknown): void {
  const base = process.env.N8N_WEBHOOK_BASE;
  if (!base) return;
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.error(`[n8n] POST ${path} falló:`, err);
  });
}
