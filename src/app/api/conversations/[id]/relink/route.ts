import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prospectos } from "@/db/schema";
import { buildChatwootAppUrl, resolveChatwootConversationByPhone } from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [prospect] = await db
    .select({ id: prospectos.id, telefono: prospectos.telefono })
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!prospect) {
    return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
  }

  const resolved = await resolveChatwootConversationByPhone(prospect.telefono);
  if (!resolved.conversationId) {
    return NextResponse.json(
      { error: "No se pudo resolver una conversación de Chatwoot para este teléfono." },
      { status: 404 }
    );
  }

  await db
    .update(prospectos)
    .set({
      chatwootConversationId: String(resolved.conversationId),
      updatedAt: new Date(),
    })
    .where(eq(prospectos.id, id));

  return NextResponse.json({
    ok: true,
    conversationId: String(resolved.conversationId),
    appUrl: buildChatwootAppUrl(resolved.conversationId),
  });
}
