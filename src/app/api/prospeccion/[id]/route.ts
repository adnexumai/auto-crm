import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import {
  PROSPECT_ESTADOS,
  normalizeIntenciones,
  normalizeTemperatura,
  parseIntencionesJson,
} from "@/lib/prospecting";
import { syncProspectLabels } from "@/lib/prospeccion/chatwoot-label-sync";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = new Set<string>(PROSPECT_ESTADOS);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db.select().from(prospectos).where(eq(prospectos.id, id));

  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: prospectos.id })
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const updates: Partial<typeof prospectos.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof body.negocio === "string") updates.negocio = body.negocio;
  if (typeof body.notas === "string") updates.notas = body.notas;
  if (typeof body.nombreContacto === "string") {
    updates.nombreContacto = body.nombreContacto;
  }
  if (typeof body.rubro === "string") updates.rubro = body.rubro;
  if (typeof body.urlNegocio === "string") updates.urlNegocio = body.urlNegocio;
  if (typeof body.chatwootConversationId === "string") {
    updates.chatwootConversationId = body.chatwootConversationId;
  }
  if (typeof body.proximoPaso === "string") updates.proximoPaso = body.proximoPaso;
  if (typeof body.resumenIa === "string") updates.resumenIa = body.resumenIa;
  if (typeof body.oportunidadScore === "number") {
    updates.oportunidadScore = Math.max(0, Math.min(10, Math.round(body.oportunidadScore)));
  }
  if (typeof body.temperatura === "string") {
    updates.temperatura = normalizeTemperatura(body.temperatura, Number(body.oportunidadScore ?? 0));
  }
  if (Array.isArray(body.intenciones) || typeof body.intenciones === "string") {
    updates.intencionesJson = JSON.stringify(normalizeIntenciones(body.intenciones));
  }
  if (typeof body.requiereHumano === "boolean") {
    updates.requiereHumano = body.requiereHumano;
  }
  if (typeof body.destacado === "boolean") {
    updates.destacado = body.destacado;
  }

  let estadoCambiado = false;
  if (typeof body.estado === "string" && ESTADOS_VALIDOS.has(body.estado)) {
    updates.estado = body.estado;
    if (body.estado !== "agendado") updates.fechaAgendado = null;
    estadoCambiado = true;
  }

  if (body.fechaAgendado !== undefined) {
    updates.fechaAgendado = body.fechaAgendado
      ? new Date(body.fechaAgendado as string)
      : null;
  }

  await db.update(prospectos).set(updates).where(eq(prospectos.id, id));

  const [updated] = await db.select().from(prospectos).where(eq(prospectos.id, id));

  const shouldSyncLabels =
    estadoCambiado ||
    "temperatura" in updates ||
    "intencionesJson" in updates ||
    "requiereHumano" in updates ||
    "destacado" in updates ||
    "chatwootConversationId" in updates;

  if (shouldSyncLabels) {
    syncProspectLabels({
      prospectId: id,
      phone: updated.telefono,
      estado: updated.estado,
      chatwootConversationId: updated.chatwootConversationId,
      temperatura: updated.temperatura,
      intenciones: parseIntencionesJson(updated.intencionesJson),
      requiereHumano: updated.requiereHumano,
      destacado: updated.destacado,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select({ telefono: prospectos.telefono })
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await db
    .delete(prospectosMensajes)
    .where(eq(prospectosMensajes.telefono, row.telefono));

  await db.delete(prospectos).where(eq(prospectos.id, id));

  return NextResponse.json({ success: true });
}
