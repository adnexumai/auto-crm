// [FUSION] Script one-time para migrar datos desde Supabase del Tracker a SQLite del CRM
//
// Uso:
//   npx tsx scripts/migrate-from-supabase.ts
//
// Requiere en .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Después de correr, borrar esas variables del .env.local (no son necesarias en producción).

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/db";
import { prospectos, prospectosMensajes } from "../src/db/schema";
import { sql } from "drizzle-orm";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? new Date() : d;
}

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function asString(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1";
}

function asInt(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : Math.trunc(n);
}

// -------------------- Prospectos --------------------

async function migrarProspectos(): Promise<{ total: number; migrados: number; errores: number }> {
  console.log("\n→ Migrando prospectos...");
  const BATCH = 1000;
  let start = 0;
  let total = 0;
  let migrados = 0;
  let errores = 0;

  while (true) {
    const { data, error } = await supabase
      .from("prospectos")
      .select("*")
      .range(start, start + BATCH - 1);

    if (error) {
      console.error("  ERROR al leer Supabase:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    total += data.length;

    for (const row of data) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        await db.insert(prospectos)
          .values({
            // id dejamos que Drizzle genere (si querés conservar el ID de Supabase, descomentá la siguiente línea)
            // id: asString(r.id),
            telefono: asString(r.telefono),
            nombreContacto: asString(r.nombre_contacto),
            negocio: r.negocio ? asString(r.negocio) : null,
            rubro: asString(r.rubro),
            estado: asString(r.estado, "enviado"),
            respondio: asBool(r.respondio),
            resumenIa: asString(r.resumen_ia),
            oportunidadScore: asInt(r.oportunidad_score),
            notas: asString(r.notas),
            mensajesEnviados: asInt(r.mensajes_enviados, 1),
            primerContacto: toDate(r.primer_contacto),
            ultimoContacto: toDate(r.ultimo_contacto),
            ultimoAnalisis: toDateOrNull(r.ultimo_analisis),
            source: asString(r.source, "whatsapp"),
            createdAt: toDate(r.created_at ?? r.primer_contacto),
            updatedAt: toDate(r.updated_at ?? r.ultimo_contacto),
          })
          .onConflictDoNothing({ target: prospectos.telefono });
        migrados++;
      } catch (e) {
        errores++;
        console.error(`  [prospecto ${asString((row as { telefono?: string }).telefono)}]`, (e as Error).message);
      }
    }

    console.log(`  batch ${start}-${start + data.length - 1} (${data.length} filas)`);
    if (data.length < BATCH) break;
    start += BATCH;
  }

  return { total, migrados, errores };
}

// -------------------- Mensajes --------------------

async function migrarMensajes(): Promise<{ total: number; migrados: number; errores: number }> {
  console.log("\n→ Migrando prospectos_mensajes...");
  const BATCH = 500;
  let start = 0;
  let total = 0;
  let migrados = 0;
  let errores = 0;

  while (true) {
    const { data, error } = await supabase
      .from("prospectos_mensajes")
      .select("*")
      .order("timestamp", { ascending: true })
      .range(start, start + BATCH - 1);

    if (error) {
      console.error("  ERROR al leer Supabase:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    total += data.length;

    for (const row of data) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        const telefono = asString(r.telefono);
        if (!telefono) {
          errores++;
          continue;
        }

        // Saltar si no existe el prospecto (FK). En vez de fallar, lo ignoramos silenciosamente.
        const [existe] = await db
          .select({ t: prospectos.telefono })
          .from(prospectos)
          .where(sql`${prospectos.telefono} = ${telefono}`);
        if (!existe) {
          continue;
        }

        const payload =
          typeof r.payload_raw === "string"
            ? r.payload_raw
            : JSON.stringify(r.payload_raw ?? {});

        await db.insert(prospectosMensajes)
          .values({
            telefono,
            wamid: r.wamid ? asString(r.wamid) : null,
            direccion: asString(r.direccion, "entrante"),
            tipo: asString(r.tipo, "text"),
            contenido: asString(r.contenido),
            transcripcion: r.transcripcion ? asString(r.transcripcion) : null,
            mediaUrl: r.media_url ? asString(r.media_url) : null,
            nombreContacto: asString(r.nombre_contacto),
            payloadRaw: payload,
            timestamp: toDate(r.timestamp),
            createdAt: toDate(r.created_at ?? r.timestamp),
          })
          .onConflictDoNothing({ target: prospectosMensajes.wamid });
        migrados++;
      } catch (e) {
        errores++;
        console.error(`  [mensaje ${asString((row as { wamid?: string }).wamid)}]`, (e as Error).message);
      }
    }

    console.log(`  batch ${start}-${start + data.length - 1} (${data.length} filas) · acum ${migrados}`);
    if (data.length < BATCH) break;
    start += BATCH;
  }

  return { total, migrados, errores };
}

// -------------------- Main --------------------

async function main() {
  console.log("==========================================");
  console.log(" Migración Supabase → Turso (Auto-CRM)");
  console.log("==========================================");
  console.log(`Supabase: ${SUPABASE_URL}`);

  const [antesProspRow] = await db.select({ c: sql<number>`count(*)` }).from(prospectos);
  const antesProsp = antesProspRow?.c ?? 0;
  const [antesMsgsRow] = await db.select({ c: sql<number>`count(*)` }).from(prospectosMensajes);
  const antesMsgs = antesMsgsRow?.c ?? 0;
  console.log(`Estado inicial Turso: ${antesProsp} prospectos · ${antesMsgs} mensajes`);

  const p = await migrarProspectos();
  const m = await migrarMensajes();

  const [despuesProspRow] = await db.select({ c: sql<number>`count(*)` }).from(prospectos);
  const despuesProsp = despuesProspRow?.c ?? 0;
  const [despuesMsgsRow] = await db.select({ c: sql<number>`count(*)` }).from(prospectosMensajes);
  const despuesMsgs = despuesMsgsRow?.c ?? 0;

  console.log("\n==========================================");
  console.log(" Resultado");
  console.log("==========================================");
  console.log(`Prospectos:  leídos ${p.total} · insertados ${p.migrados} · errores ${p.errores}`);
  console.log(`Mensajes:    leídos ${m.total} · insertados ${m.migrados} · errores ${m.errores}`);
  console.log(`\nTurso ahora: ${despuesProsp} prospectos · ${despuesMsgs} mensajes`);
  console.log(`Delta:       +${despuesProsp - antesProsp} prospectos · +${despuesMsgs - antesMsgs} mensajes`);
  console.log("\nRECORDATORIO: borrar NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del .env.local.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
