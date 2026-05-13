// [FUSION] Promoción de prospect a Deal del CRM (crea Contact si no existe)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { prospectos, contacts, deals, pipelineStages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { postN8n } from "@/lib/prospeccion/ycloud";

export const dynamic = "force-dynamic";

function scoreATemperatura(score: number): "cold" | "warm" | "hot" {
  if (score >= 7) return "hot";
  if (score >= 4) return "warm";
  return "cold";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [prospect] = await db
    .select()
    .from(prospectos)
    .where(eq(prospectos.id, id));

  if (!prospect) {
    return NextResponse.json(
      { error: "Prospect no encontrado" },
      { status: 404 }
    );
  }

  // Idempotencia: si ya fue promovido, devolver el deal existente
  if (prospect.crmDealId) {
    return NextResponse.json({
      success: true,
      alreadyPromoted: true,
      dealId: prospect.crmDealId,
    });
  }

  // Buscar o crear el contacto por teléfono
  let [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.phone, prospect.telefono));

  const now = new Date();

  if (!contact) {
    const nombre =
      prospect.nombreContacto?.trim() ||
      prospect.negocio?.trim() ||
      prospect.telefono;
    const [inserted] = await db
      .insert(contacts)
      .values({
        name: nombre,
        phone: prospect.telefono,
        company: prospect.negocio || null,
        source: "whatsapp",
        temperature: scoreATemperatura(prospect.oportunidadScore),
        score: prospect.oportunidadScore * 10,
        notes: prospect.resumenIa || prospect.notas || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    contact = inserted;
  }

  // Tomar la primera etapa del pipeline (por orden)
  const [firstStage] = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    .limit(1);

  if (!firstStage) {
    return NextResponse.json(
      { error: "No hay etapas de pipeline configuradas" },
      { status: 500 }
    );
  }

  const dealTitle =
    prospect.negocio?.trim() ||
    prospect.nombreContacto?.trim() ||
    `Lead WhatsApp ${prospect.telefono}`;

  const [newDeal] = await db
    .insert(deals)
    .values({
      title: dealTitle,
      value: 0,
      stageId: firstStage.id,
      contactId: contact.id,
      notes: prospect.resumenIa || null,
      probability: prospect.oportunidadScore * 10,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(prospectos)
    .set({
      crmDealId: newDeal.id,
      estado: "seguimiento",
      updatedAt: now,
    })
    .where(eq(prospectos.id, id));

  // Fire-and-forget n8n
  postN8n("/webhook/prospect-promoted", {
    prospectId: prospect.id,
    dealId: newDeal.id,
    contactId: contact.id,
    phone: prospect.telefono,
    name: prospect.nombreContacto || prospect.negocio || "",
    score: prospect.oportunidadScore,
  });

  return NextResponse.json({
    success: true,
    dealId: newDeal.id,
    contactId: contact.id,
  });
}
