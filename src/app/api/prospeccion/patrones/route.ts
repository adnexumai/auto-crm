// Análisis de patrones de prospección con IA
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  // Traer prospectos con al menos 1 mensaje
  const todos = await db
    .select({
      id: prospectos.id,
      telefono: prospectos.telefono,
      respondio: prospectos.respondio,
      oportunidadScore: prospectos.oportunidadScore,
    })
    .from(prospectos)
    .orderBy(desc(prospectos.createdAt))
    .limit(200);

  const respondieron = todos.filter((p) => p.respondio).slice(0, 40);
  const noRespondieron = todos.filter((p) => !p.respondio).slice(0, 40);

  // Para cada grupo, obtener el primer mensaje saliente
  async function primerMensajeSaliente(telefono: string): Promise<string | null> {
    const [msg] = await db
      .select({ contenido: prospectosMensajes.contenido })
      .from(prospectosMensajes)
      .where(eq(prospectosMensajes.telefono, telefono))
      .orderBy(asc(prospectosMensajes.timestamp))
      .limit(1);
    return msg?.contenido?.trim() || null;
  }

  const mensajesRespondieron: string[] = [];
  const mensajesNoRespondieron: string[] = [];

  for (const p of respondieron.slice(0, 25)) {
    const msg = await primerMensajeSaliente(p.telefono);
    if (msg && msg.length > 5) mensajesRespondieron.push(msg.slice(0, 300));
  }

  for (const p of noRespondieron.slice(0, 25)) {
    const msg = await primerMensajeSaliente(p.telefono);
    if (msg && msg.length > 5) mensajesNoRespondieron.push(msg.slice(0, 300));
  }

  if (mensajesRespondieron.length === 0 && mensajesNoRespondieron.length === 0) {
    return NextResponse.json({ error: "No hay suficientes mensajes para analizar" }, { status: 422 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Sos un experto en prospección en frío por WhatsApp para una agencia de automatización con IA (Adnexum, Argentina).

Analizá estos dos grupos de mensajes de prospección:

**Grupo A — SÍ respondieron (${mensajesRespondieron.length} mensajes):**
${mensajesRespondieron.map((m, i) => `${i + 1}. "${m}"`).join("\n")}

**Grupo B — NO respondieron (${mensajesNoRespondieron.length} mensajes):**
${mensajesNoRespondieron.map((m, i) => `${i + 1}. "${m}"`).join("\n")}

Dame un análisis en español con estas secciones:

## ✅ Qué funcionó
(patrones comunes en los mensajes que SÍ tuvieron respuesta: longitud, tono, estructura, personalización, etc.)

## ❌ Qué no funcionó
(patrones comunes en los mensajes que NO tuvieron respuesta)

## 🏆 3 Reglas de oro
(reglas concretas para mejorar la tasa de respuesta)

## 💬 Ejemplo de mensaje optimizado
(escribí un mensaje de prospección en frío optimizado basado en los patrones que identificaste, para una agencia de IA como Adnexum)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  });

  const analisis = completion.choices[0].message.content || "";

  return NextResponse.json({
    analisis,
    stats: {
      totalAnalizado: todos.length,
      respondieron: respondieron.length,
      noRespondieron: noRespondieron.length,
      tasaRespuesta: todos.length > 0
        ? Math.round((respondieron.length / todos.length) * 100)
        : 0,
    },
  });
}
