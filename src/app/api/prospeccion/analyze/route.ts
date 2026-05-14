// Análisis IA de prospectos (Supabase + OpenAI)
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AnalyzeBody = { telefono?: string; force?: boolean };

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 5;
  return Math.max(1, Math.min(10, Math.round(score)));
}

async function getPhonesToAnalyze(body: AnalyzeBody) {
  const supabase = getSupabase();

  if (body.telefono) return [body.telefono];

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hace23h = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

  const { data: mensajesRecientes } = await supabase
    .from("prospectos_mensajes")
    .select("telefono")
    .gte("timestamp", hace24h);

  const telefonosUnicos = [...new Set((mensajesRecientes || []).map((m) => m.telefono))];
  if (!telefonosUnicos.length) return [];
  if (body.force) return telefonosUnicos;

  const { data: yaAnalizados } = await supabase
    .from("prospectos")
    .select("telefono")
    .in("telefono", telefonosUnicos)
    .not("ultimo_analisis", "is", null)
    .gte("ultimo_analisis", hace23h);

  const set = new Set((yaAnalizados || []).map((p) => p.telefono));
  return telefonosUnicos.filter((t) => !set.has(t));
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
    return NextResponse.json({ ok: true, analizados: 0, mensaje: "Nada nuevo para analizar" });
  }

  let openai: OpenAI;
  try {
    openai = getOpenAI();
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }

  const supabase = getSupabase();
  const resultados: Array<{ telefono: string; negocio: string; score: number }> = [];

  for (const telefono of telefonosAanalizar) {
    try {
      const { data: mensajes } = await supabase
        .from("prospectos_mensajes")
        .select("direccion, tipo, contenido, timestamp, nombre_contacto")
        .eq("telefono", telefono)
        .order("timestamp", { ascending: true });

      if (!mensajes?.length) continue;

      const { data: prospecto } = await supabase
        .from("prospectos")
        .select("negocio, nombre_contacto, estado, primer_contacto")
        .eq("telefono", telefono)
        .maybeSingle();

      if (!prospecto) continue;

      const transcripcion = mensajes
        .filter((m) => m.contenido && !m.contenido.startsWith("[reaccion"))
        .slice(-40)
        .map((m) => {
          const quien = m.direccion === "saliente" ? "Tomas" : m.nombre_contacto || "Prospecto";
          const hora = new Date(m.timestamp).toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
          });
          return `[${hora}] ${quien}: ${m.contenido}`;
        })
        .join("\n");

      if (!transcripcion.trim()) continue;

      const negocio = prospecto.negocio || prospecto.nombre_contacto || telefono;

      const response = await openai.chat.completions.create({
        model: process.env.PROSPECCION_ANALYSIS_MODEL || "gpt-4o-mini",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `Sos el asistente de ventas de Tomas Bravo, fundador de Adnexum (agencia de IA y automatizacion en Comodoro Rivadavia, Argentina). Tomas vende automatizaciones con n8n, chatbots con Chatwoot, integraciones con WhatsApp Business API, y soluciones con IA generativa.

Analiza esta conversacion de prospeccion en frio con "${negocio}" (${telefono}):

---
${transcripcion}
---

Responde en espanol con este formato exacto (sin markdown extra):

OPORTUNIDAD: [del 1 al 10, donde 10 = muy probable que compre]
RESUMEN: [2-3 oraciones describiendo el estado de la conversacion y el interes del prospecto]
SENALES: [senales positivas o negativas detectadas, 1-2 oraciones]
PROXIMO PASO: [accion concreta que Tomas deberia tomar hoy o manana]`,
          },
        ],
      });

      const analisis = response.choices[0].message.content || "";
      const scoreMatch = analisis.match(/OPORTUNIDAD:\s*(\d+)/);
      const score = scoreMatch ? clampScore(scoreMatch[1]) : 5;
      const pasoMatch = analisis.match(/PR[OÓ]XIMO PASO:\s*(.+)/i);
      const proximoPaso = pasoMatch?.[1]?.trim() || "";

      await supabase
        .from("prospectos")
        .update({
          resumen_ia: analisis,
          oportunidad_score: score,
          ultimo_analisis: new Date().toISOString(),
          ...(proximoPaso ? { siguiente_paso: proximoPaso } : {}),
        })
        .eq("telefono", telefono);

      resultados.push({ telefono, negocio, score });
      console.log(`[ANALISIS] ${negocio} (${telefono}) -> score ${score}`);
    } catch (err) {
      console.error(`[ANALISIS ERROR] ${telefono}:`, err);
    }
  }

  return NextResponse.json({ ok: true, analizados: resultados.length, resultados });
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const telefono = req.nextUrl.searchParams.get("telefono");

  if (telefono) {
    const { data } = await supabase
      .from("prospectos")
      .select("resumen_ia, oportunidad_score, ultimo_analisis, negocio, nombre_contacto, siguiente_paso")
      .eq("telefono", telefono)
      .maybeSingle();
    return NextResponse.json(data || {});
  }

  // Cron support
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

  const { data } = await supabase
    .from("prospectos")
    .select("telefono, negocio, nombre_contacto, oportunidad_score, ultimo_analisis, resumen_ia, siguiente_paso")
    .neq("resumen_ia", "")
    .order("oportunidad_score", { ascending: false });

  return NextResponse.json(data || []);
}
