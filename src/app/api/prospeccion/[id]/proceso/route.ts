// Generar contenido IA para cada paso del proceso de ventas
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PASOS_DEFAULT = [
  { id: "conciencia", label: "Elevar conciencia", completado: false, contenido: "" },
  { id: "doc_ab", label: "Documento A→B", completado: false, contenido: "" },
  { id: "agendar", label: "Agendar llamada", completado: false, contenido: "" },
  { id: "recordatorio", label: "Recordatorio pre-llamada", completado: false, contenido: "" },
  { id: "descubrimiento", label: "Guión de descubrimiento", completado: false, contenido: "" },
  { id: "analisis_preventa", label: "Análisis pre-venta A→B", completado: false, contenido: "" },
  { id: "llamada_venta", label: "Llamada de venta (PsycoSelling)", completado: false, contenido: "" },
  { id: "contrato", label: "Contrato enviado", completado: false, contenido: "" },
];

// PATCH: actualizar estado de pasos (toggle completado o guardar contenido)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: { pasos?: { id: string; completado: boolean; contenido: string }[] } = await req.json();

  const [row] = await db.select({ procesoVentas: prospectos.procesoVentas }).from(prospectos).where(eq(prospectos.id, id));
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.update(prospectos).set({
    procesoVentas: JSON.stringify(body.pasos),
    updatedAt: new Date(),
  }).where(eq(prospectos.id, id));

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

  const [row] = await db.select().from(prospectos).where(eq(prospectos.id, id));
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const negocio = row.negocio || row.nombreContacto || row.telefono;
  const analisisWeb = row.analisisWeb ? JSON.parse(row.analisisWeb) : null;
  const resumenIa = row.resumenIa || "";
  const contexto = [
    `Negocio: ${negocio}`,
    analisisWeb?.negocio ? `Descripción: ${analisisWeb.negocio}` : "",
    analisisWeb?.problemas?.length ? `Problemas detectados: ${analisisWeb.problemas.join(", ")}` : "",
    resumenIa ? `Análisis IA del prospecto: ${resumenIa.slice(0, 500)}` : "",
  ].filter(Boolean).join("\n");

  const prompts: Record<string, string> = {
    conciencia: `Sos un experto en ventas B2B. Escribí un mensaje de WhatsApp corto (máx 4 líneas) para elevar el nivel de conciencia de un prospecto antes de pedirle que agende una llamada. El mensaje debe crear curiosidad, mostrar el costo de oportunidad de no automatizar, y NO pedir nada todavía. Tono: directo, sin vender, consultivo.

Contexto del negocio:
${contexto}

Respondé SOLO con el mensaje listo para enviar, sin explicaciones.`,

    doc_ab: `Sos consultor de automatización de negocios. Creá un documento corto de "Situación Actual (A) → Situación Objetivo (B)" para este negocio, mostrando cómo la IA puede transformar su operación.

Formato:
## Situación Actual (A)
- [3 problemas concretos del negocio]

## Situación Objetivo (B) con Adnexum
- [3 mejoras específicas con números estimados]

## Costo de quedarse en A
[1 párrafo sobre el costo de oportunidad mensual de no actuar]

Contexto:
${contexto}

Respondé solo con el documento.`,

    recordatorio: `Escribí un mensaje de recordatorio para enviar 24h antes de la llamada de descubrimiento con ${negocio}. El objetivo es aumentar el show-up rate. Debe ser breve (3 líneas), confirmar la reunión, generar anticipación de valor, y crear compromiso. Tono: profesional pero cercano.

Respondé SOLO con el mensaje listo para enviar.`,

    descubrimiento: `Sos un consultor experto en ventas B2B de automatización con IA. Creá un guión de llamada de descubrimiento para ${negocio}.

El guión debe tener:
1. Apertura (30 seg) - rapport y agenda
2. Preguntas de diagnóstico (10-12 preguntas específicas) para detectar:
   - Volumen de leads y tasa de conversión actual
   - Tiempo que el equipo gasta en tareas manuales (horas/semana)
   - Costo de un lead perdido o respuesta lenta
   - Herramientas actuales que usan
   - Mayor cuello de botella operativo
3. Cierre del descubrimiento - siguiente paso

Contexto:
${contexto}

Formato: guión numerado, con las preguntas exactas a hacer.`,

    analisis_preventa: `Creá un análisis de pre-venta completo para enviar a ${negocio} antes de la llamada de venta.

Debe incluir:
## Diagnóstico de situación
[Resumen de sus problemas principales basado en el descubrimiento]

## Propuesta de transformación
[Cómo Adnexum los llevaría del punto A al B específicamente]

## ROI Estimado
[Calcular ahorro de tiempo + costo de leads perdidos + revenue potencial]

## Costo de oportunidad
[Cuánto pierde por mes que no actúa]

Contexto:
${contexto}

Tono: analítico, basado en datos, consultor de negocios.`,
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
