// Generar contenido IA para cada paso del proceso de ventas (Supabase)
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// PATCH: actualizar estado de pasos (toggle completado o guardar contenido)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: { pasos?: { id: string; completado: boolean; contenido: string }[] } = await req.json();

  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from("prospectos")
    .select("id, notas")
    .eq("id", id)
    .single();

  if (error || !row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Store proceso_ventas in notas as JSON block since column doesn't exist yet
  const existingNotas = row.notas || "";
  const procesoTag = "[PROCESO_VENTAS]";
  const baseNotas = existingNotas.includes(procesoTag)
    ? existingNotas.split(procesoTag)[0].trim()
    : existingNotas;

  await supabase
    .from("prospectos")
    .update({
      notas: `${baseNotas}\n${procesoTag}\n${JSON.stringify(body.pasos)}`,
    })
    .eq("id", id);

  return NextResponse.json({ success: true });
}

// POST: generar contenido IA para un paso específico
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { paso } = await req.json() as { paso: string };

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from("prospectos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const negocio = row.negocio || row.nombre_contacto || row.telefono;

  // Try to extract web analysis from notas
  let analisisWeb: { negocio?: string; problemas?: string[] } | null = null;
  if (row.notas?.includes("[Web Analysis]")) {
    try {
      const jsonPart = row.notas.split("[Web Analysis]")[1]?.trim();
      if (jsonPart) {
        const match = jsonPart.match(/\{[\s\S]*?\}/);
        if (match) analisisWeb = JSON.parse(match[0]);
      }
    } catch { /* ignore parse errors */ }
  }

  const resumenIa = row.resumen_ia || "";
  const contexto = [
    `Negocio: ${negocio}`,
    analisisWeb?.negocio ? `Descripción: ${analisisWeb.negocio}` : "",
    analisisWeb?.problemas?.length ? `Problemas detectados: ${analisisWeb.problemas.join(", ")}` : "",
    resumenIa ? `Análisis IA del prospecto: ${resumenIa.slice(0, 500)}` : "",
  ].filter(Boolean).join("\n");

  const prompts: Record<string, string> = {
    conciencia: `Sos un experto en ventas B2B. Escribí un mensaje de WhatsApp corto (máx 4 líneas) para elevar el nivel de conciencia de un prospecto antes de pedirle que agende una llamada. El mensaje debe crear curiosidad, mostrar el costo de oportunidad de no automatizar, y NO pedir nada todavía. Tono: directo, sin vender, consultivo.\n\nContexto del negocio:\n${contexto}\n\nRespondé SOLO con el mensaje listo para enviar, sin explicaciones.`,

    doc_ab: `Sos consultor de automatización de negocios. Creá un documento corto de "Situación Actual (A) → Situación Objetivo (B)" para este negocio.\n\nFormato:\n## Situación Actual (A)\n- [3 problemas concretos]\n\n## Situación Objetivo (B) con Adnexum\n- [3 mejoras específicas con números estimados]\n\n## Costo de quedarse en A\n[1 párrafo sobre el costo de oportunidad]\n\nContexto:\n${contexto}\n\nRespondé solo con el documento.`,

    recordatorio: `Escribí un mensaje de recordatorio para enviar 24h antes de la llamada de descubrimiento con ${negocio}. Debe ser breve (3 líneas), confirmar la reunión, generar anticipación de valor, y crear compromiso.\n\nRespondé SOLO con el mensaje listo para enviar.`,

    descubrimiento: `Sos un consultor experto en ventas B2B de automatización con IA. Creá un guión de llamada de descubrimiento para ${negocio}.\n\n1. Apertura (30 seg)\n2. Preguntas de diagnóstico (10-12 preguntas)\n3. Cierre del descubrimiento\n\nContexto:\n${contexto}\n\nFormato: guión numerado.`,

    analisis_preventa: `Creá un análisis de pre-venta completo para enviar a ${negocio}.\n\n## Diagnóstico de situación\n## Propuesta de transformación\n## ROI Estimado\n## Costo de oportunidad\n\nContexto:\n${contexto}\n\nTono: analítico, basado en datos.`,
  };

  const prompt = prompts[paso];
  if (!prompt) {
    return NextResponse.json({ error: `Paso '${paso}' no tiene generación IA` }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 900,
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  });

  const contenido = completion.choices[0].message.content || "";
  return NextResponse.json({ contenido });
}
