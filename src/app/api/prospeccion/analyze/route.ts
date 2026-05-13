// [FUSION] Analisis estructurado de prospectos para CRM + Chatwoot labels.
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import {
  PROSPECT_ESTADOS,
  buildProspectSummary,
  normalizeIntenciones,
  normalizeTemperatura,
  type ProspectEstado,
} from "@/lib/prospecting";
import { syncProspectLabels } from "@/lib/prospeccion/chatwoot-label-sync";

export const dynamic = "force-dynamic";

type AnalyzeBody = {
  telefono?: string;
  force?: boolean;
};

type ProspectAnalysis = {
  oportunidad: number;
  temperatura: string;
  estado_sugerido: string;
  intenciones: string[];
  resumen: string;
  senales: string;
  proximo_paso: string;
  requiere_humano: boolean;
};

const ESTADO_ORDER: ProspectEstado[] = [...PROSPECT_ESTADOS];

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 5;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function alignScoreWithTemperature(score: number, temperatura: string) {
  if (temperatura === "caliente") return Math.max(score, 8);
  if (temperatura === "tibio") return Math.max(5, Math.min(score, 7));
  return Math.min(score, 4);
}

function normalizeEstado(value: unknown, current: string): ProspectEstado {
  const next = String(value ?? "").trim();
  if (!PROSPECT_ESTADOS.includes(next as ProspectEstado)) {
    return current as ProspectEstado;
  }

  if (current === "cerrado_positivo" || current === "cerrado_negativo") {
    return current as ProspectEstado;
  }

  if (next === "cerrado_negativo" || next === "cerrado_positivo") {
    return next as ProspectEstado;
  }

  const currentIndex = ESTADO_ORDER.indexOf(current as ProspectEstado);
  const nextIndex = ESTADO_ORDER.indexOf(next as ProspectEstado);

  if (currentIndex === -1 || nextIndex === -1) return next as ProspectEstado;
  return nextIndex >= currentIndex ? (next as ProspectEstado) : (current as ProspectEstado);
}

function parseAnalysis(raw: string): ProspectAnalysis {
  try {
    return JSON.parse(raw) as ProspectAnalysis;
  } catch {
    const scoreMatch = raw.match(/OPORTUNIDAD:\s*(\d+)/i);
    const resumenMatch = raw.match(/RESUMEN:\s*(.+)/i);
    const pasoMatch = raw.match(/PR[OÓ]XIMO PASO:\s*(.+)/i);

    return {
      oportunidad: scoreMatch ? Number(scoreMatch[1]) : 5,
      temperatura: "",
      estado_sugerido: "seguimiento",
      intenciones: [],
      resumen: resumenMatch?.[1] || raw.slice(0, 500),
      senales: "",
      proximo_paso: pasoMatch?.[1] || "Definir el siguiente contacto manualmente.",
      requiere_humano: false,
    };
  }
}

function buildTranscript(
  mensajes: Array<{
    direccion: string;
    contenido: string;
    transcripcion: string | null;
    timestamp: Date;
    nombreContacto: string;
  }>
) {
  return mensajes
    .filter((message) => {
      const text = message.transcripcion || message.contenido;
      return text && !text.toLowerCase().startsWith("[reaccion");
    })
    .slice(-40)
    .map((message) => {
      const who =
        message.direccion === "saliente"
          ? "Tomas"
          : message.nombreContacto || "Prospecto";
      const time = message.timestamp
        ? new Date(message.timestamp).toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
          })
        : "";
      const text = message.transcripcion
        ? `[audio transcripto] ${message.transcripcion}`
        : message.contenido;

      return `[${time}] ${who}: ${text}`;
    })
    .join("\n");
}

async function getPhonesToAnalyze(body: AnalyzeBody) {
  if (body.telefono) return [body.telefono];

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hace23h = new Date(Date.now() - 23 * 60 * 60 * 1000);

  const mensajesRecientes = await db
    .selectDistinct({ telefono: prospectosMensajes.telefono })
    .from(prospectosMensajes)
    .where(gte(prospectosMensajes.timestamp, hace24h));

  const telefonosUnicos = mensajesRecientes.map((message) => message.telefono);
  if (!telefonosUnicos.length) return [];

  if (body.force) return telefonosUnicos;

  const yaAnalizados = await db
    .select({ telefono: prospectos.telefono })
    .from(prospectos)
    .where(
      and(
        inArray(prospectos.telefono, telefonosUnicos),
        isNotNull(prospectos.ultimoAnalisis),
        gte(prospectos.ultimoAnalisis, hace23h)
      )
    );

  const set = new Set(yaAnalizados.map((prospect) => prospect.telefono));
  return telefonosUnicos.filter((telefono) => !set.has(telefono));
}

export async function POST(req: NextRequest) {
  let body: AnalyzeBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const telefonosAanalizar = await getPhonesToAnalyze(body);

  if (!telefonosAanalizar.length) {
    return NextResponse.json({
      ok: true,
      analizados: 0,
      mensaje: "Nada nuevo para analizar",
    });
  }

  let openai: OpenAI;
  try {
    openai = getOpenAI();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }

  const resultados: Array<{
    telefono: string;
    negocio: string;
    score: number;
    temperatura: string;
    estado: string;
    intenciones: string[];
    requiereHumano: boolean;
  }> = [];

  for (const telefono of telefonosAanalizar) {
    try {
      const mensajes = await db
        .select({
          direccion: prospectosMensajes.direccion,
          contenido: prospectosMensajes.contenido,
          transcripcion: prospectosMensajes.transcripcion,
          timestamp: prospectosMensajes.timestamp,
          nombreContacto: prospectosMensajes.nombreContacto,
        })
        .from(prospectosMensajes)
        .where(eq(prospectosMensajes.telefono, telefono))
        .orderBy(asc(prospectosMensajes.timestamp));

      if (!mensajes.length) continue;

      const [prospecto] = await db
        .select({
          id: prospectos.id,
          negocio: prospectos.negocio,
          nombreContacto: prospectos.nombreContacto,
          estado: prospectos.estado,
          rubro: prospectos.rubro,
          destacado: prospectos.destacado,
          chatwootConversationId: prospectos.chatwootConversationId,
        })
        .from(prospectos)
        .where(eq(prospectos.telefono, telefono));

      if (!prospecto) continue;

      const transcripcion = buildTranscript(mensajes);
      if (!transcripcion.trim()) continue;

      const negocio = prospecto.negocio || prospecto.nombreContacto || telefono;

      const response = await openai.chat.completions.create({
        model: process.env.PROSPECCION_ANALYSIS_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sos un analista de prospeccion B2B para Adnexum. Clasificas conversaciones frias de WhatsApp para medir pipeline comercial. Responde solo JSON valido.",
          },
          {
            role: "user",
            content: `Contexto comercial:
- Tomas Bravo vende automatizaciones con n8n, chatbots con Chatwoot, WhatsApp Business API y soluciones de IA generativa.
- El CRM es la fuente de verdad. Tu salida actualiza score, temperatura, estado e intenciones.

Prospecto: ${negocio}
Telefono: ${telefono}
Rubro conocido: ${prospecto.rubro || "desconocido"}
Estado actual: ${prospecto.estado}

Estados validos:
enviado, contactado, respondio, agendado, seguimiento, cerrado_positivo, cerrado_negativo

Intenciones validas:
interes, precio, demo, objecion, presupuesto, seguimiento, no_interes

Reglas:
- oportunidad: numero entero 1 a 10.
- temperatura: frio si solo hay contacto bajo o respuesta neutra; tibio si hay interes real; caliente si pide reunion, precio, presupuesto, demo o muestra urgencia.
- estado_sugerido: no retrocedas etapas. Si respondio con interes, usa respondio o seguimiento. Si hay reunion, agendado. Si rechaza claramente, cerrado_negativo.
- requiere_humano: true si pide precio final, propuesta, reunion, reclamo, cierre, descuento, contrato o validacion humana.
- proximo_paso: accion concreta para Tomas, corta y operativa.

Conversacion:
---
${transcripcion}
---

JSON exacto:
{
  "oportunidad": 1,
  "temperatura": "frio|tibio|caliente",
  "estado_sugerido": "enviado|contactado|respondio|agendado|seguimiento|cerrado_positivo|cerrado_negativo",
  "intenciones": ["interes"],
  "resumen": "2 oraciones maximo",
  "senales": "senales positivas o negativas en 1 oracion",
  "proximo_paso": "accion concreta",
  "requiere_humano": false
}`,
          },
        ],
      });

      const raw = response.choices[0].message.content || "{}";
      const parsed = parseAnalysis(raw);
      const rawScore = clampScore(parsed.oportunidad);
      const temperatura = normalizeTemperatura(parsed.temperatura, rawScore);
      const score = alignScoreWithTemperature(rawScore, temperatura);
      const intenciones = normalizeIntenciones(parsed.intenciones);
      const estado = normalizeEstado(parsed.estado_sugerido, prospecto.estado);
      const proximoPaso =
        String(parsed.proximo_paso || "").trim() ||
        "Revisar la conversacion y definir el siguiente contacto.";
      const requiereHumano = Boolean(parsed.requiere_humano);
      const resumen = String(parsed.resumen || "").trim() || "Sin resumen claro.";
      const senales = String(parsed.senales || "").trim();
      const resumenIa = buildProspectSummary({
        score,
        temperatura,
        intenciones,
        resumen,
        senales,
        proximoPaso,
        requiereHumano,
      });

      await db
        .update(prospectos)
        .set({
          estado,
          resumenIa,
          oportunidadScore: score,
          temperatura,
          intencionesJson: JSON.stringify(intenciones),
          proximoPaso,
          requiereHumano,
          ultimoAnalisis: new Date(),
          ultimaClasificacion: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(prospectos.telefono, telefono));

      syncProspectLabels({
        prospectId: prospecto.id,
        phone: telefono,
        estado,
        chatwootConversationId: prospecto.chatwootConversationId,
        temperatura,
        intenciones,
        requiereHumano,
        destacado: prospecto.destacado,
      });

      resultados.push({
        telefono,
        negocio,
        score,
        temperatura,
        estado,
        intenciones,
        requiereHumano,
      });
      console.log(`[ANALISIS] ${negocio} (${telefono}) -> score ${score}`);
    } catch (err) {
      console.error(`[ANALISIS ERROR] ${telefono}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    analizados: resultados.length,
    resultados,
  });
}

export async function GET(req: NextRequest) {
  const telefono = req.nextUrl.searchParams.get("telefono");

  if (telefono) {
    const [data] = await db
      .select({
        resumenIa: prospectos.resumenIa,
        oportunidadScore: prospectos.oportunidadScore,
        temperatura: prospectos.temperatura,
        intencionesJson: prospectos.intencionesJson,
        proximoPaso: prospectos.proximoPaso,
        requiereHumano: prospectos.requiereHumano,
        destacado: prospectos.destacado,
        ultimoAnalisis: prospectos.ultimoAnalisis,
        ultimaClasificacion: prospectos.ultimaClasificacion,
        negocio: prospectos.negocio,
        nombreContacto: prospectos.nombreContacto,
      })
      .from(prospectos)
      .where(eq(prospectos.telefono, telefono));

    return NextResponse.json(data || {});
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return POST(
      new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({ force: false }),
      })
    );
  }

  const data = await db
    .select({
      telefono: prospectos.telefono,
      negocio: prospectos.negocio,
      nombreContacto: prospectos.nombreContacto,
      oportunidadScore: prospectos.oportunidadScore,
      temperatura: prospectos.temperatura,
      intencionesJson: prospectos.intencionesJson,
      proximoPaso: prospectos.proximoPaso,
      requiereHumano: prospectos.requiereHumano,
      destacado: prospectos.destacado,
      ultimoAnalisis: prospectos.ultimoAnalisis,
      resumenIa: prospectos.resumenIa,
    })
    .from(prospectos)
    .where(sql`${prospectos.resumenIa} != ''`)
    .orderBy(desc(prospectos.oportunidadScore));

  return NextResponse.json(data);
}
