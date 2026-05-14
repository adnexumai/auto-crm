// Análisis del sitio web de un negocio + guión de llamada de descubrimiento (Supabase)
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.url?.trim()) {
    return NextResponse.json({ error: "URL requerida" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: prospecto, error } = await supabase
    .from("prospectos")
    .select("id, negocio, nombre_contacto")
    .eq("id", id)
    .single();

  if (error || !prospecto) {
    return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
  }

  // Usar Jina Reader para extraer texto limpio
  let textoSitio = "";
  try {
    const jinaUrl = `https://r.jina.ai/${body.url.trim()}`;
    const resp = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`Jina ${resp.status}`);
    const texto = await resp.text();
    textoSitio = texto.slice(0, 5000);
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el sitio. Verificá que la URL sea correcta y accesible." },
      { status: 422 }
    );
  }

  if (!textoSitio.trim()) {
    return NextResponse.json(
      { error: "El sitio no tiene contenido legible." },
      { status: 422 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const nombreNegocio = prospecto.negocio || prospecto.nombre_contacto || "este negocio";

  const prompt = `Sos un experto en ventas B2B para agencias de IA y automatización. Analizá el contenido de este sitio web y respondé SOLO en JSON válido con este formato exacto (sin markdown, sin texto adicional):

{"negocio":"descripción breve del negocio en 1-2 oraciones","problemas":["problema operativo 1","problema operativo 2","problema operativo 3"],"guion":["Pregunta 1 de descubrimiento","Pregunta 2","Pregunta 3","Pregunta 4","Pregunta 5"]}

Negocio: ${nombreNegocio}
Contenido del sitio: ${textoSitio}

El guión debe tener 5-6 preguntas de descubrimiento enfocadas en detectar: problemas de atención al cliente, velocidad de respuesta, pérdida de leads, saturación del equipo, o procesos manuales que se puedan automatizar con IA. Las preguntas deben ser consultivas, no de venta directa.`;

  let analysis: { negocio: string; problemas: string[]; guion: string[] };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { negocio: nombreNegocio, problemas: [], guion: [] };
  } catch {
    return NextResponse.json({ error: "Error al generar el análisis" }, { status: 500 });
  }

  // Save url_negocio if column exists, store analysis in notas as fallback
  await supabase
    .from("prospectos")
    .update({
      notas: `[Web Analysis]\n${JSON.stringify(analysis, null, 2)}`,
    })
    .eq("id", id);

  return NextResponse.json(analysis);
}
