// [FUSION] GET mensajes de un prospect ordenados por timestamp ASC
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos, prospectosMensajes } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [prospect] = await db
    .select({ telefono: prospectos.telefono })
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!prospect) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const mensajes = await db
    .select({
      id: prospectosMensajes.id,
      telefono: prospectosMensajes.telefono,
      direccion: prospectosMensajes.direccion,
      tipo: prospectosMensajes.tipo,
      contenido: prospectosMensajes.contenido,
      transcripcion: prospectosMensajes.transcripcion,
      mediaUrl: prospectosMensajes.mediaUrl,
      nombreContacto: prospectosMensajes.nombreContacto,
      timestamp: prospectosMensajes.timestamp,
    })
    .from(prospectosMensajes)
    .where(eq(prospectosMensajes.telefono, prospect.telefono))
    .orderBy(asc(prospectosMensajes.timestamp));

  return NextResponse.json({ items: mensajes });
}
