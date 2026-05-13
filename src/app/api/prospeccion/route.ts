// [FUSION] GET lista paginada de prospectos con filtros (search, estado)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import {
  inferIndustryFromName,
  normalizeProspectPhone,
  normalizeIntenciones,
  normalizeTemperatura,
} from "@/lib/prospecting";
import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const estado = searchParams.get("estado")?.trim() || "";
  const temperatura = searchParams.get("temperatura")?.trim() || "";
  const intencion = searchParams.get("intencion")?.trim() || "";
  const requiereHumano = searchParams.get("requiereHumano")?.trim() || "";
  const destacado = searchParams.get("destacado")?.trim() || "";
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
  );

  const conditions: SQL[] = [];
  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      like(prospectos.telefono, pattern),
      like(prospectos.negocio, pattern),
      like(prospectos.nombreContacto, pattern)
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (estado) {
    conditions.push(eq(prospectos.estado, estado));
  }
  if (temperatura) {
    conditions.push(eq(prospectos.temperatura, temperatura));
  }
  if (intencion) {
    conditions.push(like(prospectos.intencionesJson, `%${intencion}%`));
  }
  if (requiereHumano === "true") {
    conditions.push(eq(prospectos.requiereHumano, true));
  }
  if (destacado === "true") {
    conditions.push(eq(prospectos.destacado, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(prospectos)
    .where(whereClause)
    .orderBy(desc(prospectos.destacado), desc(prospectos.ultimoContacto))
    .limit(pageSize)
    .offset(page * pageSize);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos)
    .where(whereClause);

  const [totalGlobalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospectos);

  const phones = items.map((item) => item.telefono);
  const latestByPhone = new Map<string, string>();

  if (phones.length > 0) {
    const messages = await db
      .select({
        telefono: prospectosMensajes.telefono,
        contenido: prospectosMensajes.contenido,
        transcripcion: prospectosMensajes.transcripcion,
      })
      .from(prospectosMensajes)
      .where(inArray(prospectosMensajes.telefono, phones))
      .orderBy(desc(prospectosMensajes.timestamp))
      .limit(phones.length * 8);

    for (const message of messages) {
      if (latestByPhone.has(message.telefono)) continue;
      latestByPhone.set(message.telefono, message.transcripcion || message.contenido);
    }
  }

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      ultimoMensaje: latestByPhone.get(item.telefono) || "",
    })),
    total: totalRow?.count ?? 0,
    totalGlobal: totalGlobalRow?.count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const telefono = normalizeProspectPhone(String(body.telefono ?? ""));
  const negocio = typeof body.negocio === "string" ? body.negocio.trim() : "";
  const nombreContacto =
    typeof body.nombreContacto === "string" ? body.nombreContacto.trim() : "";
  const notas = typeof body.notas === "string" ? body.notas.trim() : "";
  const urlNegocio =
    typeof body.urlNegocio === "string" ? body.urlNegocio.trim() : "";
  const rubroManual =
    typeof body.rubro === "string" ? body.rubro.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source : "manual";
  const score =
    typeof body.oportunidadScore === "number"
      ? Math.max(0, Math.min(10, Math.round(body.oportunidadScore)))
      : 0;
  const temperatura = normalizeTemperatura(body.temperatura, score);
  const intenciones = normalizeIntenciones(body.intenciones);

  if (!telefono) {
    return NextResponse.json(
      { error: "El telefono es obligatorio" },
      { status: 400 }
    );
  }

  const rubro =
    rubroManual || inferIndustryFromName(negocio, nombreContacto, notas);

  const [existing] = await db
    .select()
    .from(prospectos)
    .where(eq(prospectos.telefono, telefono));

  if (existing) {
    const patch: Partial<typeof prospectos.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (negocio && !existing.negocio) patch.negocio = negocio;
    if (nombreContacto && !existing.nombreContacto) {
      patch.nombreContacto = nombreContacto;
    }
    if (notas) {
      patch.notas = existing.notas
        ? `${existing.notas}\n${notas}`.trim()
        : notas;
    }
    if (urlNegocio && !existing.urlNegocio) patch.urlNegocio = urlNegocio;
    if (rubro && (!existing.rubro || existing.rubro === "general")) {
      patch.rubro = rubro;
    }
    if (score > existing.oportunidadScore) patch.oportunidadScore = score;
    if (body.temperatura) patch.temperatura = temperatura;
    if (intenciones.length > 0) patch.intencionesJson = JSON.stringify(intenciones);
    if (typeof body.proximoPaso === "string") patch.proximoPaso = body.proximoPaso.trim();
    if (typeof body.requiereHumano === "boolean") patch.requiereHumano = body.requiereHumano;
    if (typeof body.destacado === "boolean") patch.destacado = body.destacado;

    await db.update(prospectos).set(patch).where(eq(prospectos.id, existing.id));

    const [updated] = await db
      .select()
      .from(prospectos)
      .where(eq(prospectos.id, existing.id));

    return NextResponse.json(
      { item: updated, duplicated: true },
      { status: 200 }
    );
  }

  const [created] = await db
    .insert(prospectos)
    .values({
      telefono,
      nombreContacto,
      negocio: negocio || null,
      rubro,
      estado: "enviado",
      respondio: false,
      temperatura,
      intencionesJson: JSON.stringify(intenciones),
      proximoPaso: typeof body.proximoPaso === "string" ? body.proximoPaso.trim() : "",
      requiereHumano: typeof body.requiereHumano === "boolean" ? body.requiereHumano : false,
      destacado: typeof body.destacado === "boolean" ? body.destacado : false,
      notas,
      mensajesEnviados: 0,
      primerContacto: new Date(),
      ultimoContacto: new Date(),
      urlNegocio,
      analisisWeb: "",
      procesoVentas: "",
      chatwootConversationId: "",
      source,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ item: created, duplicated: false }, { status: 201 });
}
