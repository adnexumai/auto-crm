// [FUSION] Helper de transcripción de audios con Whisper (feature nuevo en la fusión)
import OpenAI, { toFile } from "openai";
import { db } from "@/db";
import { prospectosMensajes } from "@/db/schema";
import { eq } from "drizzle-orm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[WHISPER] OPENAI_API_KEY no detectada en environment");
    return null;
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Transcribe un audio entrante con Whisper y actualiza el registro del mensaje.
 * Fire-and-forget: nunca lanza, solo loggea errores.
 */
export async function transcribirAudioEnBackground(
  mensajeId: string,
  mediaUrl: string
): Promise<void> {
  console.log(`[WHISPER] Iniciando transcripción para mensaje ${mensajeId}...`);
  try {
    const openai = getOpenAI();
    if (!openai) return;

    console.log(`[WHISPER] Descargando audio desde: ${mediaUrl}`);
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      console.error(`[WHISPER] Download falló: ${res.status} ${res.statusText}`);
      return;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "audio/ogg";
    console.log(`[WHISPER] Audio descargado. Tamaño: ${buffer.length} bytes. Type: ${contentType}`);

    const ext = contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("wav")
        ? "wav"
        : "ogg";

    // Usar toFile para mayor compatibilidad en entornos Node/Vercel
    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });

    console.log(`[WHISPER] Enviando a OpenAI Whisper...`);
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
    });

    const texto = transcription.text?.trim();
    if (!texto) {
      console.warn(`[WHISPER] Transcripción vacía para mensaje ${mensajeId}`);
      return;
    }

    await db.update(prospectosMensajes)
      .set({ transcripcion: texto })
      .where(eq(prospectosMensajes.id, mensajeId));

    console.log(
      `[WHISPER] Transcrito mensaje ${mensajeId}: ${texto.slice(0, 80)}...`
    );
  } catch (err) {
    console.error("[WHISPER] Error:", err);
  }
}
