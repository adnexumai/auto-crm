// Análisis de patrones de prospección con IA (Supabase)
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const supabase = getSupabase();

  const { data: todos } = await supabase
    .from("prospectos")
    .select("id, telefono, respondio, oportunidad_score")
    .order("primer_contacto", { ascending: false })
    .limit(200);

  if (!todos?.length) {
    return NextResponse.json({ error: "No hay suficientes datos" }, { status: 422 });
  }

  const respondieron = todos.filter((p) => p.respondio).slice(0, 25);
  const noRespondieron = todos.filter((p) => !p.respondio).slice(0, 25);

  async function primerMensaje(telefono: string): Promise<string | null> {
    const { data } = await supabase
      .from("prospectos_mensajes")
      .select("contenido")
      .eq("telefono", telefono)
      .eq("direccion", "saliente")
      .order("timestamp", { ascending: true })
      .limit(1)
      .single();
    return data?.contenido?.trim() || null;
  }

  const mensajesR: string[] = [];
  const mensajesN: string[] = [];

  for (const p of respondieron) {
    const msg = await primerMensaje(p.telefono);
    if (msg && msg.length > 5) mensajesR.push(msg.slice(0, 300));
  }
  for (const p of noRespondieron) {
    const msg = await primerMensaje(p.telefono);
    if (msg && msg.length > 5) mensajesN.push(msg.slice(0, 300));
  }

  if (!mensajesR.length && !mensajesN.length) {
    return NextResponse.json({ error: "No hay suficientes mensajes" }, { status: 422 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    temperature: 0.4,
    messages: [{
      role: "user",
      content: `Sos un experto en prospeccion en frio por WhatsApp para una agencia de automatizacion con IA (Adnexum, Argentina).

Grupo A — SI respondieron (${mensajesR.length}):
${mensajesR.map((m, i) => `${i + 1}. "${m}"`).join("\n")}

Grupo B — NO respondieron (${mensajesN.length}):
${mensajesN.map((m, i) => `${i + 1}. "${m}"`).join("\n")}

Analisis en espanol: Que funciono, que no, 3 reglas de oro, y un mensaje optimizado.`,
    }],
  });

  return NextResponse.json({
    analisis: completion.choices[0].message.content || "",
    stats: {
      totalAnalizado: todos.length,
      respondieron: respondieron.length,
      noRespondieron: noRespondieron.length,
      tasaRespuesta: Math.round((respondieron.length / todos.length) * 100),
    },
  });
}
